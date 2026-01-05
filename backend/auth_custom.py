"""Custom authentication for DecidePlease - Email/Password + OAuth (future)."""

import os
import uuid
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr

# Configuration
_DEFAULT_JWT_SECRET = "dev-secret-change-in-production"
JWT_SECRET = os.getenv("JWT_SECRET", _DEFAULT_JWT_SECRET)
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = 30

# Validate JWT_SECRET in production
def validate_jwt_secret():
    """
    Validate that JWT_SECRET is properly configured in production.
    Raises RuntimeError if using default secret in production environment.
    """
    is_production = (
        os.getenv("RENDER") == "true" or  # Render.com
        os.getenv("PRODUCTION") == "true" or
        os.getenv("NODE_ENV") == "production" or
        os.getenv("ENVIRONMENT") == "production"
    )

    if is_production and JWT_SECRET == _DEFAULT_JWT_SECRET:
        raise RuntimeError(
            "SECURITY ERROR: JWT_SECRET environment variable is not set! "
            "You must set a secure JWT_SECRET in production. "
            "Generate one with: openssl rand -hex 32"
        )

    if JWT_SECRET == _DEFAULT_JWT_SECRET:
        print("[WARNING] Using default JWT_SECRET - only acceptable in development!")

# Run validation on module load
validate_jwt_secret()

# OAuth feature flag (disabled for now)
OAUTH_ENABLED = os.getenv("OAUTH_ENABLED", "false").lower() == "true"

# Security scheme
security = HTTPBearer(auto_error=False)


# ============== Password Hashing ==============

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    except Exception:
        return False


# ============== JWT Tokens ==============

def create_access_token(user_id: str, email: str, role: str = "user") -> str:
    """Create a JWT access token with unique JTI for revocation support."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),  # Unique token ID for revocation
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_impersonation_token(user_id: str, email: str, role: str, impersonated_by: str) -> str:
    """Create an impersonation token for superadmin to act as another user.

    This token includes the impersonated_by claim to track who is impersonating.
    """
    expire = datetime.now(timezone.utc) + timedelta(hours=1)  # Shorter expiry for impersonation
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "impersonated_by": impersonated_by,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),  # Unique token ID for revocation
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """Create a JWT refresh token."""
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),  # Unique token ID for potential revocation
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# In-memory cache for revoked tokens (cleared on restart, but DB is source of truth)
_revoked_tokens_cache: set = set()


async def is_token_revoked(jti: str) -> bool:
    """Check if a token has been revoked."""
    # Check cache first
    if jti in _revoked_tokens_cache:
        return True

    # Check database
    from .database import get_connection
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT jti FROM revoked_tokens WHERE jti = $1",
            jti
        )
        if row:
            _revoked_tokens_cache.add(jti)
            return True
    return False


async def revoke_token(jti: str, user_id: str, expires_at: datetime):
    """
    Add a token to the revocation list.

    Args:
        jti: The JWT ID to revoke
        user_id: The user who owns the token
        expires_at: When the token naturally expires (for cleanup)
    """
    from .database import get_connection
    async with get_connection() as conn:
        await conn.execute(
            """
            INSERT INTO revoked_tokens (jti, user_id, expires_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (jti) DO NOTHING
            """,
            jti,
            user_id,
            expires_at
        )
    _revoked_tokens_cache.add(jti)


async def revoke_all_user_tokens(user_id: str):
    """
    Revoke all tokens for a user (e.g., on password change or security concern).
    Note: This doesn't actually revoke existing tokens, but the user will need to re-login
    since we can't enumerate all their tokens. For immediate revocation, we'd need to track
    all active tokens per user.
    """
    # For now, this is a placeholder. True revocation of all tokens would require
    # either storing all issued tokens or using a "not before" timestamp per user.
    pass


async def cleanup_expired_revocations():
    """Remove expired entries from the revoked_tokens table."""
    from .database import get_connection
    async with get_connection() as conn:
        await conn.execute(
            "DELETE FROM revoked_tokens WHERE expires_at < NOW()"
        )


def verify_token(token: str, token_type: str = "access") -> dict:
    """
    Verify and decode a JWT token.

    Args:
        token: The JWT token string
        token_type: Expected token type ("access" or "refresh")

    Returns:
        Decoded token payload

    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

        # Verify token type
        if payload.get("type") != token_type:
            raise HTTPException(status_code=401, detail="Invalid token type")

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


async def verify_token_async(token: str, token_type: str = "access") -> dict:
    """
    Verify and decode a JWT token with revocation check.

    This is the async version that checks the revocation database.

    Args:
        token: The JWT token string
        token_type: Expected token type ("access" or "refresh")

    Returns:
        Decoded token payload

    Raises:
        HTTPException: If token is invalid, expired, or revoked
    """
    # First do basic verification
    payload = verify_token(token, token_type)

    # Check if token has been revoked
    jti = payload.get("jti")
    if jti and await is_token_revoked(jti):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    return payload


# ============== FastAPI Dependencies ==============

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    FastAPI dependency to get the current authenticated user.

    Checks for token in:
    1. Authorization header (Bearer token)
    2. httpOnly cookie (access_token)

    Returns:
        Dict with user_id, email, role, jti, and optionally impersonated_by

    Raises:
        HTTPException: If not authenticated or token is revoked
    """
    token = None

    # First check Authorization header
    if credentials:
        token = credentials.credentials
    else:
        # Fall back to httpOnly cookie
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Use async verification with revocation check
    payload = await verify_token_async(token, token_type="access")

    result = {
        "user_id": payload.get("sub"),
        "email": payload.get("email", ""),
        "role": payload.get("role", "user"),
        "jti": payload.get("jti"),  # Include JTI for logout
    }

    # Include impersonation info if present
    if "impersonated_by" in payload:
        result["impersonated_by"] = payload["impersonated_by"]

    return result


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[dict]:
    """
    FastAPI dependency to optionally get the current user.
    Returns None if not authenticated or token is revoked (doesn't raise error).

    Checks for token in:
    1. Authorization header (Bearer token)
    2. httpOnly cookie (access_token)
    """
    token = None

    # First check Authorization header
    if credentials:
        token = credentials.credentials
    else:
        # Fall back to httpOnly cookie
        token = request.cookies.get("access_token")

    if not token:
        return None

    try:
        payload = await verify_token_async(token, token_type="access")
        result = {
            "user_id": payload.get("sub"),
            "email": payload.get("email", ""),
            "role": payload.get("role", "user"),
            "jti": payload.get("jti"),
        }
        if "impersonated_by" in payload:
            result["impersonated_by"] = payload["impersonated_by"]
        return result
    except HTTPException:
        return None


# ============== Cookie Helpers ==============

# Cookie settings
COOKIE_SECURE = os.getenv("ENVIRONMENT", "development") == "production"  # True in production
COOKIE_SAMESITE = "lax"  # "lax" allows cookies on top-level navigations
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", None)  # None for same-domain only


def set_auth_cookies(response, access_token: str, refresh_token: str):
    """
    Set httpOnly cookies for authentication tokens.

    This provides protection against XSS attacks since JavaScript cannot
    access httpOnly cookies.
    """
    # Access token cookie (shorter lived)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        domain=COOKIE_DOMAIN,
    )

    # Refresh token cookie (longer lived)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/auth/refresh",  # Only send on refresh endpoint
        domain=COOKIE_DOMAIN,
    )


def clear_auth_cookies(response):
    """Clear authentication cookies on logout."""
    response.delete_cookie(
        key="access_token",
        path="/",
        domain=COOKIE_DOMAIN,
    )
    response.delete_cookie(
        key="refresh_token",
        path="/api/auth/refresh",
        domain=COOKIE_DOMAIN,
    )


# ============== Request/Response Models ==============

class RegisterRequest(BaseModel):
    """Registration request."""
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    """Login request."""
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """Token refresh request."""
    refresh_token: str


class AuthResponse(BaseModel):
    """Authentication response with tokens."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    """User info response."""
    id: str
    email: str
    credits: int
    email_verified: bool
    role: str = "user"


# ============== OAuth Providers (Future) ==============

OAUTH_PROVIDERS = {
    "google": {
        "enabled": False,
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v2/userinfo",
        "scope": "openid email profile",
    },
    "github": {
        "enabled": False,
        "client_id": os.getenv("GITHUB_CLIENT_ID"),
        "client_secret": os.getenv("GITHUB_CLIENT_SECRET"),
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "scope": "user:email",
    },
    "apple": {
        "enabled": False,
        "client_id": os.getenv("APPLE_CLIENT_ID"),
        "team_id": os.getenv("APPLE_TEAM_ID"),
        "key_id": os.getenv("APPLE_KEY_ID"),
        "authorize_url": "https://appleid.apple.com/auth/authorize",
        "token_url": "https://appleid.apple.com/auth/token",
        "scope": "name email",
    },
}


def get_enabled_oauth_providers() -> list:
    """Get list of enabled OAuth providers."""
    if not OAUTH_ENABLED:
        return []
    return [name for name, config in OAUTH_PROVIDERS.items() if config.get("enabled")]
