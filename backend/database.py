"""Database connection and utilities for DecidePlease."""

import os
import asyncpg
from contextlib import asynccontextmanager
from typing import Optional

# Database URL from environment (Render provides this automatically)
DATABASE_URL = os.getenv("DATABASE_URL")

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
