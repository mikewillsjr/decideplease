"""Admin panel routes and utilities for DecidePlease."""

import os
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from .auth import get_current_user
from .database import get_connection

# Admin emails - set via environment variable (comma-separated)
ADMIN_EMAILS = os.getenv("ADMIN_EMAILS", "").split(",")
ADMIN_EMAILS = [e.strip().lower() for e in ADMIN_EMAILS if e.strip()]

router = APIRouter(prefix="/api/admin", tags=["admin"])


# Pydantic models for admin responses
class UserSummary(BaseModel):
    id: str
    email: str
    credits: int
    created_at: str
    conversation_count: int
    query_count: int


class DashboardStats(BaseModel):
    total_users: int
    total_conversations: int
    total_queries: int
    total_revenue_cents: int
    users_today: int
    queries_today: int
    revenue_today_cents: int


class RecentPayment(BaseModel):
    id: str
    user_email: str
    amount_cents: int
    credits: int
    created_at: str
    status: str


class QueryLog(BaseModel):
    id: str
    user_email: str
    conversation_id: str
    query_preview: str
    created_at: str


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency that requires the current user to be an admin.

    Raises:
        HTTPException: If user is not an admin
    """
    user_email = user.get("email", "").lower()

    # Development mode bypass - only on localhost for safety
    if os.getenv("DEVELOPMENT_MODE") == "true":
        # Only allow bypass in actual local development
        is_local = not os.getenv("RENDER") and not os.getenv("PRODUCTION")
        if is_local:
            print(f"[WARNING] Admin bypass active for {user_email} (DEVELOPMENT_MODE=true)")
            return user

    if not ADMIN_EMAILS:
        raise HTTPException(
            status_code=500,
            detail="Admin emails not configured. Set ADMIN_EMAILS env var."
        )

    if user_email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin access required")

    return user


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(admin: dict = Depends(require_admin)):
    """Get dashboard statistics for the admin panel."""
    async with get_connection() as conn:
        # Total users
        total_users = await conn.fetchval("SELECT COUNT(*) FROM users")

        # Total conversations
        total_conversations = await conn.fetchval("SELECT COUNT(*) FROM conversations")

        # Total queries (assistant messages = completed queries)
        total_queries = await conn.fetchval(
            "SELECT COUNT(*) FROM messages WHERE role = 'assistant'"
        )

        # Total revenue from payments table (if exists)
        try:
            total_revenue = await conn.fetchval(
                "SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE status = 'completed'"
            ) or 0
        except:
            total_revenue = 0

        # Today's stats
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        users_today = await conn.fetchval(
            "SELECT COUNT(*) FROM users WHERE created_at >= $1",
            today_start
        )

        queries_today = await conn.fetchval(
            "SELECT COUNT(*) FROM messages WHERE role = 'assistant' AND created_at >= $1",
            today_start
        )

        try:
            revenue_today = await conn.fetchval(
                "SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE status = 'completed' AND created_at >= $1",
                today_start
            ) or 0
        except:
            revenue_today = 0

        return DashboardStats(
            total_users=total_users,
            total_conversations=total_conversations,
            total_queries=total_queries,
            total_revenue_cents=total_revenue,
            users_today=users_today,
            queries_today=queries_today,
            revenue_today_cents=revenue_today
        )


@router.get("/users", response_model=List[UserSummary])
async def list_users(
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    admin: dict = Depends(require_admin)
):
    """List all users with their stats."""
    async with get_connection() as conn:
        if search:
            rows = await conn.fetch(
                """
                SELECT u.id, u.email, u.credits, u.created_at,
                       COUNT(DISTINCT c.id) as conversation_count,
                       COUNT(DISTINCT m.id) FILTER (WHERE m.role = 'assistant') as query_count
                FROM users u
                LEFT JOIN conversations c ON c.user_id = u.id
                LEFT JOIN messages m ON m.conversation_id = c.id
                WHERE LOWER(u.email) LIKE LOWER($1)
                GROUP BY u.id
                ORDER BY u.created_at DESC
                LIMIT $2 OFFSET $3
                """,
                f"%{search}%",
                limit,
                offset
            )
        else:
            rows = await conn.fetch(
                """
                SELECT u.id, u.email, u.credits, u.created_at,
                       COUNT(DISTINCT c.id) as conversation_count,
                       COUNT(DISTINCT m.id) FILTER (WHERE m.role = 'assistant') as query_count
                FROM users u
                LEFT JOIN conversations c ON c.user_id = u.id
                LEFT JOIN messages m ON m.conversation_id = c.id
                GROUP BY u.id
                ORDER BY u.created_at DESC
                LIMIT $1 OFFSET $2
                """,
                limit,
                offset
            )

        return [
            UserSummary(
                id=row["id"],
                email=row["email"],
                credits=row["credits"],
                created_at=row["created_at"].isoformat(),
                conversation_count=row["conversation_count"],
                query_count=row["query_count"]
            )
            for row in rows
        ]


@router.get("/users/{user_id}")
async def get_user_detail(user_id: str, admin: dict = Depends(require_admin)):
    """Get detailed info for a specific user."""
    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, email, credits, created_at FROM users WHERE id = $1",
            user_id
        )

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get user's conversations
        conversations = await conn.fetch(
            """
            SELECT c.id, c.title, c.created_at,
                   COUNT(m.id) as message_count
            FROM conversations c
            LEFT JOIN messages m ON m.conversation_id = c.id
            WHERE c.user_id = $1
            GROUP BY c.id
            ORDER BY c.created_at DESC
            LIMIT 20
            """,
            user_id
        )

        # Get user's payments
        try:
            payments = await conn.fetch(
                """
                SELECT id, amount_cents, credits, status, created_at
                FROM payments
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 20
                """,
                user_id
            )
        except:
            payments = []

        return {
            "user": {
                "id": user["id"],
                "email": user["email"],
                "credits": user["credits"],
                "created_at": user["created_at"].isoformat()
            },
            "conversations": [
                {
                    "id": str(c["id"]),
                    "title": c["title"],
                    "created_at": c["created_at"].isoformat(),
                    "message_count": c["message_count"]
                }
                for c in conversations
            ],
            "payments": [
                {
                    "id": str(p["id"]),
                    "amount_cents": p["amount_cents"],
                    "credits": p["credits"],
                    "status": p["status"],
                    "created_at": p["created_at"].isoformat()
                }
                for p in payments
            ]
        }


@router.post("/users/{user_id}/credits")
async def adjust_user_credits(
    user_id: str,
    credits: int,
    admin: dict = Depends(require_admin)
):
    """Manually adjust a user's credits (add or remove)."""
    async with get_connection() as conn:
        # Check user exists
        user = await conn.fetchrow(
            "SELECT id, credits FROM users WHERE id = $1",
            user_id
        )

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        new_credits = max(0, user["credits"] + credits)

        await conn.execute(
            "UPDATE users SET credits = $1 WHERE id = $2",
            new_credits,
            user_id
        )

        return {
            "user_id": user_id,
            "previous_credits": user["credits"],
            "adjustment": credits,
            "new_credits": new_credits
        }


@router.post("/users/set-credits-by-email")
async def set_credits_by_email(
    email: str,
    credits: int,
    admin: dict = Depends(require_admin)
):
    """Set a user's credits by email address."""
    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, email, credits FROM users WHERE LOWER(email) = LOWER($1)",
            email
        )

        if not user:
            raise HTTPException(status_code=404, detail=f"User not found: {email}")

        previous_credits = user["credits"]

        await conn.execute(
            "UPDATE users SET credits = $1 WHERE id = $2",
            credits,
            user["id"]
        )

        return {
            "user_id": user["id"],
            "email": user["email"],
            "previous_credits": previous_credits,
            "new_credits": credits
        }


@router.get("/payments", response_model=List[RecentPayment])
async def list_payments(
    limit: int = 50,
    offset: int = 0,
    admin: dict = Depends(require_admin)
):
    """List recent payments."""
    async with get_connection() as conn:
        try:
            rows = await conn.fetch(
                """
                SELECT p.id, u.email as user_email, p.amount_cents, p.credits,
                       p.status, p.created_at
                FROM payments p
                JOIN users u ON u.id = p.user_id
                ORDER BY p.created_at DESC
                LIMIT $1 OFFSET $2
                """,
                limit,
                offset
            )

            return [
                RecentPayment(
                    id=str(row["id"]),
                    user_email=row["user_email"],
                    amount_cents=row["amount_cents"],
                    credits=row["credits"],
                    created_at=row["created_at"].isoformat(),
                    status=row["status"]
                )
                for row in rows
            ]
        except Exception as e:
            # Payments table might not exist yet
            return []


@router.get("/queries")
async def list_recent_queries(
    limit: int = 50,
    offset: int = 0,
    admin: dict = Depends(require_admin)
):
    """List recent queries across all users."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT m.id, u.email as user_email, m.conversation_id,
                   m.content as query_preview, m.created_at
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            JOIN users u ON u.id = c.user_id
            WHERE m.role = 'user'
            ORDER BY m.created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit,
            offset
        )

        return [
            {
                "id": row["id"],
                "user_email": row["user_email"],
                "conversation_id": str(row["conversation_id"]),
                "query_preview": (row["query_preview"][:100] + "...") if row["query_preview"] and len(row["query_preview"]) > 100 else row["query_preview"],
                "created_at": row["created_at"].isoformat()
            }
            for row in rows
        ]


@router.get("/metrics/daily")
async def get_daily_metrics(
    days: int = 30,
    admin: dict = Depends(require_admin)
):
    """Get daily metrics for charts."""
    async with get_connection() as conn:
        start_date = datetime.utcnow() - timedelta(days=days)

        # Daily signups
        signups = await conn.fetch(
            """
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM users
            WHERE created_at >= $1
            GROUP BY DATE(created_at)
            ORDER BY date
            """,
            start_date
        )

        # Daily queries
        queries = await conn.fetch(
            """
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM messages
            WHERE role = 'assistant' AND created_at >= $1
            GROUP BY DATE(created_at)
            ORDER BY date
            """,
            start_date
        )

        # Daily revenue
        try:
            revenue = await conn.fetch(
                """
                SELECT DATE(created_at) as date, SUM(amount_cents) as total
                FROM payments
                WHERE status = 'completed' AND created_at >= $1
                GROUP BY DATE(created_at)
                ORDER BY date
                """,
                start_date
            )
        except:
            revenue = []

        return {
            "signups": [{"date": str(r["date"]), "count": r["count"]} for r in signups],
            "queries": [{"date": str(r["date"]), "count": r["count"]} for r in queries],
            "revenue": [{"date": str(r["date"]), "total_cents": r["total"]} for r in revenue]
        }


@router.get("/check")
async def check_admin_access(user: dict = Depends(get_current_user)):
    """Check if current user has admin access."""
    user_email = user.get("email", "").lower()

    # Development mode bypass - only on localhost for safety
    if os.getenv("DEVELOPMENT_MODE") == "true":
        is_local = not os.getenv("RENDER") and not os.getenv("PRODUCTION")
        if is_local:
            return {"is_admin": True, "email": user_email, "dev_mode": True}

    is_admin = user_email in ADMIN_EMAILS
    return {"is_admin": is_admin, "email": user_email}


@router.post("/test-emails")
async def send_test_emails(
    email: str,
    admin: dict = Depends(require_admin)
):
    """Send all email templates to a specified address for testing."""
    from .email import (
        send_welcome_email,
        send_password_reset_email,
        send_password_changed_email,
        send_purchase_confirmation_email,
        send_refund_notification_email,
        send_low_credits_email,
        send_verification_email,
    )

    results = {}

    # Send all test emails
    results["welcome"] = await send_welcome_email(email, credits=5)
    results["password_reset"] = await send_password_reset_email(email, "test-token-preview-only")
    results["password_changed"] = await send_password_changed_email(email)
    results["purchase_confirmation"] = await send_purchase_confirmation_email(email, amount_cents=500, credits=10)
    results["refund_notification"] = await send_refund_notification_email(email, amount_cents=500)
    results["low_credits_1"] = await send_low_credits_email(email, remaining_credits=1)
    results["low_credits_0"] = await send_low_credits_email(email, remaining_credits=0)
    results["email_verification"] = await send_verification_email(email, "verify-token-preview-only")

    sent_count = sum(1 for v in results.values() if v)

    return {
        "message": f"Sent {sent_count}/8 test emails to {email}",
        "results": results
    }
