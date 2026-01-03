"""FastAPI backend for DecidePlease."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
import json
import asyncio
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from . import storage_pg as storage
from .database import init_database, close_pool
from .auth_custom import (
    get_current_user,
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    AuthResponse,
    OAUTH_ENABLED,
    JWT_SECRET,
)
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
    run_council_with_mode,
    generate_conversation_title,
    stage1_collect_responses,
    stage2_collect_rankings,
    stage3_synthesize_final,
    calculate_aggregate_rankings,
    extract_tldr_packet
)
from .config import RUN_MODES
from .admin import router as admin_router, ADMIN_EMAILS


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

# Rate limiting configuration
# Uses IP address for rate limiting key
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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

# Request body size limit (100KB max for regular requests)
MAX_BODY_SIZE = 100 * 1024  # 100KB
MAX_QUERY_LENGTH = 10000  # 10,000 characters max for user queries

@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    """Middleware to limit request body size."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_SIZE:
        return JSONResponse(
            status_code=413,
            content={"detail": "Request body too large. Maximum size is 100KB."}
        )
    return await call_next(request)

# Include admin router
app.include_router(admin_router)


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    pass


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str
    mode: str = "standard"  # "quick", "standard", or "extra_care"


class RerunRequest(BaseModel):
    """Request to rerun a decision."""
    mode: str = "standard"  # "quick", "standard", or "extra_care"
    new_input: Optional[str] = None  # Empty = second opinion, non-empty = refinement


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


# ============== Authentication Endpoints ==============

@app.post("/api/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, reg_request: RegisterRequest):
    """
    Register a new user with email and password.
    Returns access and refresh tokens.
    """
    # Validate password strength
    if len(reg_request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Hash password and create user
    password_hash = hash_password(reg_request.password)

    try:
        user = await storage.create_user_with_password(reg_request.email, password_hash)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Generate tokens
    access_token = create_access_token(user["id"], user["email"])
    refresh_token = create_refresh_token(user["id"])

    # Send welcome email (fire and forget - don't block registration)
    from .email import send_welcome_email
    asyncio.create_task(send_welcome_email(user["email"], user["credits"]))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "credits": user["credits"],
            "email_verified": user["email_verified"]
        }
    }


@app.post("/api/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, login_request: LoginRequest):
    """
    Login with email and password.
    Returns access and refresh tokens.
    """
    # Get user by email
    user = await storage.get_user_by_email(login_request.email)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check if user has a password (might be OAuth-only user)
    if not user.get("password_hash"):
        raise HTTPException(
            status_code=401,
            detail="This account uses social login. Please sign in with your social provider."
        )

    # Verify password
    if not verify_password(login_request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Generate tokens
    access_token = create_access_token(user["id"], user["email"])
    refresh_token = create_refresh_token(user["id"])

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "credits": user["credits"],
            "email_verified": user["email_verified"]
        }
    }


@app.post("/api/auth/refresh")
async def refresh_token(request: RefreshRequest):
    """
    Refresh an access token using a refresh token.
    """
    # Verify refresh token
    payload = verify_token(request.refresh_token, token_type="refresh")

    # Get user
    user = await storage.get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Generate new access token
    access_token = create_access_token(user["id"], user["email"])

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@app.get("/api/auth/me")
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """
    Get the current authenticated user's information.
    """
    user_data = await storage.get_user_by_id(user["user_id"])
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user_data["id"],
        "email": user_data["email"],
        "credits": user_data["credits"],
        "email_verified": user_data["email_verified"]
    }


@app.get("/api/auth/oauth/providers")
async def get_oauth_providers():
    """
    Get list of available OAuth providers.
    Returns empty list if OAuth is disabled.
    """
    if not OAUTH_ENABLED:
        return {"providers": [], "oauth_enabled": False}

    # Return enabled providers (none for now)
    return {"providers": [], "oauth_enabled": False}


class ForgotPasswordRequest(BaseModel):
    """Request to initiate password reset."""
    email: str


class ResetPasswordRequest(BaseModel):
    """Request to reset password with token."""
    token: str
    password: str


@app.post("/api/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, forgot_request: ForgotPasswordRequest):
    """
    Request a password reset email.
    Always returns success to prevent email enumeration.
    """
    from .email import send_password_reset_email
    import secrets

    email = forgot_request.email.lower().strip()

    # Check if user exists
    user = await storage.get_user_by_email(email)

    if user and user.get("password_hash"):
        # Generate a password reset token (JWT with short expiry)
        from datetime import datetime, timedelta, timezone
        from jose import jwt

        reset_token = jwt.encode(
            {
                "sub": user["id"],
                "email": email,
                "type": "password_reset",
                "exp": datetime.now(timezone.utc) + timedelta(hours=1),
                "jti": secrets.token_urlsafe(16),
            },
            JWT_SECRET,
            algorithm="HS256"
        )

        # Send reset email
        await send_password_reset_email(email, reset_token)

    # Always return success to prevent email enumeration
    return {"message": "If an account exists with this email, a password reset link has been sent."}


@app.post("/api/auth/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, reset_request: ResetPasswordRequest):
    """
    Reset password using a valid reset token.
    """
    from jose import jwt, JWTError

    # Validate password strength
    if len(reset_request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Verify token
    try:
        payload = jwt.decode(reset_request.token, JWT_SECRET, algorithms=["HS256"])

        # Check token type
        if payload.get("type") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid reset token")

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    # Get user and verify they still exist
    user = await storage.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    # Hash new password and update
    new_password_hash = hash_password(reset_request.password)
    await storage.update_user_password(user_id, new_password_hash)

    # Send password changed confirmation email
    from .email import send_password_changed_email
    asyncio.create_task(send_password_changed_email(user["email"]))

    return {"message": "Password has been reset successfully. You can now log in with your new password."}


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


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: dict = Depends(get_current_user)
):
    """Delete a conversation and all its messages."""
    success = await storage.delete_conversation(conversation_id, user["user_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}


@app.post("/api/conversations/{conversation_id}/message")
@limiter.limit("3/minute")
async def send_message(
    request: Request,
    conversation_id: str,
    msg_request: SendMessageRequest,
    user: dict = Depends(get_current_user)
):
    """
    Send a message and run the 3-stage council process.
    Returns the complete response with all stages.
    """
    # Validate query length
    if len(msg_request.content) > MAX_QUERY_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Query too long. Maximum length is {MAX_QUERY_LENGTH} characters."
        )

    # Check if conversation exists and belongs to user
    conversation = await storage.get_conversation(conversation_id, user["user_id"])
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if user is admin (admins get unlimited usage)
    user_email = user.get("email", "").lower()
    is_admin = user_email in ADMIN_EMAILS

    # Check and deduct credits (skip for admins)
    if not is_admin:
        credits = await storage.get_user_credits(user["user_id"])
        if credits <= 0:
            raise HTTPException(status_code=402, detail="Insufficient credits")
        if not await storage.deduct_credit(user["user_id"]):
            raise HTTPException(status_code=402, detail="Insufficient credits")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    # Add user message
    await storage.add_user_message(conversation_id, msg_request.content)

    # If this is the first message, generate a title
    if is_first_message:
        title = await generate_conversation_title(msg_request.content)
        await storage.update_conversation_title(conversation_id, title)

    # Run the 3-stage council process
    stage1_results, stage2_results, stage3_result, metadata = await run_full_council(
        msg_request.content
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


# Track active processing tasks so they continue even if client disconnects
_active_tasks: Dict[str, asyncio.Task] = {}
# Track current stage for each active conversation (for status endpoint)
_active_status: Dict[str, str] = {}


async def _process_council_request(
    conversation_id: str,
    content: str,
    user_id: str,
    is_first_message: bool,
    event_queue: asyncio.Queue,
    mode: str = "standard",
    is_rerun: bool = False,
    rerun_input: Optional[str] = None,
    parent_message_id: Optional[int] = None,
    context_packet: Optional[Dict[str, Any]] = None
):
    """
    Background task to process the council request.
    Saves progress incrementally and pushes events to the queue.
    Continues running even if client disconnects.
    """
    message_id = None

    # Validate and get mode config
    if mode not in RUN_MODES:
        mode = "standard"
    mode_config = RUN_MODES[mode]

    try:
        # Add user message only for non-reruns
        if not is_rerun:
            await storage.add_user_message(conversation_id, content)

        # Create pending assistant message with mode info
        message_id = await storage.create_pending_assistant_message_with_mode(
            conversation_id,
            mode=mode,
            is_rerun=is_rerun,
            rerun_input=rerun_input,
            parent_message_id=parent_message_id
        )

        # Send initial event with mode info and remaining credits
        remaining_credits = await storage.get_user_credits(user_id)
        await event_queue.put({
            'type': 'run_started',
            'mode': mode,
            'credit_cost': mode_config['credit_cost'],
            'enable_peer_review': mode_config['enable_peer_review'],
            'updated_credits': remaining_credits,
            'is_rerun': is_rerun
        })

        # Start title generation in parallel (only for first message, non-reruns)
        title_task = None
        if is_first_message and not is_rerun:
            title_task = asyncio.create_task(generate_conversation_title(content))

        council_models = mode_config["council_models"]
        chairman_model = mode_config["chairman_model"]
        enable_peer_review = mode_config["enable_peer_review"]

        # Build effective query for reruns
        effective_content = content
        if is_rerun and context_packet:
            from .council import build_rerun_query
            effective_content = build_rerun_query(content, context_packet, rerun_input)

        # Stage 1: Collect responses
        _active_status[conversation_id] = "stage1"
        await event_queue.put({'type': 'stage1_start'})
        stage1_results = await stage1_collect_responses(effective_content, council_models)
        await storage.update_assistant_message_stage(message_id, 'stage1', stage1_results)
        await event_queue.put({'type': 'stage1_complete', 'data': stage1_results})

        # Stage 2: Collect rankings (skip if peer review disabled)
        stage2_results = []
        label_to_model = {}
        aggregate_rankings = []

        if enable_peer_review:
            _active_status[conversation_id] = "stage2"
            await event_queue.put({'type': 'stage2_start'})
            stage2_results, label_to_model = await stage2_collect_rankings(
                effective_content, stage1_results, council_models
            )
            aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
            await storage.update_assistant_message_stage(message_id, 'stage2', stage2_results)
            await event_queue.put({
                'type': 'stage2_complete',
                'data': stage2_results,
                'metadata': {'label_to_model': label_to_model, 'aggregate_rankings': aggregate_rankings}
            })
        else:
            # Emit skipped event for Quick mode
            await event_queue.put({'type': 'stage2_skipped', 'reason': 'Quick mode - peer review disabled'})
            await storage.update_assistant_message_stage(message_id, 'stage2', [])

        # Stage 3: Synthesize final answer
        _active_status[conversation_id] = "stage3"
        await event_queue.put({'type': 'stage3_start'})
        stage3_result = await stage3_synthesize_final(
            effective_content, stage1_results, stage2_results, chairman_model
        )
        await storage.update_assistant_message_stage(message_id, 'stage3', stage3_result)
        await event_queue.put({
            'type': 'stage3_complete',
            'data': stage3_result,
            'metadata': {
                'label_to_model': label_to_model,
                'aggregate_rankings': aggregate_rankings,
                'mode': mode,
                'enable_peer_review': enable_peer_review
            }
        })

        # Wait for title generation
        if title_task:
            title = await title_task
            await storage.update_conversation_title(conversation_id, title)
            await event_queue.put({'type': 'title_complete', 'data': {'title': title}})

        # Get final credits
        remaining_credits = await storage.get_user_credits(user_id)
        await event_queue.put({
            'type': 'complete',
            'credits': remaining_credits,
            'mode': mode,
            'message_id': message_id
        })

    except Exception as e:
        await event_queue.put({'type': 'error', 'message': str(e)})
    finally:
        # Signal completion
        await event_queue.put(None)
        # Remove from active tasks and status
        _active_tasks.pop(conversation_id, None)
        _active_status.pop(conversation_id, None)


@app.post("/api/conversations/{conversation_id}/message/stream")
@limiter.limit("3/minute")
async def send_message_stream(
    request: Request,
    conversation_id: str,
    msg_request: SendMessageRequest,
    user: dict = Depends(get_current_user)
):
    """
    Send a message and stream the 3-stage council process.
    Returns Server-Sent Events as each stage completes.
    Processing continues in background even if client disconnects.
    """
    # Validate query length
    if len(msg_request.content) > MAX_QUERY_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Query too long. Maximum length is {MAX_QUERY_LENGTH} characters."
        )

    # Validate mode
    mode = msg_request.mode if msg_request.mode in RUN_MODES else "standard"
    mode_config = RUN_MODES[mode]
    credit_cost = mode_config["credit_cost"]

    # Check if conversation exists and belongs to user
    conversation = await storage.get_conversation(conversation_id, user["user_id"])
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if user is admin (admins get unlimited usage)
    user_email = user.get("email", "").lower()
    is_admin = user_email in ADMIN_EMAILS

    # Check and deduct credits based on mode cost (skip for admins)
    remaining_credits = None
    if not is_admin:
        credits = await storage.get_user_credits(user["user_id"])
        if credits < credit_cost:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. Need {credit_cost}, have {credits}."
            )
        success, remaining_credits = await storage.deduct_credits_and_get_remaining(user["user_id"], credit_cost)
        if not success:
            raise HTTPException(status_code=402, detail="Insufficient credits")

        # Send low credits email if user is running low (1 or 0 credits remaining)
        if remaining_credits <= 1:
            from .email import send_low_credits_email
            asyncio.create_task(send_low_credits_email(user["email"], remaining_credits))

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    # Create event queue for communication between background task and SSE
    event_queue: asyncio.Queue = asyncio.Queue()

    # Start background processing task
    task = asyncio.create_task(_process_council_request(
        conversation_id,
        msg_request.content,
        user["user_id"],
        is_first_message,
        event_queue,
        mode=mode
    ))
    _active_tasks[conversation_id] = task

    async def event_generator():
        try:
            while True:
                # Wait for next event from background task
                event = await event_queue.get()
                if event is None:
                    # Processing complete
                    break
                yield f"data: {json.dumps(event)}\n\n"
        except asyncio.CancelledError:
            # Client disconnected, but background task continues
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.get("/api/conversations/{conversation_id}/status")
async def get_conversation_status(
    conversation_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Check if a conversation is currently being processed.
    Returns the current stage if processing, or null if complete.
    """
    # Verify ownership
    conversation = await storage.get_conversation(conversation_id, user["user_id"])
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation_id in _active_tasks:
        return {
            "processing": True,
            "current_stage": _active_status.get(conversation_id, "starting")
        }
    return {
        "processing": False,
        "current_stage": None
    }


# ============== Rerun Endpoints ==============

@app.post("/api/conversations/{conversation_id}/rerun")
async def rerun_decision(
    conversation_id: str,
    request: RerunRequest,
    user: dict = Depends(get_current_user)
):
    """
    Rerun a decision with optional new input.
    Streams the response like send_message_stream.
    """
    # Validate mode
    mode = request.mode if request.mode in RUN_MODES else "standard"
    mode_config = RUN_MODES[mode]
    credit_cost = mode_config["credit_cost"]

    # Check if conversation exists and belongs to user
    conversation = await storage.get_conversation(conversation_id, user["user_id"])
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get the original user message (the decision question)
    original_question = await storage.get_original_user_message(conversation_id)
    if not original_question:
        raise HTTPException(status_code=400, detail="No original decision found to rerun")

    # Get the latest assistant message for context
    latest_message = await storage.get_latest_assistant_message(conversation_id)
    if not latest_message:
        raise HTTPException(status_code=400, detail="No previous decision result found")

    # Extract TL;DR context packet from the latest result
    stage3_response = latest_message.get("stage3", {}).get("response", "")
    context_packet = extract_tldr_packet(stage3_response)

    # Check if user is admin (admins get unlimited usage)
    user_email = user.get("email", "").lower()
    is_admin = user_email in ADMIN_EMAILS

    # Check and deduct credits based on mode cost (skip for admins)
    if not is_admin:
        credits = await storage.get_user_credits(user["user_id"])
        if credits < credit_cost:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. Need {credit_cost}, have {credits}."
            )
        success, remaining_credits = await storage.deduct_credits_and_get_remaining(user["user_id"], credit_cost)
        if not success:
            raise HTTPException(status_code=402, detail="Insufficient credits")

        # Send low credits email if user is running low (1 or 0 credits remaining)
        if remaining_credits <= 1:
            from .email import send_low_credits_email
            asyncio.create_task(send_low_credits_email(user["email"], remaining_credits))

    # Create event queue for SSE
    event_queue: asyncio.Queue = asyncio.Queue()

    # Determine the parent message ID (use the original, not a rerun)
    parent_message_id = latest_message["id"]
    if latest_message.get("parent_message_id"):
        parent_message_id = latest_message["parent_message_id"]

    # Start background processing task
    task = asyncio.create_task(_process_council_request(
        conversation_id,
        original_question,
        user["user_id"],
        is_first_message=False,
        event_queue=event_queue,
        mode=mode,
        is_rerun=True,
        rerun_input=request.new_input,
        parent_message_id=parent_message_id,
        context_packet=context_packet
    ))
    _active_tasks[conversation_id] = task

    async def event_generator():
        try:
            while True:
                event = await event_queue.get()
                if event is None:
                    break
                yield f"data: {json.dumps(event)}\n\n"
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.get("/api/conversations/{conversation_id}/revisions/{message_id}")
async def get_revisions(
    conversation_id: str,
    message_id: int,
    user: dict = Depends(get_current_user)
):
    """
    Get all revisions for a specific decision message.
    """
    # Verify conversation ownership
    conversation = await storage.get_conversation(conversation_id, user["user_id"])
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    revisions = await storage.get_message_revisions(conversation_id, message_id)
    return {"revisions": revisions}


@app.get("/api/run-modes")
async def get_run_modes():
    """
    Get available run modes and their configurations.
    """
    return {
        mode: {
            "label": config["label"],
            "credit_cost": config["credit_cost"],
            "enable_peer_review": config["enable_peer_review"],
        }
        for mode, config in RUN_MODES.items()
    }


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
        amount_cents = session.get("amount_total", 500)

        # Record payment in database
        await storage.record_payment(
            user_id=user_id,
            stripe_session_id=session.get("id"),
            stripe_payment_intent=session.get("payment_intent"),
            amount_cents=amount_cents,
            credits=credits_to_add
        )

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
