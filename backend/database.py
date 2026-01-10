"""Database connection and utilities for DecidePlease."""

import os
import secrets
import string
import asyncpg
import bcrypt
from contextlib import asynccontextmanager
from typing import Optional

# Database URL from environment (Render provides this automatically)
DATABASE_URL = os.getenv("DATABASE_URL")

# Superadmin configuration
SUPERADMIN_EMAIL = "hello@decideplease.com"
SUPERADMIN_PASSWORD = os.getenv("SUPERADMIN_PASSWORD")  # Optional: set via env var

# Connection pool (initialized on first use)
_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Get or create the database connection pool."""
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL environment variable not set")
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
        )
    return _pool


async def close_pool():
    """Close the database connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def get_connection():
    """Get a database connection from the pool."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


async def init_database():
    """Initialize database schema."""
    async with get_connection() as conn:
        # Create users table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                password_hash TEXT,
                auth_provider TEXT DEFAULT 'email',
                oauth_id TEXT,
                email_verified BOOLEAN DEFAULT FALSE,
                credits INTEGER DEFAULT 5,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # Add new auth columns if they don't exist (for migration from Clerk)
        try:
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT")
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email'")
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id TEXT")
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE")
        except Exception:
            pass  # Columns may already exist

        # Add role column for RBAC (superadmin, admin, employee, user)
        try:
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'")
        except Exception:
            pass  # Column may already exist

        # Add Stripe customer ID for saved payment methods
        try:
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT")
        except Exception:
            pass  # Column may already exist

        # Create conversations table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id UUID PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                title TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # Create messages table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                content TEXT,
                stage1 JSONB,
                stage2 JSONB,
                stage3 JSONB,
                mode TEXT DEFAULT 'standard',
                is_rerun BOOLEAN DEFAULT FALSE,
                rerun_input TEXT,
                revision_number INTEGER DEFAULT 0,
                parent_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # Add new columns if they don't exist (for migration)
        try:
            await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'standard'")
            await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_rerun BOOLEAN DEFAULT FALSE")
            await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS rerun_input TEXT")
            await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 0")
            await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL")
            # Stage 1.5 (cross-review) and context summary for follow-ups
            await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS stage1_5 JSONB")
            await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS context_summary JSONB")
        except Exception:
            pass  # Columns may already exist

        # Create payments table for tracking Stripe payments
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                stripe_session_id TEXT UNIQUE,
                stripe_payment_intent TEXT,
                amount_cents INTEGER NOT NULL,
                credits INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # Create indexes for common queries
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_conversations_user_id
            ON conversations(user_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
            ON messages(conversation_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_payments_user_id
            ON payments(user_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_created_at
            ON messages(created_at)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_created_at
            ON users(created_at)
        """)
        # Additional indexes for production performance
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_email
            ON users(email)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_role
            ON users(role)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_payments_status
            ON payments(status)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent
            ON payments(stripe_payment_intent)
        """)

        # Create admin audit log table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS admin_audit_log (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                admin_id TEXT,
                admin_email TEXT,
                action TEXT NOT NULL,
                target_user_id TEXT,
                details JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id
            ON admin_audit_log(admin_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
            ON admin_audit_log(created_at)
        """)

        # Create revoked tokens table for logout/token invalidation
        # Tokens are identified by their JTI (JWT ID) claim
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS revoked_tokens (
                jti TEXT PRIMARY KEY,
                user_id TEXT,
                revoked_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP NOT NULL
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user_id
            ON revoked_tokens(user_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at
            ON revoked_tokens(expires_at)
        """)

        # Create magic link tokens table for passwordless authentication
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS magic_link_tokens (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                token TEXT UNIQUE NOT NULL,
                email TEXT NOT NULL,
                user_id TEXT,
                token_type TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_token
            ON magic_link_tokens(token)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email
            ON magic_link_tokens(email)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_expires_at
            ON magic_link_tokens(expires_at)
        """)

        # Create user_quotas table for per-type decision tracking
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS user_quotas (
                id TEXT PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE UNIQUE,

                -- Subscription quotas (from plan, reset monthly)
                quick_decision_quota INTEGER DEFAULT 0,
                standard_decision_quota INTEGER DEFAULT 0,
                premium_decision_quota INTEGER DEFAULT 0,

                -- Used counts (reset monthly with subscription renewal)
                quick_decision_used INTEGER DEFAULT 0,
                standard_decision_used INTEGER DEFAULT 0,
                premium_decision_used INTEGER DEFAULT 0,

                -- Period tracking (lazy reset on access)
                quota_period_start TIMESTAMP,
                quota_period_end TIMESTAMP,

                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id
            ON user_quotas(user_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_quotas_period_end
            ON user_quotas(quota_period_end)
        """)

        # Create admin_granted_decisions table for non-expiring admin grants
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS admin_granted_decisions (
                id TEXT PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,

                -- Per-type grants
                quick_decisions INTEGER DEFAULT 0,
                standard_decisions INTEGER DEFAULT 0,
                premium_decisions INTEGER DEFAULT 0,

                -- Audit info
                granted_by TEXT,
                granted_by_email TEXT,
                granted_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP,  -- NULL = never expires
                notes TEXT,

                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_admin_granted_user_id
            ON admin_granted_decisions(user_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_admin_granted_expires
            ON admin_granted_decisions(expires_at)
        """)

        # Migrate existing credits to admin-granted decisions
        await migrate_credits_to_quotas(conn)

        # Seed superadmin account if it doesn't exist
        await seed_superadmin(conn)


async def migrate_credits_to_quotas(conn):
    """
    Migrate existing credits to admin-granted decisions.

    This is a one-time migration that converts legacy credits to the new
    per-type quota system. Users with credits will receive admin-granted
    standard decisions (which never expire).

    - Users with 0 credits: No migration needed
    - Users with 5 credits (default): Grant 5 standard decisions
    - Users with N credits: Grant N standard decisions
    - Users with 9999999 credits (unlimited): Skip, handled by role permissions
    """
    import uuid

    # Check if migration has already run by looking for a marker
    marker = await conn.fetchval(
        """
        SELECT COUNT(*) FROM admin_granted_decisions
        WHERE notes = 'MIGRATION: Legacy credits converted'
        """
    )
    if marker and marker > 0:
        # Migration already done
        return

    # Find users with credits > 0 and < 9999999 (unlimited)
    users_to_migrate = await conn.fetch(
        """
        SELECT id, email, credits FROM users
        WHERE credits > 0 AND credits < 9999999
        """
    )

    if not users_to_migrate:
        print("[MIGRATION] No users need credit migration")
        return

    print(f"[MIGRATION] Migrating {len(users_to_migrate)} users from credits to quotas...")

    for user in users_to_migrate:
        user_id = user["id"]
        credits = user["credits"]

        # Create admin-granted decisions
        grant_id = str(uuid.uuid4())
        await conn.execute(
            """
            INSERT INTO admin_granted_decisions
                (id, user_id, standard_decisions, granted_by, granted_by_email,
                 notes, expires_at, granted_at)
            VALUES ($1, $2, $3, 'SYSTEM', 'migration@decideplease.com',
                    'MIGRATION: Legacy credits converted', NULL, NOW())
            ON CONFLICT DO NOTHING
            """,
            grant_id,
            user_id,
            credits
        )

    print(f"[MIGRATION] Successfully migrated {len(users_to_migrate)} users")


def generate_password(length: int = 16) -> str:
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


async def seed_superadmin(conn):
    """Create the superadmin account if it doesn't exist."""
    import uuid

    # Check if superadmin already exists
    existing = await conn.fetchrow(
        "SELECT id, role FROM users WHERE email = $1",
        SUPERADMIN_EMAIL
    )

    if existing:
        # Ensure they have superadmin role and max credits
        if existing['role'] != 'superadmin':
            await conn.execute(
                "UPDATE users SET role = 'superadmin', credits = 9999999 WHERE email = $1",
                SUPERADMIN_EMAIL
            )
            print(f"[SUPERADMIN] Updated {SUPERADMIN_EMAIL} to superadmin role")
        return

    # Check if we're in production
    is_production = (
        os.getenv("RENDER") == "true" or
        os.getenv("PRODUCTION") == "true" or
        os.getenv("ENVIRONMENT") == "production"
    )

    # In production, require SUPERADMIN_PASSWORD to be set
    if is_production and not SUPERADMIN_PASSWORD:
        raise RuntimeError(
            "SUPERADMIN_PASSWORD environment variable must be set in production. "
            "Generate a secure password and set it before deploying."
        )

    # Generate password if not provided via env (development only)
    password = SUPERADMIN_PASSWORD or generate_password()

    # Hash the password
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')

    # Create the superadmin user
    user_id = str(uuid.uuid4())
    await conn.execute(
        """
        INSERT INTO users (id, email, password_hash, role, credits, email_verified, auth_provider)
        VALUES ($1, $2, $3, 'superadmin', 9999999, TRUE, 'email')
        """,
        user_id, SUPERADMIN_EMAIL, password_hash
    )

    # Log superadmin creation without exposing password
    print(f"\n{'='*60}")
    print(f"[SUPERADMIN] Created superadmin account:")
    print(f"  Email: {SUPERADMIN_EMAIL}")
    if not SUPERADMIN_PASSWORD:
        print(f"  Password: [AUTO-GENERATED - Check secure logs or set SUPERADMIN_PASSWORD env var]")
        print(f"  WARNING: Auto-generated password cannot be recovered. Set SUPERADMIN_PASSWORD env var for production.")
    else:
        print(f"  Password: (from SUPERADMIN_PASSWORD env var)")
    print(f"  Credits: 9999999")
    print(f"{'='*60}\n")
