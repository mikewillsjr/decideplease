"""Email service for DecidePlease using Resend."""

import os
import resend
from typing import Optional

# Configuration
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "DecidePlease <noreply@decideplease.com>")
APP_URL = os.getenv("APP_URL", "https://decideplease.com")

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def is_configured() -> bool:
    """Check if email service is configured."""
    return bool(RESEND_API_KEY)


async def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None
) -> bool:
    """
    Send an email using Resend.

    Args:
        to: Recipient email address
        subject: Email subject
        html: HTML content
        text: Plain text fallback (optional)

    Returns:
        True if email was sent successfully, False otherwise
    """
    if not RESEND_API_KEY:
        print(f"[EMAIL] Resend not configured - would send to {to}: {subject}")
        return False

    try:
        params = {
            "from": FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html,
        }
        if text:
            params["text"] = text

        resend.Emails.send(params)
        print(f"[EMAIL] Sent to {to}: {subject}")
        return True
    except Exception as e:
        print(f"[EMAIL] Failed to send to {to}: {e}")
        return False


# ============== Email Templates ==============

def get_base_template(content: str) -> str:
    """Wrap content in base email template."""
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DecidePlease</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; line-height: 1.6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #e4e4e7;">
                            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #5d5dff;">DecidePlease</h1>
                            <p style="margin: 8px 0 0; font-size: 14px; color: #71717a;">AI Council for Better Decisions</p>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px;">
                            {content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 32px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 12px 12px;">
                            <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                                &copy; 2024 DecidePlease. All rights reserved.<br>
                                <a href="{APP_URL}/privacy" style="color: #5d5dff; text-decoration: none;">Privacy Policy</a> &bull;
                                <a href="{APP_URL}/terms" style="color: #5d5dff; text-decoration: none;">Terms of Service</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


async def send_password_reset_email(to: str, reset_token: str) -> bool:
    """Send password reset email."""
    reset_url = f"{APP_URL}/reset-password?token={reset_token}"

    content = f"""
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">Reset Your Password</h2>
    <p style="margin: 0 0 24px; color: #3f3f46;">
        We received a request to reset your password. Click the button below to choose a new password.
    </p>
    <p style="margin: 0 0 24px; text-align: center;">
        <a href="{reset_url}" style="display: inline-block; padding: 14px 32px; background-color: #5d5dff; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Reset Password
        </a>
    </p>
    <p style="margin: 0 0 16px; color: #71717a; font-size: 14px;">
        This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    </p>
    <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
        If the button doesn't work, copy and paste this link:<br>
        <a href="{reset_url}" style="color: #5d5dff; word-break: break-all;">{reset_url}</a>
    </p>
    """

    html = get_base_template(content)
    text = f"""
Reset Your Password

We received a request to reset your password. Visit this link to choose a new password:

{reset_url}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

- The DecidePlease Team
"""

    return await send_email(
        to=to,
        subject="Reset Your DecidePlease Password",
        html=html,
        text=text
    )


async def send_purchase_confirmation_email(
    to: str,
    amount_cents: int,
    credits: int
) -> bool:
    """Send purchase confirmation email."""
    amount_display = f"${amount_cents / 100:.2f}"

    content = f"""
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">Thank You for Your Purchase!</h2>
    <p style="margin: 0 0 24px; color: #3f3f46;">
        Your payment has been processed successfully. Here's your receipt:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px; background-color: #f4f4f5; border-radius: 8px;">
        <tr>
            <td style="padding: 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Credits Added</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #18181b;">{credits} credits</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e4e4e7; color: #71717a; font-size: 14px;">Amount Paid</td>
                        <td style="padding: 8px 0; border-top: 1px solid #e4e4e7; text-align: right; font-weight: 600; color: #18181b;">{amount_display}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    <p style="margin: 0 0 24px; text-align: center;">
        <a href="{APP_URL}" style="display: inline-block; padding: 14px 32px; background-color: #5d5dff; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Start Making Decisions
        </a>
    </p>
    <p style="margin: 0; color: #71717a; font-size: 14px;">
        Thank you for choosing DecidePlease! Your credits are ready to use.
    </p>
    """

    html = get_base_template(content)
    text = f"""
Thank You for Your Purchase!

Your payment has been processed successfully.

Credits Added: {credits} credits
Amount Paid: {amount_display}

Your credits are ready to use. Visit {APP_URL} to start making better decisions.

- The DecidePlease Team
"""

    return await send_email(
        to=to,
        subject=f"Receipt: {credits} Credits Purchased - DecidePlease",
        html=html,
        text=text
    )


async def send_refund_notification_email(
    to: str,
    amount_cents: int,
    credits: int
) -> bool:
    """Send refund notification email."""
    amount_display = f"${amount_cents / 100:.2f}"

    content = f"""
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">Refund Processed</h2>
    <p style="margin: 0 0 24px; color: #3f3f46;">
        We've processed a refund for your recent purchase. Here are the details:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px; background-color: #f4f4f5; border-radius: 8px;">
        <tr>
            <td style="padding: 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Amount Refunded</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #18181b;">{amount_display}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    <p style="margin: 0; color: #71717a; font-size: 14px;">
        The refund should appear on your statement within 5-10 business days, depending on your bank.
        If you have any questions, please contact us.
    </p>
    """

    html = get_base_template(content)
    text = f"""
Refund Processed

We've processed a refund for your recent purchase.

Amount Refunded: {amount_display}

The refund should appear on your statement within 5-10 business days, depending on your bank.

If you have any questions, please contact us.

- The DecidePlease Team
"""

    return await send_email(
        to=to,
        subject="Refund Processed - DecidePlease",
        html=html,
        text=text
    )


async def send_welcome_email(to: str) -> bool:
    """Send welcome email to new users."""
    content = f"""
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">Welcome to DecidePlease!</h2>
    <p style="margin: 0 0 24px; color: #3f3f46;">
        You've just unlocked the power of AI-assisted decision making. Here's how it works:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px;">
        <tr>
            <td style="padding: 16px; background-color: #f0f9ff; border-radius: 8px; margin-bottom: 12px;">
                <strong style="color: #0369a1;">1. Ask Your Question</strong>
                <p style="margin: 8px 0 0; color: #3f3f46; font-size: 14px;">Describe your decision or dilemma in detail.</p>
            </td>
        </tr>
        <tr><td style="height: 12px;"></td></tr>
        <tr>
            <td style="padding: 16px; background-color: #f0fdf4; border-radius: 8px; margin-bottom: 12px;">
                <strong style="color: #15803d;">2. Council Deliberates</strong>
                <p style="margin: 8px 0 0; color: #3f3f46; font-size: 14px;">Multiple AI models analyze your question independently.</p>
            </td>
        </tr>
        <tr><td style="height: 12px;"></td></tr>
        <tr>
            <td style="padding: 16px; background-color: #fef3c7; border-radius: 8px;">
                <strong style="color: #b45309;">3. Get Your Answer</strong>
                <p style="margin: 8px 0 0; color: #3f3f46; font-size: 14px;">Receive a synthesized recommendation from the council.</p>
            </td>
        </tr>
    </table>
    <p style="margin: 0 0 24px; text-align: center;">
        <a href="{APP_URL}" style="display: inline-block; padding: 14px 32px; background-color: #5d5dff; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Make Your First Decision
        </a>
    </p>
    <p style="margin: 0; color: #71717a; font-size: 14px;">
        You have <strong>5 free credits</strong> to get started. Each decision uses 1-3 credits depending on the analysis depth.
    </p>
    """

    html = get_base_template(content)
    text = f"""
Welcome to DecidePlease!

You've just unlocked the power of AI-assisted decision making. Here's how it works:

1. Ask Your Question - Describe your decision or dilemma in detail.
2. Council Deliberates - Multiple AI models analyze your question independently.
3. Get Your Answer - Receive a synthesized recommendation from the council.

You have 5 free credits to get started. Each decision uses 1-3 credits depending on the analysis depth.

Visit {APP_URL} to make your first decision!

- The DecidePlease Team
"""

    return await send_email(
        to=to,
        subject="Welcome to DecidePlease - Let's Make Better Decisions!",
        html=html,
        text=text
    )
