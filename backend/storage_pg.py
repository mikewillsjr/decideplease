"""Postgres-based storage for conversations."""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import UUID

from .database import get_connection
from .config import RUN_MODES


def parse_json_field(value):
    """Parse a JSON field that might be a string or already parsed."""
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


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
                    "stage1": parse_json_field(msg["stage1"]),
                    "stage2": parse_json_field(msg["stage2"]),
                    "stage3": parse_json_field(msg["stage3"])
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
    Get a user by ID, or create if doesn't exist.

    Args:
        user_id: User ID
        email: User's email address

    Returns:
        User dict with id, email, credits
    """
    async with get_connection() as conn:
        # Try to get existing user
        row = await conn.fetchrow(
            "SELECT id, email, credits, email_verified FROM users WHERE id = $1",
            user_id
        )

        if row:
            return {
                "id": row["id"],
                "email": row["email"],
                "credits": row["credits"],
                "email_verified": row["email_verified"] or False
            }

        # Create new user with 5 free credits
        await conn.execute(
            """
            INSERT INTO users (id, email, credits, auth_provider, created_at)
            VALUES ($1, $2, 5, 'email', NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            user_id,
            email
        )

        return {
            "id": user_id,
            "email": email,
            "credits": 5,
            "email_verified": False
        }


async def create_user_with_password(email: str, password_hash: str) -> Dict[str, Any]:
    """
    Create a new user with email/password authentication.

    Args:
        email: User's email address
        password_hash: Bcrypt hashed password

    Returns:
        User dict with id, email, credits

    Raises:
        Exception if email already exists
    """
    import uuid
    user_id = str(uuid.uuid4())

    async with get_connection() as conn:
        # Check if email already exists
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1",
            email.lower()
        )
        if existing:
            raise ValueError("Email already registered")

        await conn.execute(
            """
            INSERT INTO users (id, email, password_hash, auth_provider, credits, created_at)
            VALUES ($1, $2, $3, 'email', 5, NOW())
            """,
            user_id,
            email.lower(),
            password_hash
        )

        return {
            "id": user_id,
            "email": email.lower(),
            "credits": 5,
            "email_verified": False
        }


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Get a user by email address.

    Args:
        email: User's email address

    Returns:
        User dict or None if not found
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, email, password_hash, credits, email_verified, auth_provider
            FROM users WHERE email = $1
            """,
            email.lower()
        )

        if row:
            return {
                "id": row["id"],
                "email": row["email"],
                "password_hash": row["password_hash"],
                "credits": row["credits"],
                "email_verified": row["email_verified"] or False,
                "auth_provider": row["auth_provider"] or "email"
            }
        return None


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a user by ID.

    Args:
        user_id: User ID

    Returns:
        User dict or None if not found
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, email, credits, email_verified, auth_provider
            FROM users WHERE id = $1
            """,
            user_id
        )

        if row:
            return {
                "id": row["id"],
                "email": row["email"],
                "credits": row["credits"],
                "email_verified": row["email_verified"] or False,
                "auth_provider": row["auth_provider"] or "email"
            }
        return None


async def update_user_password(user_id: str, password_hash: str) -> bool:
    """
    Update a user's password hash.

    Args:
        user_id: User ID
        password_hash: New bcrypt password hash

    Returns:
        True if updated, False if user not found
    """
    async with get_connection() as conn:
        result = await conn.execute(
            "UPDATE users SET password_hash = $1 WHERE id = $2",
            password_hash,
            user_id
        )
        return result == "UPDATE 1"


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
    return await deduct_credits(user_id, 1)


async def deduct_credits(user_id: str, amount: int) -> bool:
    """
    Deduct a specified number of credits from a user's balance.

    Args:
        user_id: Clerk user ID
        amount: Number of credits to deduct

    Returns:
        True if credits were deducted, False if insufficient credits
    """
    async with get_connection() as conn:
        result = await conn.execute(
            """
            UPDATE users
            SET credits = credits - $1
            WHERE id = $2 AND credits >= $1
            """,
            amount,
            user_id
        )
        # Returns "UPDATE X" where X is number of rows affected
        return result == "UPDATE 1"


async def deduct_credits_and_get_remaining(user_id: str, amount: int) -> tuple[bool, int]:
    """
    Deduct credits and return remaining balance.

    Args:
        user_id: User ID
        amount: Number of credits to deduct

    Returns:
        Tuple of (success, remaining_credits)
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            UPDATE users
            SET credits = credits - $1
            WHERE id = $2 AND credits >= $1
            RETURNING credits
            """,
            amount,
            user_id
        )
        if row:
            return True, row["credits"]
        # If update failed, get current credits
        current = await conn.fetchval(
            "SELECT credits FROM users WHERE id = $1",
            user_id
        )
        return False, current or 0


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


async def add_assistant_message_with_mode(
    conversation_id: str,
    stage1: List[Dict[str, Any]],
    stage2: List[Dict[str, Any]],
    stage3: Dict[str, Any],
    mode: str = "standard",
    is_rerun: bool = False,
    rerun_input: Optional[str] = None,
    parent_message_id: Optional[int] = None
) -> int:
    """
    Add an assistant message with mode and rerun information.

    Args:
        conversation_id: Conversation identifier
        stage1: List of individual model responses
        stage2: List of model rankings
        stage3: Final synthesized response
        mode: Run mode used ("quick", "standard", "extra_care")
        is_rerun: Whether this is a rerun of a previous decision
        rerun_input: New input provided for rerun (if any)
        parent_message_id: ID of the original message this is a rerun of

    Returns:
        The ID of the created message
    """
    async with get_connection() as conn:
        # Calculate revision number for reruns
        revision_number = 0
        if is_rerun and parent_message_id:
            row = await conn.fetchrow(
                """
                SELECT COALESCE(MAX(revision_number), 0) + 1 as next_revision
                FROM messages
                WHERE parent_message_id = $1 OR id = $1
                """,
                parent_message_id
            )
            revision_number = row["next_revision"] if row else 1

        row = await conn.fetchrow(
            """
            INSERT INTO messages (
                conversation_id, role, stage1, stage2, stage3,
                mode, is_rerun, rerun_input, revision_number, parent_message_id, created_at
            )
            VALUES ($1, 'assistant', $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            RETURNING id
            """,
            UUID(conversation_id),
            json.dumps(stage1),
            json.dumps(stage2),
            json.dumps(stage3),
            mode,
            is_rerun,
            rerun_input,
            revision_number,
            parent_message_id
        )
        return row["id"]


async def get_message_revisions(conversation_id: str, message_id: int) -> List[Dict[str, Any]]:
    """
    Get all revisions for a message (the original and all reruns).

    Args:
        conversation_id: Conversation identifier
        message_id: The original message ID

    Returns:
        List of revision dicts sorted by revision number
    """
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT id, stage1, stage2, stage3, mode, is_rerun, rerun_input,
                   revision_number, parent_message_id, created_at
            FROM messages
            WHERE (id = $1 OR parent_message_id = $1)
              AND conversation_id = $2
              AND role = 'assistant'
            ORDER BY revision_number ASC, created_at ASC
            """,
            message_id,
            UUID(conversation_id)
        )

        return [
            {
                "id": row["id"],
                "stage1": parse_json_field(row["stage1"]),
                "stage2": parse_json_field(row["stage2"]),
                "stage3": parse_json_field(row["stage3"]),
                "mode": row["mode"] or "standard",
                "is_rerun": row["is_rerun"] or False,
                "rerun_input": row["rerun_input"],
                "revision_number": row["revision_number"] or 0,
                "parent_message_id": row["parent_message_id"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None
            }
            for row in rows
        ]


async def get_latest_assistant_message(conversation_id: str) -> Optional[Dict[str, Any]]:
    """
    Get the most recent assistant message in a conversation.

    Args:
        conversation_id: Conversation identifier

    Returns:
        The latest assistant message or None
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, stage1, stage2, stage3, mode, is_rerun, revision_number, created_at
            FROM messages
            WHERE conversation_id = $1 AND role = 'assistant'
              AND stage3 IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
            """,
            UUID(conversation_id)
        )

        if row is None:
            return None

        return {
            "id": row["id"],
            "stage1": parse_json_field(row["stage1"]),
            "stage2": parse_json_field(row["stage2"]),
            "stage3": parse_json_field(row["stage3"]),
            "mode": row["mode"] or "standard",
            "is_rerun": row["is_rerun"] or False,
            "revision_number": row["revision_number"] or 0,
            "created_at": row["created_at"].isoformat() if row["created_at"] else None
        }


async def get_original_user_message(conversation_id: str) -> Optional[str]:
    """
    Get the first user message in a conversation (the original decision question).

    Args:
        conversation_id: Conversation identifier

    Returns:
        The original user message content or None
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT content
            FROM messages
            WHERE conversation_id = $1 AND role = 'user'
            ORDER BY created_at ASC
            LIMIT 1
            """,
            UUID(conversation_id)
        )

        return row["content"] if row else None


async def create_pending_assistant_message_with_mode(
    conversation_id: str,
    mode: str = "standard",
    is_rerun: bool = False,
    rerun_input: Optional[str] = None,
    parent_message_id: Optional[int] = None
) -> int:
    """
    Create a pending assistant message placeholder with mode info.

    Args:
        conversation_id: Conversation identifier
        mode: Run mode
        is_rerun: Whether this is a rerun
        rerun_input: New input for rerun
        parent_message_id: Original message ID for reruns

    Returns:
        The message ID for later updates
    """
    async with get_connection() as conn:
        # Calculate revision number for reruns
        revision_number = 0
        if is_rerun and parent_message_id:
            row = await conn.fetchrow(
                """
                SELECT COALESCE(MAX(revision_number), 0) + 1 as next_revision
                FROM messages
                WHERE parent_message_id = $1 OR id = $1
                """,
                parent_message_id
            )
            revision_number = row["next_revision"] if row else 1

        row = await conn.fetchrow(
            """
            INSERT INTO messages (
                conversation_id, role, mode, is_rerun, rerun_input,
                revision_number, parent_message_id, created_at
            )
            VALUES ($1, 'assistant', $2, $3, $4, $5, $6, NOW())
            RETURNING id
            """,
            UUID(conversation_id),
            mode,
            is_rerun,
            rerun_input,
            revision_number,
            parent_message_id
        )
        return row["id"]
