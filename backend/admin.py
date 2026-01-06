"""Admin panel routes and utilities for DecidePlease."""

import os
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr

from .auth_custom import get_current_user, hash_password, create_impersonation_token
from .database import get_connection
from .permissions import has_permission, can_manage_role, can_assign_role, is_staff, PERMISSIONS
from . import storage_pg as storage
from .rate_limit import limiter

# Admin emails - set via environment variable (comma-separated)
# Kept for backwards compatibility - new system uses role column in DB
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


def require_permission(permission: str):
    """
    Create a dependency that requires a specific permission.

    Uses role-based access control from permissions.py.
    Falls back to ADMIN_EMAILS env var for backwards compatibility.
    """
    async def dependency(user: dict = Depends(get_current_user)) -> dict:
        user_email = user.get("email", "").lower()
        user_role = user.get("role", "user")

        # Development mode bypass - only on localhost for safety
        if os.getenv("DEVELOPMENT_MODE") == "true":
            is_local = not os.getenv("RENDER") and not os.getenv("PRODUCTION")
            if is_local:
                print(f"[WARNING] Admin bypass active for {user_email} (DEVELOPMENT_MODE=true)")
                return user

        # Check role-based permission first
        if has_permission(user_role, permission):
            return user

        # Fallback: Check legacy ADMIN_EMAILS env var (backwards compatibility)
        # Legacy admins get equivalent of 'admin' role permissions
        if user_email in ADMIN_EMAILS and permission in [
            'view_dashboard', 'view_users', 'view_user_detail', 'view_conversations',
            'view_payments', 'view_queries', 'view_metrics', 'modify_credits',
            'delete_users', 'send_password_reset', 'manage_employees'
        ]:
            return user

        raise HTTPException(
            status_code=403,
            detail=f"Permission denied: {permission} required"
        )

    return dependency


# Pre-built permission dependencies for each endpoint
require_view_dashboard = require_permission('view_dashboard')
require_view_users = require_permission('view_users')
require_view_payments = require_permission('view_payments')
require_view_queries = require_permission('view_queries')
require_view_metrics = require_permission('view_metrics')
require_modify_credits = require_permission('modify_credits')
require_delete_users = require_permission('delete_users')
require_send_password_reset = require_permission('send_password_reset')
require_manage_employees = require_permission('manage_employees')
require_manage_admins = require_permission('manage_admins')
require_impersonate = require_permission('impersonate')


@router.get("/stats", response_model=DashboardStats)
@limiter.limit("30/minute")
async def get_dashboard_stats(request: Request, admin: dict = Depends(require_view_dashboard)):
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
        except Exception as e:
            # Payments table may not exist yet
            print(f"[ADMIN] Warning: Could not fetch total revenue: {e}")
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
        except Exception as e:
            # Payments table may not exist yet
            print(f"[ADMIN] Warning: Could not fetch today's revenue: {e}")
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
@limiter.limit("30/minute")
async def list_users(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    admin: dict = Depends(require_view_users)
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
@limiter.limit("30/minute")
async def get_user_detail(request: Request, user_id: str, admin: dict = Depends(require_view_users)):
    """Get detailed info for a specific user."""
    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, email, credits, created_at FROM users WHERE id = $1",
            user_id
        )

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get user's conversations - only count user messages (queries)
        conversations = await conn.fetch(
            """
            SELECT c.id, c.title, c.created_at,
                   COUNT(m.id) FILTER (WHERE m.role = 'user') as message_count
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
        except Exception as e:
            # Payments table may not exist yet
            print(f"[ADMIN] Warning: Could not fetch user payments: {e}")
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
@limiter.limit("10/minute")
async def adjust_user_credits(
    request: Request,
    user_id: str,
    credits: int,
    admin: dict = Depends(require_modify_credits)
):
    """Manually adjust a user's credits (add or remove)."""
    admin_id = admin.get("user_id", "")
    admin_email = admin.get("email", "")

    async with get_connection() as conn:
        # Check user exists
        user = await conn.fetchrow(
            "SELECT id, email, credits FROM users WHERE id = $1",
            user_id
        )

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        previous_credits = user["credits"]
        new_credits = max(0, previous_credits + credits)

        await conn.execute(
            "UPDATE users SET credits = $1 WHERE id = $2",
            new_credits,
            user_id
        )

    # Log the action
    await storage.log_admin_action(
        admin_id=admin_id,
        admin_email=admin_email,
        action="adjust_credits",
        target_user_id=user_id,
        details={
            "target_email": user["email"],
            "previous_credits": previous_credits,
            "adjustment": credits,
            "new_credits": new_credits
        }
    )

    return {
        "user_id": user_id,
        "previous_credits": previous_credits,
        "adjustment": credits,
        "new_credits": new_credits
    }


@router.post("/users/set-credits-by-email")
@limiter.limit("10/minute")
async def set_credits_by_email(
    request: Request,
    email: str,
    credits: int,
    admin: dict = Depends(require_modify_credits)
):
    """Set a user's credits by email address."""
    admin_id = admin.get("user_id", "")
    admin_email = admin.get("email", "")

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

    # Log the action
    await storage.log_admin_action(
        admin_id=admin_id,
        admin_email=admin_email,
        action="set_credits",
        target_user_id=user["id"],
        details={
            "target_email": user["email"],
            "previous_credits": previous_credits,
            "new_credits": credits
        }
    )

    return {
        "user_id": user["id"],
        "email": user["email"],
        "previous_credits": previous_credits,
        "new_credits": credits
    }


@router.delete("/users/delete-by-email")
@limiter.limit("5/minute")
async def delete_user_by_email(
    request: Request,
    email: str,
    admin: dict = Depends(require_delete_users)
):
    """Delete a user account and all their data by email address."""
    admin_id = admin.get("user_id", "")
    admin_email = admin.get("email", "")

    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, email, credits, role FROM users WHERE LOWER(email) = LOWER($1)",
            email
        )

        if not user:
            raise HTTPException(status_code=404, detail=f"User not found: {email}")

        user_id = user["id"]
        user_role = user["role"] or "user"

        # Check if admin can manage this user
        if not can_manage_role(admin.get("role", "user"), user_role):
            raise HTTPException(
                status_code=403,
                detail=f"You cannot delete users with the '{user_role}' role"
            )

        # Delete in order: messages -> conversations -> payments -> user
        # Get conversation IDs first
        conv_ids = await conn.fetch(
            "SELECT id FROM conversations WHERE user_id = $1",
            user_id
        )
        conv_id_list = [row["id"] for row in conv_ids]

        deleted_messages = 0
        if conv_id_list:
            deleted_messages = await conn.fetchval(
                "DELETE FROM messages WHERE conversation_id = ANY($1) RETURNING COUNT(*)",
                conv_id_list
            ) or 0

        deleted_convs = await conn.fetchval(
            "DELETE FROM conversations WHERE user_id = $1 RETURNING COUNT(*)",
            user_id
        ) or 0

        deleted_payments = 0
        try:
            deleted_payments = await conn.fetchval(
                "DELETE FROM payments WHERE user_id = $1 RETURNING COUNT(*)",
                user_id
            ) or 0
        except Exception as e:
            # Log but continue - payments table may not exist
            print(f"[ADMIN] Warning: Could not delete user payments: {e}")

        await conn.execute("DELETE FROM users WHERE id = $1", user_id)

    # Log the action
    await storage.log_admin_action(
        admin_id=admin_id,
        admin_email=admin_email,
        action="delete_user",
        target_user_id=user_id,
        details={
            "target_email": email,
            "target_role": user_role,
            "deleted_conversations": deleted_convs,
            "deleted_messages": deleted_messages,
            "deleted_payments": deleted_payments
        }
    )

    return {
        "message": f"User {email} deleted",
        "deleted": {
            "user": 1,
            "conversations": deleted_convs,
            "messages": deleted_messages,
            "payments": deleted_payments
        }
    }


@router.post("/users/send-password-reset")
@limiter.limit("5/minute")
async def admin_send_password_reset(
    request: Request,
    email: str,
    admin: dict = Depends(require_send_password_reset)
):
    """Send a password reset email to a user (admin-triggered)."""
    from .email import send_password_reset_email
    from jose import jwt
    import secrets
    import os

    admin_id = admin.get("user_id", "")
    admin_email = admin.get("email", "")

    # Get JWT secret
    JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")

    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)",
            email
        )

        if not user:
            raise HTTPException(status_code=404, detail=f"User not found: {email}")

        # Generate JWT reset token (consistent with user-initiated reset)
        reset_token = jwt.encode(
            {
                "sub": user["id"],
                "email": user["email"],
                "type": "password_reset",
                "exp": datetime.utcnow() + timedelta(hours=1),
                "jti": secrets.token_urlsafe(16),
                "admin_triggered": True,  # Mark as admin-triggered for audit
            },
            JWT_SECRET,
            algorithm="HS256"
        )

        # Send the email
        sent = await send_password_reset_email(user["email"], reset_token)

    # Log the action
    await storage.log_admin_action(
        admin_id=admin_id,
        admin_email=admin_email,
        action="send_password_reset",
        target_user_id=user["id"],
        details={"target_email": email, "sent": sent}
    )

    return {
        "message": f"Password reset email sent to {email}",
        "sent": sent
    }


@router.get("/payments", response_model=List[RecentPayment])
@limiter.limit("30/minute")
async def list_payments(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    admin: dict = Depends(require_view_payments)
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
@limiter.limit("30/minute")
async def list_recent_queries(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    admin: dict = Depends(require_view_queries)
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


@router.get("/decisions")
@limiter.limit("30/minute")
async def list_recent_decisions(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    admin: dict = Depends(require_view_queries)
):
    """
    List recent decisions with full question and chairman response.
    Shows what users are asking and the council's final answers.
    """
    async with get_connection() as conn:
        if search:
            # Search in both user questions and responses
            rows = await conn.fetch(
                """
                SELECT
                    user_msg.id as user_msg_id,
                    user_msg.content as question,
                    user_msg.created_at as asked_at,
                    asst_msg.id as response_id,
                    asst_msg.stage3_response as chairman_response,
                    asst_msg.mode,
                    asst_msg.created_at as answered_at,
                    u.email as user_email,
                    c.id as conversation_id,
                    c.title as conversation_title
                FROM messages user_msg
                JOIN conversations c ON c.id = user_msg.conversation_id
                JOIN users u ON u.id = c.user_id
                LEFT JOIN messages asst_msg ON asst_msg.conversation_id = user_msg.conversation_id
                    AND asst_msg.role = 'assistant'
                    AND asst_msg.created_at > user_msg.created_at
                    AND NOT EXISTS (
                        SELECT 1 FROM messages m2
                        WHERE m2.conversation_id = user_msg.conversation_id
                        AND m2.role = 'assistant'
                        AND m2.created_at > user_msg.created_at
                        AND m2.created_at < asst_msg.created_at
                    )
                WHERE user_msg.role = 'user'
                AND (
                    LOWER(user_msg.content) LIKE LOWER($1)
                    OR LOWER(asst_msg.stage3_response) LIKE LOWER($1)
                    OR LOWER(u.email) LIKE LOWER($1)
                )
                ORDER BY user_msg.created_at DESC
                LIMIT $2 OFFSET $3
                """,
                f"%{search}%",
                limit,
                offset
            )
        else:
            rows = await conn.fetch(
                """
                SELECT
                    user_msg.id as user_msg_id,
                    user_msg.content as question,
                    user_msg.created_at as asked_at,
                    asst_msg.id as response_id,
                    asst_msg.stage3_response as chairman_response,
                    asst_msg.mode,
                    asst_msg.created_at as answered_at,
                    u.email as user_email,
                    c.id as conversation_id,
                    c.title as conversation_title
                FROM messages user_msg
                JOIN conversations c ON c.id = user_msg.conversation_id
                JOIN users u ON u.id = c.user_id
                LEFT JOIN messages asst_msg ON asst_msg.conversation_id = user_msg.conversation_id
                    AND asst_msg.role = 'assistant'
                    AND asst_msg.created_at > user_msg.created_at
                    AND NOT EXISTS (
                        SELECT 1 FROM messages m2
                        WHERE m2.conversation_id = user_msg.conversation_id
                        AND m2.role = 'assistant'
                        AND m2.created_at > user_msg.created_at
                        AND m2.created_at < asst_msg.created_at
                    )
                WHERE user_msg.role = 'user'
                ORDER BY user_msg.created_at DESC
                LIMIT $1 OFFSET $2
                """,
                limit,
                offset
            )

        return [
            {
                "id": row["user_msg_id"],
                "user_email": row["user_email"],
                "conversation_id": str(row["conversation_id"]),
                "conversation_title": row["conversation_title"],
                "question": row["question"],
                "chairman_response": row["chairman_response"],
                "mode": row["mode"] or "standard",
                "asked_at": row["asked_at"].isoformat(),
                "answered_at": row["answered_at"].isoformat() if row["answered_at"] else None,
            }
            for row in rows
        ]


@router.get("/decisions/{message_id}")
@limiter.limit("30/minute")
async def get_decision_detail(
    request: Request,
    message_id: str,
    admin: dict = Depends(require_view_queries)
):
    """
    Get full details of a specific decision including all stages.
    """
    async with get_connection() as conn:
        # Get the user message
        user_msg = await conn.fetchrow(
            """
            SELECT m.id, m.content, m.created_at, c.id as conversation_id, u.email
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            JOIN users u ON u.id = c.user_id
            WHERE m.id = $1 AND m.role = 'user'
            """,
            message_id
        )

        if not user_msg:
            raise HTTPException(status_code=404, detail="Decision not found")

        # Get the corresponding assistant message
        asst_msg = await conn.fetchrow(
            """
            SELECT id, stage1, stage1_5, stage2, stage3_response, mode, created_at
            FROM messages
            WHERE conversation_id = $1 AND role = 'assistant' AND created_at > $2
            ORDER BY created_at ASC
            LIMIT 1
            """,
            user_msg["conversation_id"],
            user_msg["created_at"]
        )

        return {
            "question": {
                "id": user_msg["id"],
                "content": user_msg["content"],
                "user_email": user_msg["email"],
                "created_at": user_msg["created_at"].isoformat()
            },
            "response": {
                "id": asst_msg["id"] if asst_msg else None,
                "stage1": asst_msg["stage1"] if asst_msg else None,
                "stage1_5": asst_msg["stage1_5"] if asst_msg else None,
                "stage2": asst_msg["stage2"] if asst_msg else None,
                "chairman_response": asst_msg["stage3_response"] if asst_msg else None,
                "mode": asst_msg["mode"] if asst_msg else None,
                "created_at": asst_msg["created_at"].isoformat() if asst_msg else None
            } if asst_msg else None
        }


@router.get("/metrics/daily")
@limiter.limit("30/minute")
async def get_daily_metrics(
    request: Request,
    days: int = 30,
    admin: dict = Depends(require_view_metrics)
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
        except Exception as e:
            # Payments table may not exist yet
            print(f"[ADMIN] Warning: Could not fetch daily revenue metrics: {e}")
            revenue = []

        return {
            "signups": [{"date": str(r["date"]), "count": r["count"]} for r in signups],
            "queries": [{"date": str(r["date"]), "count": r["count"]} for r in queries],
            "revenue": [{"date": str(r["date"]), "total_cents": r["total"]} for r in revenue]
        }


@router.get("/check")
@limiter.limit("30/minute")
async def check_admin_access(request: Request, user: dict = Depends(get_current_user)):
    """Check if current user has admin/staff access and their role."""
    user_email = user.get("email", "").lower()
    user_role = user.get("role", "user")

    # Development mode bypass - only on localhost for safety
    if os.getenv("DEVELOPMENT_MODE") == "true":
        is_local = not os.getenv("RENDER") and not os.getenv("PRODUCTION")
        if is_local:
            return {
                "is_admin": True,
                "is_staff": True,
                "role": "superadmin",
                "email": user_email,
                "dev_mode": True,
                "permissions": list(PERMISSIONS.keys())  # All permissions in dev mode
            }

    # Check if user is staff (has any admin-level role)
    user_is_staff = is_staff(user_role)

    # Legacy ADMIN_EMAILS support
    legacy_admin = user_email in ADMIN_EMAILS

    # Get user's permissions
    user_permissions = [
        perm for perm, roles in PERMISSIONS.items()
        if user_role in roles
    ]

    # Legacy admins get admin-equivalent permissions
    if legacy_admin and not user_is_staff:
        user_permissions = [
            'view_dashboard', 'view_users', 'view_user_detail', 'view_conversations',
            'view_payments', 'view_queries', 'view_metrics', 'modify_credits',
            'delete_users', 'send_password_reset', 'manage_employees'
        ]

    return {
        "is_admin": user_role in ['admin', 'superadmin'] or legacy_admin,
        "is_staff": user_is_staff or legacy_admin,
        "role": user_role if user_is_staff else ("admin" if legacy_admin else "user"),
        "email": user_email,
        "permissions": user_permissions
    }


@router.post("/test-emails")
@limiter.limit("5/minute")
async def send_test_emails(
    request: Request,
    email: str,
    admin: dict = Depends(require_view_dashboard)
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


# ============== Staff Management Endpoints ==============

class CreateStaffRequest(BaseModel):
    """Request to create a new staff member."""
    email: EmailStr
    password: str
    role: str  # 'employee' or 'admin'


class UpdateRoleRequest(BaseModel):
    """Request to update a user's role."""
    role: str


@router.get("/staff")
@limiter.limit("30/minute")
async def list_staff_users(request: Request, admin: dict = Depends(require_manage_employees)):
    """List all staff members (employees, admins, superadmins)."""
    staff = await storage.get_staff_users()
    return {"staff": staff}


@router.post("/staff")
@limiter.limit("10/minute")
async def create_staff_user(
    http_request: Request,
    request: CreateStaffRequest,
    admin: dict = Depends(require_manage_employees)
):
    """Create a new staff user (employee or admin)."""
    admin_role = admin.get("role", "user")
    admin_email = admin.get("email", "")
    admin_id = admin.get("user_id", "")

    # Check if the admin can assign this role
    if not can_assign_role(admin_role, request.role):
        raise HTTPException(
            status_code=403,
            detail=f"You cannot assign the '{request.role}' role"
        )

    # Check if user already exists
    existing = await storage.get_user_by_email(request.email)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"User with email {request.email} already exists"
        )

    # Hash password and create user
    password_hash = hash_password(request.password)
    new_user = await storage.create_staff_user(
        email=request.email,
        password_hash=password_hash,
        role=request.role
    )

    # Log the action
    await storage.log_admin_action(
        admin_id=admin_id,
        admin_email=admin_email,
        action="create_staff",
        target_user_id=new_user["id"],
        details={"email": request.email, "role": request.role}
    )

    return {
        "message": f"Staff user created: {request.email}",
        "user": new_user
    }


@router.post("/users/{user_id}/role")
@limiter.limit("10/minute")
async def update_user_role(
    http_request: Request,
    user_id: str,
    request: UpdateRoleRequest,
    admin: dict = Depends(require_manage_employees)
):
    """Update a user's role."""
    admin_role = admin.get("role", "user")
    admin_email = admin.get("email", "")
    admin_id = admin.get("user_id", "")

    # Get target user's current role
    target_role = await storage.get_user_role(user_id)
    if target_role is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if admin can manage this user
    if not can_manage_role(admin_role, target_role):
        raise HTTPException(
            status_code=403,
            detail=f"You cannot modify users with the '{target_role}' role"
        )

    # Check if admin can assign the new role
    if not can_assign_role(admin_role, request.role):
        raise HTTPException(
            status_code=403,
            detail=f"You cannot assign the '{request.role}' role"
        )

    # Update the role
    success = await storage.update_user_role(user_id, request.role)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update role")

    # Log the action
    await storage.log_admin_action(
        admin_id=admin_id,
        admin_email=admin_email,
        action="change_role",
        target_user_id=user_id,
        details={"old_role": target_role, "new_role": request.role}
    )

    return {
        "message": f"User role updated to '{request.role}'",
        "user_id": user_id,
        "old_role": target_role,
        "new_role": request.role
    }


# ============== Impersonation Endpoints ==============

@router.get("/impersonate/{user_id}")
@limiter.limit("5/minute")
async def impersonate_user(
    request: Request,
    user_id: str,
    admin: dict = Depends(require_impersonate)
):
    """
    Get an impersonation token for a user (superadmin only).

    Returns a short-lived access token that allows acting as the target user.
    All actions are tracked with the impersonated_by claim in the token.
    """
    admin_id = admin.get("user_id", "")
    admin_email = admin.get("email", "")

    # Get target user info
    async with get_connection() as conn:
        target_user = await conn.fetchrow(
            "SELECT id, email, role FROM users WHERE id = $1",
            user_id
        )

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    target_email = target_user["email"]
    target_role = target_user["role"] or "user"

    # Create impersonation token (short-lived, includes impersonated_by claim)
    impersonation_token = create_impersonation_token(
        user_id=user_id,
        email=target_email,
        role=target_role,
        impersonated_by=admin_id
    )

    # Log the impersonation
    await storage.log_admin_action(
        admin_id=admin_id,
        admin_email=admin_email,
        action="impersonate_start",
        target_user_id=user_id,
        details={"target_email": target_email}
    )

    return {
        "access_token": impersonation_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": target_email,
            "role": target_role
        },
        "impersonated_by": admin_email,
        "expires_in": 3600  # 1 hour
    }


@router.post("/impersonate/end")
@limiter.limit("30/minute")
async def end_impersonation(request: Request, admin: dict = Depends(get_current_user)):
    """
    Log the end of an impersonation session.

    Called when the superadmin clicks "Exit" on the impersonation banner.
    The token is handled client-side, this just logs the action.
    """
    impersonated_by = admin.get("impersonated_by")

    if not impersonated_by:
        raise HTTPException(
            status_code=400,
            detail="Not currently impersonating anyone"
        )

    # Log the end of impersonation
    await storage.log_admin_action(
        admin_id=impersonated_by,
        admin_email="",  # We don't have the admin's email easily accessible
        action="impersonate_end",
        target_user_id=admin.get("user_id"),
        details={"target_email": admin.get("email")}
    )

    return {"message": "Impersonation session ended"}


# ============== Audit Log Endpoints ==============

@router.get("/audit-log")
@limiter.limit("30/minute")
async def get_audit_log(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    admin: dict = Depends(require_view_dashboard)
):
    """Get the admin audit log (visible to all staff)."""
    logs = await storage.get_audit_log(limit=limit, offset=offset)
    return {"audit_log": logs}
