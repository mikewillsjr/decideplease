"""Postgres-based storage for conversations."""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import UUID

from .database import get_connection


async def create_conversation(conversation_id: str, user_id: str) -> Dict[str, Any]:
    """
    Create a new conversation.

    Args:
        conversation_id: Unique identifier for the conversation
        user_id: The Clerk user ID who owns this conversation

    Returns:
        New conversation dict
    """
    async with get_connection() as conn:
        await conn.execute(
            """
            INSERT INTO conversations (id, user_id, title, created_at)
            VALUES ($1, $2, $3, NOW())
            """,
            UUID(conversation_id),
            user_id,
            "New Conversation"
        )

        return {
            "id": conversation_id,
            "created_at": datetime.utcnow().isoformat(),
            "title": "New Conversation",
            "messages": []
        }


async def get_conversation(conversation_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Load a conversation from storage.

    Args:
        conversation_id: Unique identifier for the conversation
        user_id: The Clerk user ID (for ownership check)

    Returns:
        Conversation dict or None if not found
    """
    async with get_connection() as conn:
        # Get conversation metadata
        row = await conn.fetchrow(
            """
            SELECT id, title, created_at
            FROM conversations
            WHERE id = $1 AND user_id = $2
            """,
            UUID(conversation_id),
            user_id
        )

        if row is None:
            return None

        # Get all messages for this conversation
        messages = await conn.fetch(
            """
            SELECT id, role, content, stage1, stage2, stage3
            FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC
            """,
            UUID(conversation_id)
        )

        message_list = []

        for msg in messages:
            if msg["role"] == "user":
                message_list.append({
                    "role": "user",
                    "content": msg["content"]
                })
            else:
                # Skip assistant messages with no stage data at all
                # (these are orphaned from interrupted processing)
                if msg["stage1"] is None and msg["stage2"] is None and msg["stage3"] is None:
                    continue

                message_list.append({
                    "role": "assistant",
                    "stage1": msg["stage1"],
                    "stage2": msg["stage2"],
                    "stage3": msg["stage3"]
                })

        return {
            "id": str(row["id"]),
            "created_at": row["created_at"].isoformat(),
            "title": row["title"] or "New Conversation",
            "messages": message_list
        }


async def list_conversations(user_id: str) -> List[Dict[str, Any]]:
    """
    List all conversations for a user (metadata only).

    Args:
        user_id: The Clerk user ID

    Returns:
        List of conversation metadata dicts
    """
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT c.id, c.title, c.created_at,
                   COUNT(m.id) as message_count
            FROM conversations c
            LEFT JOIN messages m ON m.conversation_id = c.id
            WHERE c.user_id = $1
            GROUP BY c.id
            ORDER BY c.created_at DESC
            """,
            user_id
        )

        return [
            {
                "id": str(row["id"]),
                "created_at": row["created_at"].isoformat(),
                "title": row["title"] or "New Conversation",
                "message_count": row["message_count"]
            }
            for row in rows
        ]


async def add_user_message(conversation_id: str, content: str):
    """
    Add a user message to a conversation.

    Args:
        conversation_id: Conversation identifier
        content: User message content
    """
    async with get_connection() as conn:
        await conn.execute(
            """
            INSERT INTO messages (conversation_id, role, content, created_at)
            VALUES ($1, 'user', $2, NOW())
            """,
            UUID(conversation_id),
            content
        )


async def add_assistant_message(
    conversation_id: str,
    stage1: List[Dict[str, Any]],
    stage2: List[Dict[str, Any]],
    stage3: Dict[str, Any]
):
    """
    Add an assistant message with all 3 stages to a conversation.

    Args:
        conversation_id: Conversation identifier
        stage1: List of individual model responses
        stage2: List of model rankings
        stage3: Final synthesized response
    """
    async with get_connection() as conn:
        await conn.execute(
            """
            INSERT INTO messages (conversation_id, role, stage1, stage2, stage3, created_at)
            VALUES ($1, 'assistant', $2, $3, $4, NOW())
            """,
            UUID(conversation_id),
            json.dumps(stage1),
            json.dumps(stage2),
            json.dumps(stage3)
        )


async def create_pending_assistant_message(conversation_id: str) -> int:
    """
    Create a pending assistant message placeholder.
    Returns the message ID for later updates.
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO messages (conversation_id, role, created_at)
            VALUES ($1, 'assistant', NOW())
            RETURNING id
            """,
            UUID(conversation_id)
        )
        return row["id"]


async def update_assistant_message_stage(message_id: int, stage: str, data: Any):
    """
    Update a specific stage of an assistant message.

    Args:
        message_id: The message ID
        stage: 'stage1', 'stage2', or 'stage3'
        data: The stage data to save
    """
    if stage not in ('stage1', 'stage2', 'stage3'):
        raise ValueError(f"Invalid stage: {stage}")

    async with get_connection() as conn:
        await conn.execute(
            f"""
            UPDATE messages
            SET {stage} = $1
            WHERE id = $2
            """,
            json.dumps(data),
            message_id
        )


async def update_conversation_title(conversation_id: str, title: str):
    """
    Update the title of a conversation.

    Args:
        conversation_id: Conversation identifier
        title: New title for the conversation
    """
    async with get_connection() as conn:
        await conn.execute(
            """
            UPDATE conversations
            SET title = $1
            WHERE id = $2
            """,
            title,
            UUID(conversation_id)
        )


async def delete_conversation(conversation_id: str, user_id: str) -> bool:
    """
    Delete a conversation and all its messages.

    Args:
        conversation_id: Conversation identifier
        user_id: User ID for ownership verification

    Returns:
        True if deleted, False if not found
    """
    async with get_connection() as conn:
        # Delete conversation (messages will cascade delete)
        result = await conn.execute(
            """
            DELETE FROM conversations
            WHERE id = $1 AND user_id = $2
            """,
            UUID(conversation_id),
            user_id
        )
        return result == "DELETE 1"


# User management functions

async def get_or_create_user(user_id: str, email: str) -> Dict[str, Any]:
    """
    Get a user by Clerk ID, or create if doesn't exist.

    Args:
        user_id: Clerk user ID
        email: User's email address

    Returns:
        User dict with id, email, credits
    """
    async with get_connection() as conn:
        # Try to get existing user
        row = await conn.fetchrow(
            "SELECT id, email, credits FROM users WHERE id = $1",
            user_id
        )

        if row:
            return {
                "id": row["id"],
                "email": row["email"],
                "credits": row["credits"]
            }

        # Create new user with 5 free credits
        await conn.execute(
            """
            INSERT INTO users (id, email, credits, created_at)
            VALUES ($1, $2, 5, NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            user_id,
            email
        )

        return {
            "id": user_id,
            "email": email,
            "credits": 5
        }


async def get_user_credits(user_id: str) -> int:
    """
    Get the current credit balance for a user.

    Args:
        user_id: Clerk user ID

    Returns:
        Number of credits remaining
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT credits FROM users WHERE id = $1",
            user_id
        )
        return row["credits"] if row else 0


async def deduct_credit(user_id: str) -> bool:
    """
    Deduct one credit from a user's balance.

    Args:
        user_id: Clerk user ID

    Returns:
        True if credit was deducted, False if insufficient credits
    """
    async with get_connection() as conn:
        result = await conn.execute(
            """
            UPDATE users
            SET credits = credits - 1
            WHERE id = $1 AND credits > 0
            """,
            user_id
        )
        # Returns "UPDATE X" where X is number of rows affected
        return result == "UPDATE 1"


async def add_credits(user_id: str, amount: int):
    """
    Add credits to a user's balance.

    Args:
        user_id: Clerk user ID
        amount: Number of credits to add
    """
    async with get_connection() as conn:
        await conn.execute(
            """
            UPDATE users
            SET credits = credits + $1
            WHERE id = $2
            """,
            amount,
            user_id
        )


async def record_payment(
    user_id: str,
    stripe_session_id: str,
    stripe_payment_intent: str,
    amount_cents: int,
    credits: int
):
    """
    Record a successful payment in the database.

    Args:
        user_id: Clerk user ID
        stripe_session_id: Stripe checkout session ID
        stripe_payment_intent: Stripe payment intent ID
        amount_cents: Payment amount in cents
        credits: Number of credits purchased
    """
    async with get_connection() as conn:
        await conn.execute(
            """
            INSERT INTO payments (user_id, stripe_session_id, stripe_payment_intent, amount_cents, credits, status, created_at)
            VALUES ($1, $2, $3, $4, $5, 'completed', NOW())
            ON CONFLICT (stripe_session_id) DO NOTHING
            """,
            user_id,
            stripe_session_id,
            stripe_payment_intent,
            amount_cents,
            credits
        )
