"""FastAPI backend for DecidePlease."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
import json
import asyncio

from . import storage_pg as storage
from .database import init_database, close_pool
from .auth import get_current_user
from .payments import (
    create_checkout_session,
    verify_webhook_signature,
    get_credit_pack_info,
    handle_refund,
    send_payment_email,
    CREDITS_PER_PURCHASE,
)
from .council import (
    run_full_council,
    generate_conversation_title,
    stage1_collect_responses,
    stage2_collect_rankings,
    stage3_synthesize_final,
    calculate_aggregate_rankings
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - initialize and cleanup resources."""
    # Startup: Initialize database
    if os.getenv("DATABASE_URL"):
        await init_database()
    yield
    # Shutdown: Close database pool
    await close_pool()


app = FastAPI(title="DecidePlease API", lifespan=lifespan)

# CORS configuration
# In production, set CORS_ORIGINS env var (comma-separated)
# In development, defaults to localhost
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
cors_origins = [origin.strip() for origin in cors_origins if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    pass


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str


class ConversationMetadata(BaseModel):
    """Conversation metadata for list view."""
    id: str
    created_at: str
    title: str
    message_count: int


class Conversation(BaseModel):
    """Full conversation with all messages."""
    id: str
    created_at: str
    title: str
    messages: List[Dict[str, Any]]


class UserInfo(BaseModel):
    """User information including credits."""
    user_id: str
    email: str
    credits: int


class CreateCheckoutRequest(BaseModel):
    """Request to create a checkout session."""
    success_url: str
    cancel_url: str


class CreditPackInfo(BaseModel):
    """Information about credit pack for purchase."""
    credits: int
    price_display: str
    stripe_configured: bool


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "DecidePlease API"}


@app.get("/api/user", response_model=UserInfo)
async def get_user_info(user: dict = Depends(get_current_user)):
    """Get current user information including credits."""
    user_data = await storage.get_or_create_user(user["user_id"], user["email"])
    return UserInfo(
        user_id=user_data["id"],
        email=user_data["email"],
        credits=user_data["credits"]
    )


@app.get("/api/conversations", response_model=List[ConversationMetadata])
async def list_conversations(user: dict = Depends(get_current_user)):
    """List all conversations for the current user (metadata only)."""
    return await storage.list_conversations(user["user_id"])


@app.post("/api/conversations", response_model=Conversation)
async def create_conversation(
    request: CreateConversationRequest,
    user: dict = Depends(get_current_user)
):
    """Create a new conversation."""
    # Ensure user exists in database
    await storage.get_or_create_user(user["user_id"], user["email"])

    conversation_id = str(uuid.uuid4())
    conversation = await storage.create_conversation(conversation_id, user["user_id"])
    return conversation


@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(
    conversation_id: str,
    user: dict = Depends(get_current_user)
):
    """Get a specific conversation with all its messages."""
    conversation = await storage.get_conversation(conversation_id, user["user_id"])
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@app.post("/api/conversations/{conversation_id}/message")
async def send_message(
    conversation_id: str,
    request: SendMessageRequest,
    user: dict = Depends(get_current_user)
):
    """
    Send a message and run the 3-stage council process.
    Returns the complete response with all stages.
    """
    # Check if conversation exists and belongs to user
    conversation = await storage.get_conversation(conversation_id, user["user_id"])
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check credits
    credits = await storage.get_user_credits(user["user_id"])
    if credits <= 0:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    # Deduct credit
    if not await storage.deduct_credit(user["user_id"]):
        raise HTTPException(status_code=402, detail="Insufficient credits")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    # Add user message
    await storage.add_user_message(conversation_id, request.content)

    # If this is the first message, generate a title
    if is_first_message:
        title = await generate_conversation_title(request.content)
        await storage.update_conversation_title(conversation_id, title)

    # Run the 3-stage council process
    stage1_results, stage2_results, stage3_result, metadata = await run_full_council(
        request.content
    )

    # Add assistant message with all stages
    await storage.add_assistant_message(
        conversation_id,
        stage1_results,
        stage2_results,
        stage3_result
    )

    # Return the complete response with metadata
    return {
        "stage1": stage1_results,
        "stage2": stage2_results,
        "stage3": stage3_result,
        "metadata": metadata
    }


@app.post("/api/conversations/{conversation_id}/message/stream")
async def send_message_stream(
    conversation_id: str,
    request: SendMessageRequest,
    user: dict = Depends(get_current_user)
):
    """
    Send a message and stream the 3-stage council process.
    Returns Server-Sent Events as each stage completes.
    """
    # Check if conversation exists and belongs to user
    conversation = await storage.get_conversation(conversation_id, user["user_id"])
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check credits
    credits = await storage.get_user_credits(user["user_id"])
    if credits <= 0:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    # Deduct credit upfront
    if not await storage.deduct_credit(user["user_id"]):
        raise HTTPException(status_code=402, detail="Insufficient credits")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    async def event_generator():
        try:
            # Add user message
            await storage.add_user_message(conversation_id, request.content)

            # Start title generation in parallel (don't await yet)
            title_task = None
            if is_first_message:
                title_task = asyncio.create_task(generate_conversation_title(request.content))

            # Stage 1: Collect responses
            yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
            stage1_results = await stage1_collect_responses(request.content)
            yield f"data: {json.dumps({'type': 'stage1_complete', 'data': stage1_results})}\n\n"

            # Stage 2: Collect rankings
            yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
            stage2_results, label_to_model = await stage2_collect_rankings(request.content, stage1_results)
            aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
            yield f"data: {json.dumps({'type': 'stage2_complete', 'data': stage2_results, 'metadata': {'label_to_model': label_to_model, 'aggregate_rankings': aggregate_rankings}})}\n\n"

            # Stage 3: Synthesize final answer
            yield f"data: {json.dumps({'type': 'stage3_start'})}\n\n"
            stage3_result = await stage3_synthesize_final(request.content, stage1_results, stage2_results)
            yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"

            # Wait for title generation if it was started
            if title_task:
                title = await title_task
                await storage.update_conversation_title(conversation_id, title)
                yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"

            # Save complete assistant message
            await storage.add_assistant_message(
                conversation_id,
                stage1_results,
                stage2_results,
                stage3_result
            )

            # Send completion event with updated credits
            remaining_credits = await storage.get_user_credits(user["user_id"])
            yield f"data: {json.dumps({'type': 'complete', 'credits': remaining_credits})}\n\n"

        except Exception as e:
            # Send error event
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


# ============== Payment Endpoints ==============

@app.get("/api/credits/info", response_model=CreditPackInfo)
async def get_credits_info():
    """Get information about credit pack available for purchase."""
    info = get_credit_pack_info()
    return CreditPackInfo(**info)


@app.post("/api/credits/checkout")
async def create_credits_checkout(
    request: CreateCheckoutRequest,
    user: dict = Depends(get_current_user)
):
    """Create a Stripe checkout session to purchase credits."""
    result = await create_checkout_session(
        user_id=user["user_id"],
        user_email=user["email"],
        success_url=request.success_url,
        cancel_url=request.cancel_url,
    )
    return result


@app.post("/api/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature")
):
    """
    Handle Stripe webhook events.
    This endpoint receives payment confirmations and adds credits to users.

    NOTE: Since we share a Stripe account with other apps, we filter events
    by checking for our metadata (user_id) to only process DecidePlease payments.
    """
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")

    # Get raw body for signature verification
    payload = await request.body()

    # Verify signature and get event
    event = verify_webhook_signature(payload, stripe_signature)

    # Handle checkout completion (payment success)
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]

        # Get user_id from metadata - this identifies DecidePlease payments
        user_id = session.get("metadata", {}).get("user_id")

        # Skip if no user_id - this payment is from another app on the shared account
        if not user_id:
            print(f"[WEBHOOK] Ignoring checkout.session.completed - no user_id metadata (other app)")
            return {"status": "success"}

        credits_str = session.get("metadata", {}).get("credits", str(CREDITS_PER_PURCHASE))
        credits_to_add = int(credits_str)
        await storage.add_credits(user_id, credits_to_add)
        print(f"[WEBHOOK] Added {credits_to_add} credits to user {user_id}")

        # Send custom purchase confirmation email (when implemented)
        customer_email = session.get("customer_email")
        if customer_email:
            amount = session.get("amount_total", 0)
            await send_payment_email(customer_email, "purchase", amount, credits_to_add)

    # Handle refunds
    elif event["type"] == "charge.refunded":
        charge = event["data"]["object"]

        # For refunds, we need to check the payment intent's metadata
        # The charge itself may not have metadata, but we can check if
        # this charge is associated with a DecidePlease payment by looking
        # at the payment intent or checking our database
        payment_intent_id = charge.get("payment_intent")
        customer_email = charge.get("billing_details", {}).get("email") or charge.get("receipt_email")
        amount_refunded = charge.get("amount_refunded", 0)

        # Try to get metadata from the charge or payment intent
        metadata = charge.get("metadata", {})

        # Skip if this doesn't look like a DecidePlease payment
        # (no metadata means it's probably from another app)
        if not metadata.get("user_id") and not metadata:
            print(f"[WEBHOOK] Ignoring charge.refunded - no DecidePlease metadata (other app)")
            return {"status": "success"}

        print(f"[WEBHOOK] Refund detected: {charge.get('id')} for ${amount_refunded/100:.2f}")

        # Handle the refund (send email, etc.)
        if customer_email:
            await handle_refund(charge.get("id"), amount_refunded, customer_email)

    return {"status": "success"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
