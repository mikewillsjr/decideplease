"""Rate limiting configuration for DecidePlease."""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from jose import jwt
import os
import uuid

# JWT secret for token verification in rate limit key function
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")

# Disable rate limiting for tests (each request gets unique key)
DISABLE_RATE_LIMIT = os.getenv("DISABLE_RATE_LIMIT", "").lower() in ("true", "1", "yes")


def get_rate_limit_key(request: Request) -> str:
    """
    Get rate limit key based on authenticated user or IP.

    For authenticated users, uses user_id for more fair rate limiting.
    For anonymous users, falls back to IP address.

    Security: Now verifies JWT signature to prevent rate limit bypass.
    """
    # Disable rate limiting for tests by using unique key per request
    if DISABLE_RATE_LIMIT:
        return f"disabled:{uuid.uuid4()}"

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            # Verify signature to prevent rate limit bypass via forged tokens
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_exp": False}  # Don't reject expired for rate limiting
            )
            user_id = payload.get("sub")
            if user_id:
                return f"user:{user_id}"
        except Exception:
            # Invalid token - fall back to IP
            pass

    # Also check httpOnly cookies
    token = request.cookies.get("access_token")
    if token:
        try:
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_exp": False}
            )
            user_id = payload.get("sub")
            if user_id:
                return f"user:{user_id}"
        except Exception:
            pass

    return f"ip:{get_remote_address(request)}"


# Shared limiter instance
limiter = Limiter(key_func=get_rate_limit_key)
