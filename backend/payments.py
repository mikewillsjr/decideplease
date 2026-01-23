"""Payment processing for DecidePlease using Stripe."""

import os
import stripe
from fastapi import HTTPException

# Initialize Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")  # Price ID for credit pack (legacy)

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# Credit pack configuration
CREDITS_PER_PURCHASE = int(os.getenv("CREDITS_PER_PURCHASE", "20"))
PRICE_DISPLAY = os.getenv("PRICE_DISPLAY", "$5.00")
PRICE_CENTS = int(os.getenv("PRICE_CENTS", "500"))  # $5.00 = 500 cents

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
                "app": "decideplease",
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
        "price_cents": PRICE_CENTS,
        "stripe_configured": bool(STRIPE_SECRET_KEY),
        "publishable_key": STRIPE_PUBLISHABLE_KEY,
    }


async def create_payment_intent(user_id: str, user_email: str) -> dict:
    """
    Create a Stripe PaymentIntent for purchasing credits.

    This is used with the Payment Element for custom checkout UI.
    Apple Pay and Google Pay are automatically available when enabled
    in the Stripe Dashboard with dynamic payment methods.

    Args:
        user_id: User ID (stored in metadata for webhook)
        user_email: User's email for receipt

    Returns:
        Dict with client_secret for Payment Element
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    try:
        # Create or retrieve customer
        customers = stripe.Customer.list(email=user_email, limit=1)
        if customers.data:
            customer = customers.data[0]
        else:
            customer = stripe.Customer.create(
                email=user_email,
                metadata={"app": "decideplease", "user_id": user_id}
            )

        # Create PaymentIntent with automatic payment methods
        # This enables Apple Pay, Google Pay, cards, etc. based on Dashboard settings
        intent = stripe.PaymentIntent.create(
            amount=PRICE_CENTS,
            currency="usd",
            customer=customer.id,
            # Don't specify payment_method_types - let Stripe choose based on Dashboard
            automatic_payment_methods={"enabled": True},
            metadata={
                "app": "decideplease",
                "user_id": user_id,
                "credits": str(CREDITS_PER_PURCHASE),
            },
            statement_descriptor=STATEMENT_DESCRIPTOR,
            receipt_email=user_email,
            description=f"{CREDITS_PER_PURCHASE} credits for DecidePlease",
        )

        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id,
            "amount": PRICE_CENTS,
            "credits": CREDITS_PER_PURCHASE,
        }

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


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


# ============== Saved Payment Methods ==============

MAX_SAVED_CARDS = 3


async def get_or_create_customer(user_id: str, user_email: str, existing_customer_id: str = None) -> str:
    """
    Get existing Stripe customer or create a new one.

    Args:
        user_id: Our user ID
        user_email: User's email
        existing_customer_id: Stripe customer ID from database (if exists)

    Returns:
        Stripe customer ID
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # If we already have a customer ID, verify it exists
    if existing_customer_id:
        try:
            customer = stripe.Customer.retrieve(existing_customer_id)
            if not customer.deleted:
                return customer.id
        except stripe.error.InvalidRequestError:
            pass  # Customer doesn't exist, create new one

    # Search by email first
    try:
        customers = stripe.Customer.list(email=user_email, limit=1)
        if customers.data:
            return customers.data[0].id
    except stripe.error.StripeError as e:
        # Log the error but continue to create a new customer
        print(f"[STRIPE] Customer search failed for {user_email}: {type(e).__name__}: {e}")

    # Create new customer
    try:
        customer = stripe.Customer.create(
            email=user_email,
            metadata={"app": "decideplease", "user_id": user_id}
        )
        return customer.id
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


async def list_payment_methods(customer_id: str) -> list:
    """
    List saved payment methods for a customer.

    Args:
        customer_id: Stripe customer ID

    Returns:
        List of payment methods with card details
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    try:
        methods = stripe.PaymentMethod.list(
            customer=customer_id,
            type="card",
            limit=MAX_SAVED_CARDS
        )

        return [
            {
                "id": pm.id,
                "brand": pm.card.brand,
                "last4": pm.card.last4,
                "exp_month": pm.card.exp_month,
                "exp_year": pm.card.exp_year,
                "is_default": pm.id == _get_default_payment_method(customer_id),
            }
            for pm in methods.data
        ]
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _get_default_payment_method(customer_id: str) -> str:
    """Get the customer's default payment method ID."""
    try:
        customer = stripe.Customer.retrieve(customer_id)
        return customer.invoice_settings.default_payment_method
    except:
        return None


async def create_setup_intent(customer_id: str) -> dict:
    """
    Create a SetupIntent for adding a new payment method.

    Args:
        customer_id: Stripe customer ID

    Returns:
        Dict with client_secret for SetupIntent
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Check current card count
    try:
        existing = stripe.PaymentMethod.list(customer=customer_id, type="card", limit=MAX_SAVED_CARDS)
        if len(existing.data) >= MAX_SAVED_CARDS:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum of {MAX_SAVED_CARDS} cards allowed. Please remove a card first."
            )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        setup_intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=["card"],
            usage="off_session",  # Allow charging later without customer present
        )

        return {
            "client_secret": setup_intent.client_secret,
            "setup_intent_id": setup_intent.id,
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


async def detach_payment_method(payment_method_id: str, customer_id: str) -> bool:
    """
    Detach (delete) a payment method from customer.

    Args:
        payment_method_id: Stripe payment method ID
        customer_id: Stripe customer ID (for verification)

    Returns:
        True if successful
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    try:
        # Verify the payment method belongs to this customer
        pm = stripe.PaymentMethod.retrieve(payment_method_id)
        if pm.customer != customer_id:
            raise HTTPException(status_code=403, detail="Payment method does not belong to this customer")

        stripe.PaymentMethod.detach(payment_method_id)
        return True
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


async def set_default_payment_method(payment_method_id: str, customer_id: str) -> bool:
    """
    Set a payment method as the default for the customer.

    Args:
        payment_method_id: Stripe payment method ID
        customer_id: Stripe customer ID

    Returns:
        True if successful
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    try:
        # Verify the payment method belongs to this customer
        pm = stripe.PaymentMethod.retrieve(payment_method_id)
        if pm.customer != customer_id:
            raise HTTPException(status_code=403, detail="Payment method does not belong to this customer")

        stripe.Customer.modify(
            customer_id,
            invoice_settings={"default_payment_method": payment_method_id}
        )
        return True
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


async def charge_with_saved_cards(
    user_id: str,
    user_email: str,
    customer_id: str,
    preferred_method_id: str = None
) -> dict:
    """
    Attempt to charge using saved cards with automatic fallback.

    Tries the preferred card first, then falls back to other saved cards.
    If all saved cards fail, returns error with option to add new card.

    Args:
        user_id: Our user ID
        user_email: User's email
        customer_id: Stripe customer ID
        preferred_method_id: Optional preferred payment method to try first

    Returns:
        Dict with payment result and payment_intent details
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Get all saved payment methods
    try:
        methods = stripe.PaymentMethod.list(customer=customer_id, type="card", limit=MAX_SAVED_CARDS)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not methods.data:
        return {
            "success": False,
            "error": "no_saved_cards",
            "message": "No saved payment methods. Please add a card.",
        }

    # Order: preferred first, then default, then others
    ordered_methods = []
    default_pm = _get_default_payment_method(customer_id)

    for pm in methods.data:
        if preferred_method_id and pm.id == preferred_method_id:
            ordered_methods.insert(0, pm)
        elif pm.id == default_pm:
            ordered_methods.insert(0 if not preferred_method_id else 1, pm)
        else:
            ordered_methods.append(pm)

    # Try each card
    errors = []
    for pm in ordered_methods:
        try:
            intent = stripe.PaymentIntent.create(
                amount=PRICE_CENTS,
                currency="usd",
                customer=customer_id,
                payment_method=pm.id,
                off_session=True,
                confirm=True,
                metadata={
                    "app": "decideplease",
                    "user_id": user_id,
                    "credits": str(CREDITS_PER_PURCHASE),
                },
                statement_descriptor=STATEMENT_DESCRIPTOR,
                receipt_email=user_email,
                description=f"{CREDITS_PER_PURCHASE} credits for DecidePlease",
            )

            if intent.status == "succeeded":
                return {
                    "success": True,
                    "payment_intent_id": intent.id,
                    "payment_method_used": pm.id,
                    "card_brand": pm.card.brand,
                    "card_last4": pm.card.last4,
                    "amount": PRICE_CENTS,
                    "credits": CREDITS_PER_PURCHASE,
                }

        except stripe.error.CardError as e:
            errors.append({
                "payment_method_id": pm.id,
                "card_last4": pm.card.last4,
                "error": e.user_message or str(e),
            })
            continue  # Try next card

        except stripe.error.StripeError as e:
            errors.append({
                "payment_method_id": pm.id,
                "card_last4": pm.card.last4,
                "error": str(e),
            })
            continue

    # All cards failed
    return {
        "success": False,
        "error": "all_cards_failed",
        "message": "All saved cards failed. Please add a new card or try a different payment method.",
        "failed_attempts": errors,
    }


# ============== Overage & Pay-Per-Use Charging ==============

from .config import OVERAGE_PRICING, PAYPERUSE_PRICING


def get_overage_price_cents(plan: str, mode: str) -> int | None:
    """
    Get overage price in cents for a subscriber's plan and decision mode.

    Args:
        plan: Subscription plan (starter, professional, team)
        mode: Decision mode (quick_decision, decide_please, decide_pretty_please)

    Returns:
        Price in cents, or None if no overage allowed (hard cap)
    """
    if plan not in OVERAGE_PRICING:
        return None

    price_dollars = OVERAGE_PRICING[plan].get(mode)
    if price_dollars is None:
        return None  # Hard cap, no overages

    return int(price_dollars * 100)  # Convert to cents


def get_payperuse_price_cents(mode: str) -> int:
    """
    Get pay-per-use price in cents for a decision mode.

    Args:
        mode: Decision mode (quick_decision, decide_please, decide_pretty_please)

    Returns:
        Price in cents
    """
    return PAYPERUSE_PRICING.get(mode, 0)


async def charge_overage(
    user_id: str,
    user_email: str,
    customer_id: str,
    mode: str,
    plan: str,
    payment_method_id: str = None
) -> dict:
    """
    Charge a subscriber for an overage decision.

    Args:
        user_id: Our user ID
        user_email: User's email
        customer_id: Stripe customer ID
        mode: Decision mode being charged
        plan: User's subscription plan
        payment_method_id: Optional specific card to charge

    Returns:
        Dict with payment result
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    price_cents = get_overage_price_cents(plan, mode)
    if price_cents is None:
        return {
            "success": False,
            "error": "no_overage_allowed",
            "message": "This decision type does not allow overages. Please upgrade your plan.",
        }

    # Get mode label for description
    mode_labels = {
        "quick_decision": "Quick Decision",
        "decide_please": "Standard Decision",
        "decide_pretty_please": "Premium Decision",
    }
    mode_label = mode_labels.get(mode, mode)

    try:
        # If no specific payment method, use default
        if not payment_method_id:
            payment_method_id = _get_default_payment_method(customer_id)

        if not payment_method_id:
            # No default, try to get any saved card
            methods = stripe.PaymentMethod.list(customer=customer_id, type="card", limit=1)
            if methods.data:
                payment_method_id = methods.data[0].id
            else:
                return {
                    "success": False,
                    "error": "no_payment_method",
                    "message": "No payment method available. Please add a card.",
                }

        intent = stripe.PaymentIntent.create(
            amount=price_cents,
            currency="usd",
            customer=customer_id,
            payment_method=payment_method_id,
            off_session=True,
            confirm=True,
            metadata={
                "app": "decideplease",
                "user_id": user_id,
                "charge_type": "overage",
                "mode": mode,
                "plan": plan,
            },
            statement_descriptor=STATEMENT_DESCRIPTOR,
            receipt_email=user_email,
            description=f"DecidePlease {mode_label} Overage",
        )

        if intent.status == "succeeded":
            return {
                "success": True,
                "payment_intent_id": intent.id,
                "amount_cents": price_cents,
                "mode": mode,
            }
        else:
            return {
                "success": False,
                "error": "payment_incomplete",
                "message": f"Payment status: {intent.status}",
                "payment_intent_id": intent.id,
            }

    except stripe.error.CardError as e:
        return {
            "success": False,
            "error": "card_declined",
            "message": e.user_message or str(e),
        }
    except stripe.error.StripeError as e:
        return {
            "success": False,
            "error": "payment_failed",
            "message": str(e),
        }


async def charge_payperuse(
    user_id: str,
    user_email: str,
    customer_id: str,
    mode: str,
    payment_method_id: str = None
) -> dict:
    """
    Charge a non-subscriber for a single pay-per-use decision.

    Args:
        user_id: Our user ID
        user_email: User's email
        customer_id: Stripe customer ID
        mode: Decision mode being charged
        payment_method_id: Optional specific card to charge

    Returns:
        Dict with payment result
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    price_cents = get_payperuse_price_cents(mode)
    if price_cents <= 0:
        return {
            "success": False,
            "error": "invalid_mode",
            "message": "Invalid decision mode for pay-per-use.",
        }

    # Get mode label for description
    mode_labels = {
        "quick_decision": "Quick Decision",
        "decide_please": "Standard Decision",
        "decide_pretty_please": "Premium Decision",
    }
    mode_label = mode_labels.get(mode, mode)

    try:
        # If no specific payment method, use default
        if not payment_method_id:
            payment_method_id = _get_default_payment_method(customer_id)

        if not payment_method_id:
            # No default, try to get any saved card
            methods = stripe.PaymentMethod.list(customer=customer_id, type="card", limit=1)
            if methods.data:
                payment_method_id = methods.data[0].id
            else:
                return {
                    "success": False,
                    "error": "no_payment_method",
                    "message": "No payment method available. Please add a card.",
                }

        intent = stripe.PaymentIntent.create(
            amount=price_cents,
            currency="usd",
            customer=customer_id,
            payment_method=payment_method_id,
            off_session=True,
            confirm=True,
            metadata={
                "app": "decideplease",
                "user_id": user_id,
                "charge_type": "payperuse",
                "mode": mode,
            },
            statement_descriptor=STATEMENT_DESCRIPTOR,
            receipt_email=user_email,
            description=f"DecidePlease {mode_label}",
        )

        if intent.status == "succeeded":
            return {
                "success": True,
                "payment_intent_id": intent.id,
                "amount_cents": price_cents,
                "mode": mode,
            }
        else:
            return {
                "success": False,
                "error": "payment_incomplete",
                "message": f"Payment status: {intent.status}",
                "payment_intent_id": intent.id,
            }

    except stripe.error.CardError as e:
        return {
            "success": False,
            "error": "card_declined",
            "message": e.user_message or str(e),
        }
    except stripe.error.StripeError as e:
        return {
            "success": False,
            "error": "payment_failed",
            "message": str(e),
        }
