"""Clerk authentication for DecidePlease API."""

import os
import httpx
import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from functools import lru_cache

# Clerk configuration
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CLERK_ISSUER = os.getenv("CLERK_ISSUER")  # e.g., https://your-app.clerk.accounts.dev

# Security scheme
security = HTTPBearer(auto_error=False)


@lru_cache()
def get_jwks_client() -> Optional[PyJWKClient]:
    """Get the JWKS client for verifying Clerk tokens."""
    if not CLERK_ISSUER:
        return None
    # Clerk's JWKS endpoint
    jwks_url = f"{CLERK_ISSUER}/.well-known/jwks.json"
    return PyJWKClient(jwks_url)


async def verify_clerk_token(token: str) -> dict:
    """
    Verify a Clerk JWT token and return the claims.

    Args:
        token: The JWT token from the Authorization header

    Returns:
        The decoded token claims

    Raises:
        HTTPException: If token is invalid
    """
    jwks_client = get_jwks_client()

    if not jwks_client:
        # Development mode - return mock user
        if os.getenv("DEVELOPMENT_MODE") == "true":
            return {
                "sub": "dev_user_123",
                "email": "dev@example.com"
            }
        raise HTTPException(status_code=500, detail="Auth not configured")

    try:
        # Get the signing key from Clerk's JWKS
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Verify and decode the token
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            options={"verify_aud": False}  # Clerk doesn't always set audience
        )

        return claims

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    FastAPI dependency to get the current authenticated user.

    Returns:
        Dict with user_id and email

    Raises:
        HTTPException: If not authenticated
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    claims = await verify_clerk_token(credentials.credentials)

    return {
        "user_id": claims.get("sub"),
        "email": claims.get("email", claims.get("primary_email_address", ""))
    }


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[dict]:
    """
    FastAPI dependency to optionally get the current user.
    Returns None if not authenticated (doesn't raise error).
    """
    if not credentials:
        return None

    try:
        claims = await verify_clerk_token(credentials.credentials)
        return {
            "user_id": claims.get("sub"),
            "email": claims.get("email", claims.get("primary_email_address", ""))
        }
    except HTTPException:
        return None
