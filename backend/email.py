"""Email service for DecidePlease using Resend."""

import os
from datetime import datetime
import resend
from typing import Optional

# Configuration
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "DecidePlease <noreply@decideplease.com>")
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "support@decideplease.com")
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

def get_base_template(content: str, preheader: str = "") -> str:
    """Wrap content in base email template."""
    current_year = datetime.now().year

    # Preheader is hidden text that appears in email previews
    preheader_html = ""
    if preheader:
        preheader_html = f"""
        <div style="display: none; max-height: 0; overflow: hidden;">
            {preheader}
        </div>
        <div style="display: none; max-height: 0; overflow: hidden;">
            &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
        </div>
        """

    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>DecidePlease</title>
    <!--[if mso]>
    <style type="text/css">
        table {{ border-collapse: collapse; }}
        .button {{ padding: 14px 32px !important; }}
    </style>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; line-height: 1.6; -webkit-font-smoothing: antialiased;">
    {preheader_html}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 32px; text-align: center; border-bottom: 1px solid #e4e4e7;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #5d5dff; letter-spacing: -0.5px;">DecidePlease</h1>
                            <p style="margin: 8px 0 0; font-size: 14px; color: #71717a;">AI Council for Better Decisions</p>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            {content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 32px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 16px 16px;">
                            <p style="margin: 0 0 12px; font-size: 13px; color: #71717a; text-align: center;">
                                Questions? Contact us at <a href="mailto:{SUPPORT_EMAIL}" style="color: #5d5dff; text-decoration: none;">{SUPPORT_EMAIL}</a>
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                                &copy; {current_year} DecidePlease. All rights reserved.<br>
                                <a href="{APP_URL}/privacy" style="color: #71717a; text-decoration: none;">Privacy Policy</a> &bull;
                                <a href="{APP_URL}/terms" style="color: #71717a; text-decoration: none;">Terms of Service</a>
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


def get_button(text: str, url: str, color: str = "#5d5dff") -> str:
    """Generate a styled button."""
    return f"""
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
        <tr>
            <td style="border-radius: 8px; background-color: {color};">
                <a href="{url}" class="button" style="display: inline-block; padding: 16px 36px; background-color: {color}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center;">
                    {text}
                </a>
            </td>
        </tr>
    </table>
    """


# ============== Welcome Email ==============

async def send_welcome_email(to: str, credits: int = 5) -> bool:
    """Send welcome email to new users."""
    preheader = f"You have {credits} free credits to start making better decisions with AI"

    content = f"""
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Welcome to DecidePlease! 🎉</h2>
    <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px;">
        You've just unlocked the power of AI-assisted decision making. Our council of AI models will analyze your questions from multiple perspectives to help you make better choices.
    </p>

    <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #18181b;">Here's how it works:</h3>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 32px;">
        <tr>
            <td style="padding: 20px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; border-left: 4px solid #3b82f6;">
                <strong style="color: #1e40af; font-size: 15px;">1. Ask Your Question</strong>
                <p style="margin: 8px 0 0; color: #3f3f46; font-size: 14px;">Describe your decision, dilemma, or question in as much detail as you'd like.</p>
            </td>
        </tr>
        <tr><td style="height: 12px;"></td></tr>
        <tr>
            <td style="padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; border-left: 4px solid #22c55e;">
                <strong style="color: #166534; font-size: 15px;">2. The Council Deliberates</strong>
                <p style="margin: 8px 0 0; color: #3f3f46; font-size: 14px;">Multiple AI models analyze your question independently, then peer-review each other's responses.</p>
            </td>
        </tr>
        <tr><td style="height: 12px;"></td></tr>
        <tr>
            <td style="padding: 20px; background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%); border-radius: 12px; border-left: 4px solid #eab308;">
                <strong style="color: #a16207; font-size: 15px;">3. Get Your Answer</strong>
                <p style="margin: 8px 0 0; color: #3f3f46; font-size: 14px;">Receive a synthesized recommendation that incorporates the best insights from the entire council.</p>
            </td>
        </tr>
    </table>

    <p style="margin: 0 0 8px; text-align: center; color: #3f3f46; font-size: 15px;">
        You have <strong style="color: #5d5dff;">{credits} free credits</strong> to get started!
    </p>
    <p style="margin: 0 0 24px; text-align: center; color: #71717a; font-size: 14px;">
        Each decision uses 1-3 credits depending on analysis depth.
    </p>

    <p style="margin: 0 0 32px; text-align: center;">
        {get_button("Make Your First Decision", APP_URL)}
    </p>

    <p style="margin: 0; color: #71717a; font-size: 14px; text-align: center;">
        We're excited to help you make better decisions!
    </p>
    """

    html = get_base_template(content, preheader)
    text = f"""
Welcome to DecidePlease! 🎉

You've just unlocked the power of AI-assisted decision making.

HERE'S HOW IT WORKS:

1. Ask Your Question
   Describe your decision, dilemma, or question in as much detail as you'd like.

2. The Council Deliberates
   Multiple AI models analyze your question independently, then peer-review each other's responses.

3. Get Your Answer
   Receive a synthesized recommendation that incorporates the best insights from the entire council.

You have {credits} free credits to get started! Each decision uses 1-3 credits depending on analysis depth.

Visit {APP_URL} to make your first decision!

We're excited to help you make better decisions!

- The DecidePlease Team

Questions? Contact us at {SUPPORT_EMAIL}
"""

    return await send_email(
        to=to,
        subject="Welcome to DecidePlease! 🎉 Your AI Council Awaits",
        html=html,
        text=text
    )


# ============== Password Reset Email ==============

async def send_password_reset_email(to: str, reset_token: str) -> bool:
    """Send password reset email."""
    reset_url = f"{APP_URL}/reset-password?token={reset_token}"
    preheader = "Click here to reset your DecidePlease password"

    content = f"""
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Reset Your Password</h2>
    <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px;">
        We received a request to reset the password for your DecidePlease account. Click the button below to choose a new password.
    </p>

    <p style="margin: 0 0 32px; text-align: center;">
        {get_button("Reset Password", reset_url)}
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <tr>
            <td style="padding: 16px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                    <strong>⏰ This link expires in 1 hour.</strong><br>
                    If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
            </td>
        </tr>
    </table>

    <p style="margin: 0; color: #a1a1aa; font-size: 13px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="{reset_url}" style="color: #5d5dff; word-break: break-all; font-size: 12px;">{reset_url}</a>
    </p>
    """

    html = get_base_template(content, preheader)
    text = f"""
Reset Your Password

We received a request to reset the password for your DecidePlease account. Visit this link to choose a new password:

{reset_url}

⏰ This link expires in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

- The DecidePlease Team

Questions? Contact us at {SUPPORT_EMAIL}
"""

    return await send_email(
        to=to,
        subject="Reset Your DecidePlease Password",
        html=html,
        text=text
    )


# ============== Purchase Confirmation Email ==============

async def send_purchase_confirmation_email(
    to: str,
    amount_cents: int,
    credits: int
) -> bool:
    """Send purchase confirmation email."""
    amount_display = f"${amount_cents / 100:.2f}"
    preheader = f"Thank you! {credits} credits have been added to your account."

    content = f"""
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Thank You for Your Purchase! 🙏</h2>
    <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px;">
        Your payment has been processed successfully and your credits are ready to use.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 32px; background-color: #f4f4f5; border-radius: 12px; overflow: hidden;">
        <tr>
            <td style="padding: 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="padding: 12px 0; color: #71717a; font-size: 15px;">Credits Added</td>
                        <td style="padding: 12px 0; text-align: right; font-weight: 700; font-size: 18px; color: #5d5dff;">{credits} credits</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="border-top: 1px solid #e4e4e7;"></td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #71717a; font-size: 15px;">Amount Paid</td>
                        <td style="padding: 12px 0; text-align: right; font-weight: 700; font-size: 18px; color: #18181b;">{amount_display}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <p style="margin: 0 0 32px; text-align: center;">
        {get_button("Start Making Decisions", APP_URL, "#22c55e")}
    </p>

    <p style="margin: 0; color: #71717a; font-size: 14px; text-align: center;">
        Thank you for choosing DecidePlease to help you make better decisions!
    </p>
    """

    html = get_base_template(content, preheader)
    text = f"""
Thank You for Your Purchase! 🙏

Your payment has been processed successfully.

RECEIPT
-------
Credits Added: {credits} credits
Amount Paid: {amount_display}

Your credits are ready to use. Visit {APP_URL} to start making better decisions.

Thank you for choosing DecidePlease!

- The DecidePlease Team

Questions? Contact us at {SUPPORT_EMAIL}
"""

    return await send_email(
        to=to,
        subject=f"Receipt: {credits} Credits Added to Your Account",
        html=html,
        text=text
    )


# ============== Refund Notification Email ==============

async def send_refund_notification_email(
    to: str,
    amount_cents: int,
    credits: int = 0
) -> bool:
    """Send refund notification email."""
    amount_display = f"${amount_cents / 100:.2f}"
    preheader = f"Your refund of {amount_display} has been processed."

    content = f"""
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Refund Processed</h2>
    <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px;">
        We've processed a refund for your recent purchase. Here are the details:
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 32px; background-color: #f4f4f5; border-radius: 12px; overflow: hidden;">
        <tr>
            <td style="padding: 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="padding: 12px 0; color: #71717a; font-size: 15px;">Amount Refunded</td>
                        <td style="padding: 12px 0; text-align: right; font-weight: 700; font-size: 18px; color: #18181b;">{amount_display}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px; background-color: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <tr>
            <td style="padding: 16px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px;">
                    <strong>📅 Processing Time</strong><br>
                    The refund should appear on your statement within 5-10 business days, depending on your bank.
                </p>
            </td>
        </tr>
    </table>

    <p style="margin: 0; color: #71717a; font-size: 14px; text-align: center;">
        If you have any questions about this refund, please don't hesitate to reach out.
    </p>
    """

    html = get_base_template(content, preheader)
    text = f"""
Refund Processed

We've processed a refund for your recent purchase.

DETAILS
-------
Amount Refunded: {amount_display}

📅 Processing Time: The refund should appear on your statement within 5-10 business days, depending on your bank.

If you have any questions about this refund, please don't hesitate to reach out.

- The DecidePlease Team

Questions? Contact us at {SUPPORT_EMAIL}
"""

    return await send_email(
        to=to,
        subject=f"Refund Processed: {amount_display}",
        html=html,
        text=text
    )


# ============== Low Credits Warning Email ==============

async def send_low_credits_email(to: str, remaining_credits: int) -> bool:
    """Send low credits warning email."""
    preheader = f"You have {remaining_credits} credit{'s' if remaining_credits != 1 else ''} remaining"

    if remaining_credits == 0:
        credit_message = "You've used all your credits!"
        urgency_color = "#ef4444"
    elif remaining_credits == 1:
        credit_message = "You have 1 credit remaining."
        urgency_color = "#f59e0b"
    else:
        credit_message = f"You have {remaining_credits} credits remaining."
        urgency_color = "#f59e0b"

    content = f"""
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Running Low on Credits</h2>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px; background-color: #fef2f2; border-radius: 12px; border: 2px solid {urgency_color};">
        <tr>
            <td style="padding: 24px; text-align: center;">
                <p style="margin: 0; font-size: 36px; font-weight: 700; color: {urgency_color};">{remaining_credits}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #71717a;">credits remaining</p>
            </td>
        </tr>
    </table>

    <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px;">
        {credit_message} Top up now to keep making great decisions with your AI council.
    </p>

    <p style="margin: 0 0 32px; text-align: center;">
        {get_button("Buy More Credits", f"{APP_URL}?buy=true", "#5d5dff")}
    </p>

    <p style="margin: 0; color: #71717a; font-size: 14px; text-align: center;">
        Each credit pack gives you 10 credits for just $5.
    </p>
    """

    html = get_base_template(content, preheader)
    text = f"""
Running Low on Credits

{credit_message}

Top up now to keep making great decisions with your AI council.

Buy more credits: {APP_URL}?buy=true

Each credit pack gives you 10 credits for just $5.

- The DecidePlease Team

Questions? Contact us at {SUPPORT_EMAIL}
"""

    return await send_email(
        to=to,
        subject=f"⚠️ You have {remaining_credits} credit{'s' if remaining_credits != 1 else ''} left",
        html=html,
        text=text
    )


# ============== Email Verification ==============

async def send_verification_email(to: str, verification_token: str) -> bool:
    """Send email verification link."""
    verify_url = f"{APP_URL}/verify-email?token={verification_token}"
    preheader = "Please verify your email address to complete your registration"

    content = f"""
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Verify Your Email</h2>
    <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px;">
        Thanks for signing up for DecidePlease! Please click the button below to verify your email address.
    </p>

    <p style="margin: 0 0 32px; text-align: center;">
        {get_button("Verify Email Address", verify_url, "#22c55e")}
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px; background-color: #f4f4f5; border-radius: 8px;">
        <tr>
            <td style="padding: 16px;">
                <p style="margin: 0; color: #71717a; font-size: 14px;">
                    This link will expire in 24 hours. If you didn't create an account with DecidePlease, you can safely ignore this email.
                </p>
            </td>
        </tr>
    </table>

    <p style="margin: 0; color: #a1a1aa; font-size: 13px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="{verify_url}" style="color: #5d5dff; word-break: break-all; font-size: 12px;">{verify_url}</a>
    </p>
    """

    html = get_base_template(content, preheader)
    text = f"""
Verify Your Email

Thanks for signing up for DecidePlease! Please visit this link to verify your email address:

{verify_url}

This link will expire in 24 hours. If you didn't create an account with DecidePlease, you can safely ignore this email.

- The DecidePlease Team

Questions? Contact us at {SUPPORT_EMAIL}
"""

    return await send_email(
        to=to,
        subject="Verify Your Email - DecidePlease",
        html=html,
        text=text
    )


# ============== Password Changed Confirmation ==============

async def send_password_changed_email(to: str) -> bool:
    """Send confirmation that password was changed."""
    preheader = "Your DecidePlease password has been changed"

    content = f"""
    <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Password Changed Successfully</h2>
    <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px;">
        Your DecidePlease password has been successfully changed. You can now use your new password to log in.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px; background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
        <tr>
            <td style="padding: 16px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px;">
                    <strong>🔒 Wasn't you?</strong><br>
                    If you didn't change your password, please <a href="{APP_URL}/reset-password" style="color: #ef4444; font-weight: 600;">reset it immediately</a> and contact us at {SUPPORT_EMAIL}.
                </p>
            </td>
        </tr>
    </table>

    <p style="margin: 0 0 32px; text-align: center;">
        {get_button("Go to DecidePlease", APP_URL)}
    </p>
    """

    html = get_base_template(content, preheader)
    text = f"""
Password Changed Successfully

Your DecidePlease password has been successfully changed. You can now use your new password to log in.

🔒 Wasn't you?
If you didn't change your password, please reset it immediately at {APP_URL}/reset-password and contact us at {SUPPORT_EMAIL}.

Visit {APP_URL} to continue.

- The DecidePlease Team
"""

    return await send_email(
        to=to,
        subject="Your Password Has Been Changed",
        html=html,
        text=text
    )
