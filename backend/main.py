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
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .rate_limit import limiter

# Initialize Sentry for error tracking (if configured)
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.asyncpg import AsyncPGIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            AsyncPGIntegration(),
        ],
        traces_sample_rate=0.1,  # 10% of requests for performance monitoring
        profiles_sample_rate=0.1,  # 10% profiling
        environment=os.getenv("ENVIRONMENT", "development"),
    )

# Initialize structured logging
from .logging_config import get_logger
logger = get_logger(__name__)

from . import storage_pg as storage
from .storage_pg import InsufficientCreditsError
from .database import init_database, close_pool, get_connection
from .auth_custom import (
    get_current_user,
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    revoke_token,
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    AuthResponse,
    OAUTH_ENABLED,
    JWT_SECRET,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    set_auth_cookies,
    clear_auth_cookies,
)
from .payments import (
    create_checkout_session,
    create_payment_intent,
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
from .config import RUN_MODES, FILE_UPLOAD_CREDIT_COST, MAX_FILES, MAX_FILE_SIZE
from .admin import router as admin_router, ADMIN_EMAILS
from .permissions import has_permission
from .file_processing import validate_files, process_files, FileValidationError
from .council import stage1_collect_responses_with_files


# Required environment variables for production
REQUIRED_ENV_VARS = [
    "DATABASE_URL",
    "JWT_SECRET",
    "OPENROUTER_API_KEY",
]

# Optional but recommended env vars
RECOMMENDED_ENV_VARS = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "CORS_ORIGINS",
]


def validate_environment():
    """
    Validate required environment variables at startup.
    Raises RuntimeError if critical variables are missing in production.
    """
    is_production = (
        os.getenv("RENDER") == "true" or
        os.getenv("PRODUCTION") == "true" or
        os.getenv("NODE_ENV") == "production" or
        os.getenv("ENVIRONMENT") == "production"
    )

    missing_required = [var for var in REQUIRED_ENV_VARS if not os.getenv(var)]
    missing_recommended = [var for var in RECOMMENDED_ENV_VARS if not os.getenv(var)]

    # In production, fail if required vars are missing
    if is_production and missing_required:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing_required)}. "
            "These must be set in production."
        )

    # Check for default JWT secret in production
    if is_production and os.getenv("JWT_SECRET") == "dev-secret-change-in-production":
        raise RuntimeError(
            "JWT_SECRET is still set to the default value. "
            "Generate a secure secret with: openssl rand -hex 32"
        )

    # Warn about missing vars in development
    if missing_required:
        print(f"[WARNING] Missing required env vars (OK in dev): {', '.join(missing_required)}")

    if missing_recommended:
        print(f"[INFO] Missing recommended env vars: {', '.join(missing_recommended)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - initialize and cleanup resources."""
    # Validate environment before starting
    validate_environment()

    logger.info("application_starting", service="DecidePlease API")

    # Startup: Initialize database
    if os.getenv("DATABASE_URL"):
        await init_database()
        logger.info("database_initialized")

    logger.info("application_ready")
    yield

    # Shutdown: Close database pool
    logger.info("application_shutting_down")
    await close_pool()
    logger.info("application_stopped")


app = FastAPI(title="DecidePlease API", lifespan=lifespan)


# Rate limiting configuration (imported from rate_limit module)
# Uses user ID for authenticated requests, IP for anonymous
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
# In production, set CORS_ORIGINS env var (comma-separated)
# In development, defaults to localhost
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
cors_origins = [origin.strip() for origin in cors_origins if origin.strip()]

# Use explicit allow lists instead of wildcards for better security
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,  # Explicit origins only
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Explicit methods
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "Stripe-Signature",  # For Stripe webhooks
    ],
)

# Request body size limit (100KB max for regular requests, 60MB for file uploads)
MAX_BODY_SIZE = 100 * 1024  # 100KB
MAX_UPLOAD_BODY_SIZE = 60 * 1024 * 1024  # 60MB for file uploads (5 files x 10MB + overhead)
MAX_QUERY_LENGTH = 10000  # 10,000 characters max for user queries

@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    """Middleware to limit request body size."""
    content_length = request.headers.get("content-length")
    if content_length:
        size = int(content_length)
        path = str(request.url.path)
        # Allow larger requests for message endpoints (which handle file uploads)
        if "/message" in path:
            if size > MAX_UPLOAD_BODY_SIZE:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request body too large. Maximum size is 60MB."}
                )
        elif size > MAX_BODY_SIZE:
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


class FileAttachment(BaseModel):
    """Base64-encoded file attachment."""
    filename: str
    content_type: str
    data: str  # base64-encoded file content


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str
    mode: str = "standard"  # "quick", "standard", or "extra_care"
    files: Optional[List[FileAttachment]] = None  # Optional file attachments


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
    price_cents: int = 500
    stripe_configured: bool
    publishable_key: Optional[str] = None


@app.get("/")
async def root():
    """Basic health check endpoint."""
    return {"status": "ok", "service": "DecidePlease API"}


@app.get("/health")
async def health_check():
    """
    Comprehensive health check endpoint.

    Checks:
    - Database connectivity
    - Basic system health

    Returns status and details about each component.
    """
    health_status = {
        "status": "healthy",
        "service": "DecidePlease API",
        "checks": {}
    }

    # Check database connection
    try:
        async with get_connection() as conn:
            await conn.fetchval("SELECT 1")
        health_status["checks"]["database"] = {"status": "healthy"}
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        logger.error("health_check_failed", component="database", error=str(e))

    # Return 503 if unhealthy
    if health_status["status"] == "unhealthy":
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content=health_status)

    return health_status


# ============== Authentication Endpoints ==============

@app.post("/api/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, reg_request: RegisterRequest):
    """
    Register a new user with email and password.
    Returns access and refresh tokens (also sets httpOnly cookies).
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

    # Generate tokens (new users always have 'user' role)
    access_token = create_access_token(user["id"], user["email"], user.get("role", "user"))
    refresh_token = create_refresh_token(user["id"])

    # Send welcome email (fire and forget - don't block registration)
    from .email import send_welcome_email
    asyncio.create_task(send_welcome_email(user["email"], user["credits"]))

    # Create response with both JSON body and httpOnly cookies
    response_data = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "credits": user["credits"],
            "email_verified": user["email_verified"],
            "role": user.get("role", "user")
        }
    }

    response = JSONResponse(content=response_data)
    set_auth_cookies(response, access_token, refresh_token)
    return response


@app.post("/api/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, login_request: LoginRequest):
    """
    Login with email and password.
    Returns access and refresh tokens (also sets httpOnly cookies).
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

    # Generate tokens with role
    access_token = create_access_token(user["id"], user["email"], user.get("role", "user"))
    refresh_token = create_refresh_token(user["id"])

    # Create response with both JSON body and httpOnly cookies
    response_data = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "credits": user["credits"],
            "email_verified": user["email_verified"],
            "role": user.get("role", "user")
        }
    }

    response = JSONResponse(content=response_data)
    set_auth_cookies(response, access_token, refresh_token)
    return response


@app.post("/api/auth/refresh")
async def refresh_token(request: Request, refresh_request: Optional[RefreshRequest] = None):
    """
    Refresh an access token using a refresh token.
    Accepts token from body or httpOnly cookie.
    """
    # Get refresh token from body or cookie
    token = None

    # Check if body was provided with refresh_token
    if refresh_request is not None and refresh_request.refresh_token:
        token = refresh_request.refresh_token
    else:
        # Try to get from cookie
        token = request.cookies.get("refresh_token")

    # If still no token, try parsing body manually (for cases where Optional doesn't work)
    if not token:
        try:
            body = await request.json()
            token = body.get("refresh_token")
        except Exception:
            pass

    if not token:
        raise HTTPException(status_code=401, detail="Refresh token required")

    # Verify refresh token
    payload = verify_token(token, token_type="refresh")

    # Get user
    user = await storage.get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Generate new tokens
    access_token = create_access_token(user["id"], user["email"], user.get("role", "user"))
    new_refresh_token = create_refresh_token(user["id"])

    # Create response with both JSON body and httpOnly cookies
    response_data = {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

    response = JSONResponse(content=response_data)
    set_auth_cookies(response, access_token, new_refresh_token)
    return response


@app.post("/api/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    """
    Logout the current user by revoking their access token and clearing cookies.
    The token will be added to the blacklist and rejected on future requests.
    """
    from datetime import datetime, timedelta, timezone

    jti = user.get("jti")
    if jti:
        # Calculate when the token expires (for cleanup purposes)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        await revoke_token(jti, user["user_id"], expires_at)

    # Create response and clear httpOnly cookies
    response = JSONResponse(content={"message": "Logged out successfully"})
    clear_auth_cookies(response)
    return response


@app.get("/api/auth/me")
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """
    Get the current authenticated user's information.
    """
    user_data = await storage.get_user_by_id(user["user_id"])
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")

    result = {
        "id": user_data["id"],
        "email": user_data["email"],
        "credits": user_data["credits"],
        "email_verified": user_data["email_verified"],
        "role": user_data.get("role", "user")
    }

    # Include impersonation info if present
    if user.get("impersonated_by"):
        result["impersonated_by"] = user["impersonated_by"]

    return result


@app.get("/api/auth/oauth/providers")
async def get_oauth_providers():
    """
    Get list of available OAuth providers.
    Returns enabled providers based on environment configuration.
    """
    providers = []

    # Check if Google OAuth is configured
    if os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET"):
        providers.append({
            "name": "google",
            "display_name": "Google",
            "authorize_url": "/api/auth/oauth/google/authorize"
        })

    return {"providers": providers, "oauth_enabled": len(providers) > 0}


@app.get("/api/auth/oauth/google/authorize")
async def google_oauth_authorize(request: Request):
    """
    Initiate Google OAuth flow.
    Returns the URL to redirect the user to for Google sign-in.
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")

    # Build the redirect URI (where Google sends users after auth)
    frontend_url = os.getenv("FRONTEND_URL", os.getenv("APP_URL", "http://localhost:5173"))
    redirect_uri = f"{frontend_url}/auth/google/callback"

    # Build Google's authorization URL
    from urllib.parse import urlencode
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    return {"authorize_url": auth_url, "redirect_uri": redirect_uri}


class GoogleCallbackRequest(BaseModel):
    """Request body for Google OAuth callback."""
    code: str
    redirect_uri: str


@app.post("/api/auth/oauth/google/callback")
@limiter.limit("10/minute")
async def google_oauth_callback(request: Request, callback: GoogleCallbackRequest):
    """
    Handle Google OAuth callback.
    Exchanges the authorization code for tokens and creates/logs in the user.
    """
    import httpx

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": callback.code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": callback.redirect_uri,
                "grant_type": "authorization_code",
            },
        )

        if token_response.status_code != 200:
            logger.error("google_oauth_token_error", status=token_response.status_code, body=token_response.text)
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code")

        token_data = token_response.json()

        # Get user info from Google
        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )

        if userinfo_response.status_code != 200:
            logger.error("google_oauth_userinfo_error", status=userinfo_response.status_code)
            raise HTTPException(status_code=400, detail="Failed to get user info from Google")

        userinfo = userinfo_response.json()

    email = userinfo.get("email", "").lower().strip()
    google_id = userinfo.get("id")
    email_verified = userinfo.get("verified_email", False)

    if not email:
        raise HTTPException(status_code=400, detail="No email provided by Google")

    # Check if user exists
    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, email, role, credits, auth_provider, oauth_id FROM users WHERE email = $1",
            email
        )

        if user:
            # User exists - check if they used a different auth method
            if user["auth_provider"] == "email" and not user["oauth_id"]:
                # Link Google to existing email account
                await conn.execute(
                    "UPDATE users SET oauth_id = $1, auth_provider = 'google', email_verified = TRUE WHERE id = $2",
                    google_id, user["id"]
                )
                logger.info("google_oauth_linked", user_id=user["id"], email=email)

            user_id = user["id"]
            role = user["role"]
            credits = user["credits"]
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            await conn.execute(
                """
                INSERT INTO users (id, email, auth_provider, oauth_id, email_verified, credits, role)
                VALUES ($1, $2, 'google', $3, TRUE, 5, 'user')
                """,
                user_id, email, google_id
            )
            role = "user"
            credits = 5
            logger.info("google_oauth_registered", user_id=user_id, email=email)

            # Send welcome email
            from .email import send_welcome_email
            asyncio.create_task(send_welcome_email(email, credits))

    # Create JWT tokens
    access_token = create_access_token(user_id, email, role)
    refresh_token = create_refresh_token(user_id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": email,
            "credits": credits,
            "email_verified": True,
            "role": role,
        }
    }


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


class UpdateEmailRequest(BaseModel):
    new_email: str
    current_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@app.post("/api/auth/update-email")
async def update_email(request: UpdateEmailRequest, user: dict = Depends(get_current_user)):
    """Update user's email address."""
    # Get current user
    current_user = await storage.get_user_by_id(user["user_id"])
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify current password
    if not current_user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Cannot change email for OAuth accounts")

    if not verify_password(request.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Check if new email is already in use
    existing = await storage.get_user_by_email(request.new_email)
    if existing and existing["id"] != user["user_id"]:
        raise HTTPException(status_code=400, detail="Email already in use")

    # Update email directly (for now, we skip verification for simplicity)
    async with get_connection() as conn:
        await conn.execute(
            "UPDATE users SET email = $1 WHERE id = $2",
            request.new_email,
            user["user_id"]
        )

    return {"message": "Email updated successfully"}


@app.post("/api/auth/change-password")
async def change_password(request: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    """Change user's password."""
    # Get current user
    current_user = await storage.get_user_by_id(user["user_id"])
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify current password
    if not current_user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Cannot change password for OAuth accounts")

    if not verify_password(request.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Validate new password
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Update password
    new_hash = hash_password(request.new_password)
    await storage.update_user_password(user["user_id"], new_hash)

    # Send confirmation email
    from .email import send_password_changed_email
    asyncio.create_task(send_password_changed_email(current_user["email"]))

    return {"message": "Password changed successfully"}


@app.delete("/api/auth/delete-account")
async def delete_account(user: dict = Depends(get_current_user)):
    """Delete user's own account and all data."""
    user_id = user["user_id"]

    async with get_connection() as conn:
        # Delete in order: messages -> conversations -> payments -> user
        conv_ids = await conn.fetch(
            "SELECT id FROM conversations WHERE user_id = $1",
            user_id
        )
        conv_id_list = [row["id"] for row in conv_ids]

        if conv_id_list:
            await conn.execute(
                "DELETE FROM messages WHERE conversation_id = ANY($1)",
                conv_id_list
            )

        await conn.execute(
            "DELETE FROM conversations WHERE user_id = $1",
            user_id
        )

        try:
            await conn.execute(
                "DELETE FROM payments WHERE user_id = $1",
                user_id
            )
        except Exception as e:
            # Log but continue - payments table may not exist or be empty
            logger.warning("delete_account_cleanup_error", component="payments", user_id=user_id, error=str(e))

        try:
            await conn.execute(
                "DELETE FROM password_reset_tokens WHERE user_id = $1",
                user_id
            )
        except Exception as e:
            # Log but continue - table may not exist or be empty
            logger.warning("delete_account_cleanup_error", component="reset_tokens", user_id=user_id, error=str(e))

        await conn.execute("DELETE FROM users WHERE id = $1", user_id)

    return {"message": "Account deleted successfully"}


@app.get("/api/user", response_model=UserInfo)
async def get_user_info(user: dict = Depends(get_current_user)):
    """Get current user information including credits."""
    user_data = await storage.get_or_create_user(user["user_id"], user["email"])
    return UserInfo(
        user_id=user_data["id"],
        email=user_data["email"],
        credits=user_data["credits"]
    )


@app.get("/api/conversations")
async def list_conversations(
    user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """
    List conversations for the current user with pagination.

    Query params:
    - limit: Max conversations to return (default 50, max 100)
    - offset: Skip this many conversations (for pagination)

    Returns:
    - conversations: List of conversation metadata
    - total: Total number of conversations
    - has_more: Whether more conversations exist
    """
    return await storage.list_conversations(user["user_id"], limit=limit, offset=offset)


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

    # Check if user has unlimited credits (admin/superadmin role OR in legacy ADMIN_EMAILS)
    user_email = user.get("email", "").lower()
    user_role = user.get("role", "user")
    has_unlimited = has_permission(user_role, 'unlimited_credits') or user_email in ADMIN_EMAILS

    # Atomically reserve credits BEFORE starting any processing
    if not has_unlimited:
        try:
            await storage.reserve_credits_atomic(user["user_id"], 1)
        except InsufficientCreditsError as e:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. Need {e.required}, have {e.available}."
            )

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
    context_packet: Optional[Dict[str, Any]] = None,
    processed_files: Optional[List[Dict[str, Any]]] = None
):
    """
    Background task to process the council request.
    Saves progress incrementally and pushes events to the queue.
    Continues running even if client disconnects.

    Args:
        processed_files: Optional list of processed file dicts for multimodal queries
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

        # Stage 1: Collect responses (with or without files)
        _active_status[conversation_id] = "stage1"
        await event_queue.put({'type': 'stage1_start'})
        if processed_files:
            stage1_results = await stage1_collect_responses_with_files(
                effective_content, processed_files, council_models
            )
        else:
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
    Supports optional file attachments (images, PDFs, Office docs).
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

    # Check for file attachments and add file upload credit cost
    has_files = bool(msg_request.files and len(msg_request.files) > 0)
    processed_files = None
    if has_files:
        # Validate files
        try:
            files_as_dicts = [f.model_dump() for f in msg_request.files]
            validate_files(files_as_dicts)
            # Process files (extract text, convert images to data URIs)
            processed_files = await process_files(files_as_dicts)
        except FileValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Add file upload credit cost
        credit_cost += FILE_UPLOAD_CREDIT_COST

    # Check if conversation exists and belongs to user
    conversation = await storage.get_conversation(conversation_id, user["user_id"])
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if user has unlimited credits (admin/superadmin role OR in legacy ADMIN_EMAILS)
    user_email = user.get("email", "").lower()
    user_role = user.get("role", "user")
    has_unlimited = has_permission(user_role, 'unlimited_credits') or user_email in ADMIN_EMAILS

    # Atomically reserve credits BEFORE starting any processing
    # This prevents concurrent requests from overdrawing credits
    remaining_credits = None
    if not has_unlimited:
        try:
            remaining_credits = await storage.reserve_credits_atomic(user["user_id"], credit_cost)
        except InsufficientCreditsError as e:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. Need {e.required}, have {e.available}."
            )

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
        mode=mode,
        processed_files=processed_files
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

    # Check if user has unlimited credits (admin/superadmin role OR in legacy ADMIN_EMAILS)
    user_email = user.get("email", "").lower()
    user_role = user.get("role", "user")
    has_unlimited = has_permission(user_role, 'unlimited_credits') or user_email in ADMIN_EMAILS

    # Atomically reserve credits BEFORE starting any processing
    remaining_credits = None
    if not has_unlimited:
        try:
            remaining_credits = await storage.reserve_credits_atomic(user["user_id"], credit_cost)
        except InsufficientCreditsError as e:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. Need {e.required}, have {e.available}."
            )

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
    """Create a Stripe checkout session to purchase credits (legacy)."""
    result = await create_checkout_session(
        user_id=user["user_id"],
        user_email=user["email"],
        success_url=request.success_url,
        cancel_url=request.cancel_url,
    )
    return result


@app.post("/api/credits/create-payment-intent")
async def create_credits_payment_intent(user: dict = Depends(get_current_user)):
    """
    Create a Stripe PaymentIntent for purchasing credits.

    This endpoint is used with the Payment Element for custom checkout UI.
    Returns client_secret needed to initialize the Payment Element.

    Apple Pay and Google Pay are automatically available when:
    1. Dynamic payment methods are enabled in Stripe Dashboard
    2. Customer's device/browser supports them
    """
    result = await create_payment_intent(
        user_id=user["user_id"],
        user_email=user["email"],
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

    # Handle PaymentIntent completion (Payment Element flow)
    elif event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]

        # Get user_id from metadata - this identifies DecidePlease payments
        user_id = intent.get("metadata", {}).get("user_id")

        # Skip if no user_id - this payment is from another app on the shared account
        if not user_id:
            print(f"[WEBHOOK] Ignoring payment_intent.succeeded - no user_id metadata (other app)")
            return {"status": "success"}

        credits_str = intent.get("metadata", {}).get("credits", str(CREDITS_PER_PURCHASE))
        credits_to_add = int(credits_str)
        amount_cents = intent.get("amount", 500)

        # Record payment in database (check for duplicates via payment_intent_id)
        await storage.record_payment(
            user_id=user_id,
            stripe_session_id=None,  # No session for Payment Element flow
            stripe_payment_intent=intent.get("id"),
            amount_cents=amount_cents,
            credits=credits_to_add
        )

        await storage.add_credits(user_id, credits_to_add)
        print(f"[WEBHOOK] Added {credits_to_add} credits to user {user_id} (Payment Element)")

        # Send custom purchase confirmation email
        customer_email = intent.get("receipt_email")
        if customer_email:
            await send_payment_email(customer_email, "purchase", amount_cents, credits_to_add)

    # Handle refunds
    elif event["type"] == "charge.refunded":
        charge = event["data"]["object"]

        payment_intent_id = charge.get("payment_intent")
        customer_email = charge.get("billing_details", {}).get("email") or charge.get("receipt_email")
        amount_refunded = charge.get("amount_refunded", 0)

        # Look up the payment in our database by payment_intent_id
        # This is more reliable than checking metadata on the charge
        if payment_intent_id:
            refund_processed = await storage.mark_payment_refunded(payment_intent_id, amount_refunded)

            if refund_processed:
                logger.info(
                    "refund_processed",
                    payment_intent_id=payment_intent_id,
                    amount_refunded_cents=amount_refunded
                )

                # Send refund notification email
                if customer_email:
                    await handle_refund(charge.get("id"), amount_refunded, customer_email)
            else:
                # Payment not found in our database - probably from another app
                logger.info(
                    "refund_ignored",
                    reason="payment_not_found",
                    payment_intent_id=payment_intent_id
                )
        else:
            logger.warning("refund_missing_payment_intent", charge_id=charge.get("id"))

    # Handle disputes (freeze account)
    elif event["type"] == "charge.dispute.created":
        dispute = event["data"]["object"]
        payment_intent_id = dispute.get("payment_intent")

        logger.warning(
            "dispute_created",
            dispute_id=dispute.get("id"),
            payment_intent_id=payment_intent_id,
            reason=dispute.get("reason")
        )
        # TODO: Consider freezing user account until dispute is resolved

    return {"status": "success"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
