"""Payment processing for DecidePlease using Stripe."""

import os
import stripe
from fastapi import HTTPException

# Initialize Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")  # Price ID for credit pack

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# Credit pack configuration
CREDITS_PER_PURCHASE = int(os.getenv("CREDITS_PER_PURCHASE", "20"))
PRICE_DISPLAY = os.getenv("PRICE_DISPLAY", "$5.00")

# Statement descriptor - what appears on customer credit card statements
# Max 22 characters, must be ASCII, no special characters except space
STATEMENT_DESCRIPTOR = os.getenv("STRIPE_STATEMENT_DESCRIPTOR", "DECIDEPLEASE")


async def create_checkout_session(user_id: str, user_email: str, success_url: str, cancel_url: str) -> dict:
    """
    Create a Stripe Checkout session for purchasing credits.

    Args:
        user_id: Clerk user ID (stored in metadata for webhook)
        user_email: User's email for Stripe
        success_url: URL to redirect on success
        cancel_url: URL to redirect on cancel

    Returns:
        Dict with checkout session URL
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    if not STRIPE_PRICE_ID:
        raise HTTPException(status_code=500, detail="Stripe price not configured")

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price": STRIPE_PRICE_ID,
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=user_email,
            metadata={
                "user_id": user_id,
                "credits": str(CREDITS_PER_PURCHASE),
            },
            allow_promotion_codes=True,
            payment_intent_data={
                "statement_descriptor": STATEMENT_DESCRIPTOR,
            },
        )

        return {
            "checkout_url": session.url,
            "session_id": session.id,
        }

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


def verify_webhook_signature(payload: bytes, signature: str) -> dict:
    """
    Verify Stripe webhook signature and return event.

    Args:
        payload: Raw request body
        signature: Stripe-Signature header value

    Returns:
        Verified Stripe event
    """
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, signature, STRIPE_WEBHOOK_SECRET
        )
        return event
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")


def get_credit_pack_info() -> dict:
    """Get information about the credit pack for display."""
    return {
        "credits": CREDITS_PER_PURCHASE,
        "price_display": PRICE_DISPLAY,
        "stripe_configured": bool(STRIPE_SECRET_KEY and STRIPE_PRICE_ID),
    }


async def send_payment_email(email: str, event_type: str, amount: int, credits: int):
    """
    Send custom payment emails branded for DecidePlease using Resend.

    Args:
        email: Customer email address
        event_type: 'purchase' or 'refund'
        amount: Amount in cents
        credits: Number of credits purchased/refunded
    """
    from .email import send_purchase_confirmation_email, send_refund_notification_email

    if event_type == 'purchase':
        await send_purchase_confirmation_email(email, amount, credits)
    elif event_type == 'refund':
        await send_refund_notification_email(email, amount, credits)
    else:
        print(f"[EMAIL] Unknown event type: {event_type}")


async def handle_refund(charge_id: str, amount_refunded: int, user_email: str):
    """
    Handle a refund event - optionally deduct credits and send email.

    Args:
        charge_id: Stripe charge ID
        amount_refunded: Amount refunded in cents
        user_email: Customer email for notification
    """
    # Note: We don't automatically deduct credits on refund since:
    # 1. User may have already used some credits
    # 2. Partial refunds are complex
    # 3. Better to handle manually or implement credit tracking per purchase

    print(f"[REFUND] Charge {charge_id} refunded ${amount_refunded/100:.2f} to {user_email}")

    # Send custom refund email (when implemented)
    await send_payment_email(
        email=user_email,
        event_type='refund',
        amount=amount_refunded,
        credits=CREDITS_PER_PURCHASE  # Approximate - ideally track per purchase
    )
