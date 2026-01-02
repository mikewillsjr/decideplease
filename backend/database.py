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
        # Create users table (synced from Clerk)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                credits INTEGER DEFAULT 5,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

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
