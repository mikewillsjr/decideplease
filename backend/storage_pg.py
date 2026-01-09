"""Postgres-based storage for conversations."""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import UUID

from .database import get_connection
from .config import RUN_MODES
from .logging_config import get_logger

logger = get_logger(__name__)


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


async def cleanup_incomplete_messages() -> int:
    """
    Delete any assistant messages that are incomplete (missing stage3).

    This is a safety cleanup that runs on startup to remove any partial messages
    that might exist from interrupted processing. With atomic saves, this should
    rarely find anything, but it's a safety net.

    Returns:
        Number of incomplete messages deleted
    """
    async with get_connection() as conn:
        # Find and delete incomplete assistant messages (have stage1 but no stage3)
        result = await conn.execute(
            """
            DELETE FROM messages
            WHERE role = 'assistant'
            AND stage3 IS NULL
            """
        )
        # Parse the result to get count (format: "DELETE N")
        count = int(result.split()[-1]) if result else 0
        if count > 0:
            logger.warning("cleanup_incomplete_messages", deleted_count=count)
        return count


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
                    "id": msg["id"],  # Include ID for tracking
                    "role": "user",
                    "content": msg["content"]
                })
            else:
                # Skip assistant messages with no stage data at all
                # (these are orphaned from interrupted processing)
                if msg["stage1"] is None and msg["stage2"] is None and msg["stage3"] is None:
                    continue

                message_list.append({
                    "id": msg["id"],  # Include ID for responding to specific decisions
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


async def list_conversations(
    user_id: str,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """
    List conversations for a user with pagination.

    Args:
        user_id: The Clerk user ID
        limit: Maximum number of conversations to return (default 50, max 100)
        offset: Number of conversations to skip (for pagination)

    Returns:
        Dict with 'conversations' list and 'total' count
    """
    # Enforce limits
    limit = min(max(1, limit), 100)
    offset = max(0, offset)

    async with get_connection() as conn:
        # Get total count
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM conversations WHERE user_id = $1",
            user_id
        )

        # Get paginated results - only count user messages (queries), not assistant responses
        rows = await conn.fetch(
            """
            SELECT c.id, c.title, c.created_at,
                   COUNT(m.id) FILTER (WHERE m.role = 'user') as message_count
            FROM conversations c
            LEFT JOIN messages m ON m.conversation_id = c.id
            WHERE c.user_id = $1
            GROUP BY c.id
            ORDER BY c.created_at DESC
            LIMIT $2 OFFSET $3
            """,
            user_id,
            limit,
            offset
        )

        conversations = [
            {
                "id": str(row["id"]),
                "created_at": row["created_at"].isoformat(),
                "title": row["title"] or "New Conversation",
                "message_count": row["message_count"]
            }
            for row in rows
        ]

        return {
            "conversations": conversations,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(conversations) < total
        }


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
        stage: 'stage1', 'stage1_5', 'stage2', or 'stage3'
        data: The stage data to save
    """
    # SECURITY: Use explicit mapping to prevent SQL injection
    # Column names cannot be parameterized, so we use a whitelist
    STAGE_COLUMNS = {
        'stage1': 'stage1',
        'stage1_5': 'stage1_5',
        'stage2': 'stage2',
        'stage3': 'stage3'
    }

    column = STAGE_COLUMNS.get(stage)
    if not column:
        raise ValueError(f"Invalid stage: {stage}")

    async with get_connection() as conn:
        # Use the validated column name from our whitelist
        if column == 'stage1':
            await conn.execute(
                "UPDATE messages SET stage1 = $1 WHERE id = $2",
                json.dumps(data),
                message_id
            )
        elif column == 'stage1_5':
            await conn.execute(
                "UPDATE messages SET stage1_5 = $1 WHERE id = $2",
                json.dumps(data),
                message_id
            )
        elif column == 'stage2':
            await conn.execute(
                "UPDATE messages SET stage2 = $1 WHERE id = $2",
                json.dumps(data),
                message_id
            )
        else:  # stage3
            await conn.execute(
                "UPDATE messages SET stage3 = $1 WHERE id = $2",
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


async def create_user_with_password(
    email: str,
    password_hash: str,
    initial_credits: int = 5
) -> Dict[str, Any]:
    """
    Create a new user with email/password authentication.

    Args:
        email: User's email address
        password_hash: Bcrypt hashed password
        initial_credits: Starting credits (default 5, use 0 for unverified accounts)

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
            VALUES ($1, $2, $3, 'email', $4, NOW())
            """,
            user_id,
            email.lower(),
            password_hash,
            initial_credits
        )

        return {
            "id": user_id,
            "email": email.lower(),
            "credits": initial_credits,
            "email_verified": False,
            "role": "user"  # New users always start as regular users
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
            SELECT id, email, password_hash, credits, email_verified, auth_provider, role
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
                "auth_provider": row["auth_provider"] or "email",
                "role": row["role"] or "user"
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
            SELECT id, email, credits, email_verified, auth_provider, role, password_hash, stripe_customer_id
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
                "auth_provider": row["auth_provider"] or "email",
                "role": row["role"] or "user",
                "password_hash": row["password_hash"],
                "stripe_customer_id": row["stripe_customer_id"]
            }
        return None


async def update_user_stripe_customer(user_id: str, stripe_customer_id: str) -> bool:
    """
    Update a user's Stripe customer ID.

    Args:
        user_id: User ID
        stripe_customer_id: Stripe customer ID (cus_xxxxx)

    Returns:
        True if updated, False if user not found
    """
    async with get_connection() as conn:
        result = await conn.execute(
            "UPDATE users SET stripe_customer_id = $1 WHERE id = $2",
            stripe_customer_id,
            user_id
        )
        return result == "UPDATE 1"


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


class InsufficientCreditsError(Exception):
    """Raised when a user doesn't have enough credits for an operation."""
    def __init__(self, required: int, available: int):
        self.required = required
        self.available = available
        super().__init__(f"Insufficient credits: need {required}, have {available}")


async def reserve_credits_atomic(user_id: str, amount: int) -> int:
    """
    Atomically reserve credits for a request.

    This should be called at the START of a request to prevent concurrent
    requests from overdrawing credits.

    Args:
        user_id: User ID
        amount: Number of credits to reserve

    Returns:
        Remaining credits after deduction

    Raises:
        InsufficientCreditsError: If user doesn't have enough credits
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
            return row["credits"]

        # Get current credits for error message
        current = await conn.fetchval(
            "SELECT credits FROM users WHERE id = $1",
            user_id
        )
        raise InsufficientCreditsError(required=amount, available=current or 0)


async def refund_credits(user_id: str, amount: int) -> int:
    """
    Refund credits to a user (e.g., if a request fails after credit deduction).

    Args:
        user_id: User ID
        amount: Number of credits to refund

    Returns:
        New credit balance
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            UPDATE users
            SET credits = credits + $1
            WHERE id = $2
            RETURNING credits
            """,
            amount,
            user_id
        )
        return row["credits"] if row else 0


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


async def get_payment_by_payment_intent(payment_intent_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a payment record by Stripe payment intent ID.

    Args:
        payment_intent_id: Stripe payment intent ID

    Returns:
        Payment dict or None if not found
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, user_id, stripe_session_id, stripe_payment_intent,
                   amount_cents, credits, status, created_at
            FROM payments
            WHERE stripe_payment_intent = $1
            """,
            payment_intent_id
        )
        if row:
            return {
                "id": str(row["id"]),
                "user_id": row["user_id"],
                "stripe_session_id": row["stripe_session_id"],
                "stripe_payment_intent": row["stripe_payment_intent"],
                "amount_cents": row["amount_cents"],
                "credits": row["credits"],
                "status": row["status"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None
            }
        return None


async def mark_payment_refunded(payment_intent_id: str, refund_amount_cents: int) -> bool:
    """
    Mark a payment as refunded and calculate credits to deduct.

    Args:
        payment_intent_id: Stripe payment intent ID
        refund_amount_cents: Amount refunded in cents

    Returns:
        True if payment was found and updated, False otherwise
    """
    async with get_connection() as conn:
        # Get the original payment
        payment = await conn.fetchrow(
            """
            SELECT user_id, amount_cents, credits, status
            FROM payments
            WHERE stripe_payment_intent = $1
            """,
            payment_intent_id
        )

        if not payment:
            return False

        # Calculate credits to deduct proportionally
        # If full refund, deduct all credits. If partial, deduct proportionally.
        original_amount = payment["amount_cents"]
        original_credits = payment["credits"]

        if original_amount > 0:
            credits_to_deduct = int((refund_amount_cents / original_amount) * original_credits)
        else:
            credits_to_deduct = original_credits

        # Update payment status
        new_status = "refunded" if refund_amount_cents >= original_amount else "partially_refunded"
        await conn.execute(
            """
            UPDATE payments
            SET status = $1
            WHERE stripe_payment_intent = $2
            """,
            new_status,
            payment_intent_id
        )

        # Deduct credits from user (but don't go below 0)
        await conn.execute(
            """
            UPDATE users
            SET credits = GREATEST(0, credits - $1)
            WHERE id = $2
            """,
            credits_to_deduct,
            payment["user_id"]
        )

        return True


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


async def add_assistant_message_complete(
    conversation_id: str,
    stage1: List[Dict[str, Any]],
    stage2: List[Dict[str, Any]],
    stage3: Dict[str, Any],
    stage1_5: Optional[List[Dict[str, Any]]] = None,
    mode: str = "standard",
    is_rerun: bool = False,
    rerun_input: Optional[str] = None,
    parent_message_id: Optional[int] = None
) -> int:
    """
    Add a complete assistant message with ALL stages in a single atomic transaction.

    This function is critical for data integrity - it ensures we never have partial
    messages in the database. If the server is interrupted mid-processing, nothing
    is saved and the user can simply re-ask their question.

    Args:
        conversation_id: Conversation identifier
        stage1: List of individual model responses
        stage2: List of model rankings (empty list for quick mode)
        stage3: Final synthesized response
        stage1_5: Cross-review refinements (optional, for extra_care mode)
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
                conversation_id, role, stage1, stage1_5, stage2, stage3,
                mode, is_rerun, rerun_input, revision_number, parent_message_id, created_at
            )
            VALUES ($1, 'assistant', $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            RETURNING id
            """,
            UUID(conversation_id),
            json.dumps(stage1),
            json.dumps(stage1_5) if stage1_5 else None,
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


async def get_orphaned_user_message(conversation_id: str) -> Optional[Dict[str, Any]]:
    """
    Check if there's a user message without a corresponding assistant response.

    This detects the case where processing failed silently - the user asked a question
    but no answer was saved. This can happen if:
    - Processing errored before saving
    - Server restarted mid-processing
    - Network issues prevented completion

    Args:
        conversation_id: Conversation identifier

    Returns:
        The orphaned user message if found, None otherwise
    """
    async with get_connection() as conn:
        # Get the last message in the conversation
        last_msg = await conn.fetchrow(
            """
            SELECT id, role, content, created_at
            FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            UUID(conversation_id)
        )

        if last_msg is None:
            return None

        # If the last message is from the user, it's orphaned (no response yet)
        if last_msg["role"] == "user":
            return {
                "id": last_msg["id"],
                "content": last_msg["content"],
                "created_at": last_msg["created_at"].isoformat() if last_msg["created_at"] else None
            }

        return None


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


# ============== Role Management ==============

async def update_user_role(user_id: str, new_role: str) -> bool:
    """
    Update a user's role.

    Args:
        user_id: User ID
        new_role: New role (user, employee, admin, superadmin)

    Returns:
        True if updated, False if user not found
    """
    valid_roles = ['user', 'employee', 'admin', 'superadmin']
    if new_role not in valid_roles:
        raise ValueError(f"Invalid role: {new_role}")

    async with get_connection() as conn:
        result = await conn.execute(
            "UPDATE users SET role = $1 WHERE id = $2",
            new_role,
            user_id
        )
        return result == "UPDATE 1"


async def get_user_role(user_id: str) -> Optional[str]:
    """Get a user's role."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT role FROM users WHERE id = $1",
            user_id
        )
        return row["role"] if row else None


async def get_staff_users() -> List[Dict[str, Any]]:
    """Get all users with staff roles (employee, admin, superadmin)."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT id, email, role, credits, created_at
            FROM users
            WHERE role IN ('employee', 'admin', 'superadmin')
            ORDER BY
                CASE role
                    WHEN 'superadmin' THEN 1
                    WHEN 'admin' THEN 2
                    WHEN 'employee' THEN 3
                END,
                created_at DESC
            """
        )
        return [
            {
                "id": row["id"],
                "email": row["email"],
                "role": row["role"],
                "credits": row["credits"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None
            }
            for row in rows
        ]


async def create_staff_user(email: str, password_hash: str, role: str) -> Dict[str, Any]:
    """
    Create a new staff user (employee or admin).

    Args:
        email: User's email address
        password_hash: Bcrypt hashed password
        role: Role to assign (employee or admin)

    Returns:
        User dict

    Raises:
        ValueError if email exists or invalid role
    """
    import uuid

    valid_roles = ['employee', 'admin']
    if role not in valid_roles:
        raise ValueError(f"Invalid staff role: {role}")

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
            INSERT INTO users (id, email, password_hash, auth_provider, role, credits, email_verified, created_at)
            VALUES ($1, $2, $3, 'email', $4, 9999999, TRUE, NOW())
            """,
            user_id,
            email.lower(),
            password_hash,
            role
        )

        return {
            "id": user_id,
            "email": email.lower(),
            "role": role,
            "credits": 9999999,
            "email_verified": True
        }


# ============== Audit Logging ==============

async def log_admin_action(
    admin_id: str,
    admin_email: str,
    action: str,
    target_user_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> str:
    """
    Log an admin action to the audit log.

    Args:
        admin_id: ID of the admin performing the action
        admin_email: Email of the admin
        action: Type of action (e.g., 'add_credits', 'delete_user', 'change_role')
        target_user_id: ID of the user affected (if any)
        details: Additional details as JSON

    Returns:
        Audit log entry ID
    """
    import json

    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO admin_audit_log (admin_id, admin_email, action, target_user_id, details, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id
            """,
            admin_id,
            admin_email,
            action,
            target_user_id,
            json.dumps(details) if details else None
        )
        return str(row["id"])


async def get_audit_log(limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
    """
    Get audit log entries.

    Args:
        limit: Maximum entries to return
        offset: Offset for pagination

    Returns:
        List of audit log entries
    """
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT id, admin_id, admin_email, action, target_user_id, details, created_at
            FROM admin_audit_log
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit,
            offset
        )
        return [
            {
                "id": str(row["id"]),
                "admin_id": row["admin_id"],
                "admin_email": row["admin_email"],
                "action": row["action"],
                "target_user_id": row["target_user_id"],
                "details": row["details"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None
            }
            for row in rows
        ]


# ============== Follow-up Context Functions ==============

async def save_context_summary(message_id: int, context_summary: Dict[str, Any]):
    """
    Save context summary for a message for use in follow-ups.

    Args:
        message_id: The assistant message ID
        context_summary: The context summary dict from build_context_summary()
    """
    async with get_connection() as conn:
        result = await conn.execute(
            """
            UPDATE messages
            SET context_summary = $1
            WHERE id = $2
            """,
            json.dumps(context_summary),
            message_id
        )
        logger.debug("save_context_summary",
            message_id=message_id,
            result=result,
            context_keys=list(context_summary.keys()) if context_summary else [])


async def get_conversation_context(conversation_id: str) -> Optional[Dict[str, Any]]:
    """
    Get the context summary from the most recent completed assistant message.

    Args:
        conversation_id: Conversation identifier

    Returns:
        Context summary dict or None if no previous context exists
    """
    async with get_connection() as conn:
        # First, check if there are any assistant messages with stage3 complete
        debug_row = await conn.fetchrow(
            """
            SELECT id, stage3 IS NOT NULL as has_stage3, context_summary IS NOT NULL as has_context
            FROM messages
            WHERE conversation_id = $1
              AND role = 'assistant'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            UUID(conversation_id)
        )
        logger.debug("get_conversation_context_debug",
            conversation_id=conversation_id,
            has_assistant_msg=debug_row is not None,
            has_stage3=debug_row["has_stage3"] if debug_row else None,
            has_context=debug_row["has_context"] if debug_row else None)

        row = await conn.fetchrow(
            """
            SELECT context_summary
            FROM messages
            WHERE conversation_id = $1
              AND role = 'assistant'
              AND stage3 IS NOT NULL
              AND context_summary IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
            """,
            UUID(conversation_id)
        )

        if row and row["context_summary"]:
            context = parse_json_field(row["context_summary"])
            logger.info("get_conversation_context_found",
                conversation_id=conversation_id,
                context_keys=list(context.keys()) if context else [])
            return context

        logger.warning("get_conversation_context_not_found",
            conversation_id=conversation_id)
        return None


async def get_last_stage3_response(conversation_id: str) -> Optional[str]:
    """
    Get the chairman's decision (stage3 response) from the most recent completed message.

    This is a simple approach for follow-ups: just include the full previous decision
    so the council can reconsider it with new information.

    Args:
        conversation_id: Conversation identifier

    Returns:
        The stage3 response text, or None if no completed decision exists
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT stage3
            FROM messages
            WHERE conversation_id = $1
              AND role = 'assistant'
              AND stage3 IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
            """,
            UUID(conversation_id)
        )

        if row and row["stage3"]:
            stage3_data = parse_json_field(row["stage3"])
            # stage3 is stored as {"model": "...", "response": "..."}
            if isinstance(stage3_data, dict):
                return stage3_data.get("response", "")
            return str(stage3_data)
        return None


async def get_stage3_by_message_id(message_id: int) -> Optional[str]:
    """
    Get the chairman's decision (stage3 response) from a specific message.

    This is used when the user wants to respond to a specific previous decision
    in the conversation rather than the most recent one.

    Args:
        message_id: The specific message ID to get the decision from

    Returns:
        The stage3 response text, or None if not found or not completed
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT stage3
            FROM messages
            WHERE id = $1
              AND role = 'assistant'
              AND stage3 IS NOT NULL
            """,
            message_id
        )

        if row and row["stage3"]:
            stage3_data = parse_json_field(row["stage3"])
            # stage3 is stored as {"model": "...", "response": "..."}
            if isinstance(stage3_data, dict):
                return stage3_data.get("response", "")
            return str(stage3_data)
        return None


async def get_conversation_message_count(conversation_id: str) -> int:
    """
    Get the count of user messages in a conversation.
    Used to determine if this is a follow-up message.

    Args:
        conversation_id: Conversation identifier

    Returns:
        Number of user messages in the conversation
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT COUNT(*) as count
            FROM messages
            WHERE conversation_id = $1 AND role = 'user'
            """,
            UUID(conversation_id)
        )
        return row["count"] if row else 0


async def get_message_by_id(conversation_id: str, message_id: int) -> Optional[Dict[str, Any]]:
    """
    Get a specific message by ID.

    Args:
        conversation_id: Conversation identifier (for ownership verification)
        message_id: The message ID to retrieve

    Returns:
        Message dict with role, content, etc. or None if not found
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, role, content, stage1, stage1_5, stage2, stage3, metadata, created_at
            FROM messages
            WHERE id = $1 AND conversation_id = $2
            """,
            message_id, UUID(conversation_id)
        )

        if not row:
            return None

        return {
            "id": row["id"],
            "role": row["role"],
            "content": row["content"],
            "stage1": parse_json_field(row["stage1"]) if row["stage1"] else None,
            "stage1_5": parse_json_field(row["stage1_5"]) if row["stage1_5"] else None,
            "stage2": parse_json_field(row["stage2"]) if row["stage2"] else None,
            "stage3": parse_json_field(row["stage3"]) if row["stage3"] else None,
            "metadata": parse_json_field(row["metadata"]) if row["metadata"] else {},
            "created_at": row["created_at"].isoformat() if row["created_at"] else None
        }


async def delete_user_message(conversation_id: str, message_id: int) -> bool:
    """
    Delete a user message from a conversation.

    Only allows deletion of user messages (not assistant messages) to prevent
    orphaning responses. This is primarily used for cleaning up failed requests.

    Args:
        conversation_id: Conversation identifier
        message_id: The message ID to delete

    Returns:
        True if deleted, raises ValueError if not a user message

    Raises:
        ValueError: If message is not a user message or not found
    """
    async with get_connection() as conn:
        # First verify it's a user message
        row = await conn.fetchrow(
            """
            SELECT id, role FROM messages
            WHERE id = $1 AND conversation_id = $2
            """,
            message_id, UUID(conversation_id)
        )

        if not row:
            raise ValueError("Message not found")

        if row["role"] != "user":
            raise ValueError("Can only delete user messages")

        # Delete the message
        await conn.execute(
            """
            DELETE FROM messages
            WHERE id = $1 AND conversation_id = $2 AND role = 'user'
            """,
            message_id, UUID(conversation_id)
        )

        return True


# ============== Magic Link Token Functions ==============

async def create_magic_link_token(
    email: str,
    token_type: str,
    user_id: Optional[str] = None,
    expires_minutes: int = 20
) -> str:
    """
    Create a magic link token for passwordless authentication.

    Args:
        email: User's email address
        token_type: Type of token ('signup', 'login', or 'verify')
        user_id: Optional user ID (for existing users)
        expires_minutes: Token expiration time in minutes

    Returns:
        The generated token string
    """
    import secrets
    from datetime import datetime, timedelta

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=expires_minutes)

    async with get_connection() as conn:
        await conn.execute(
            """
            INSERT INTO magic_link_tokens (token, email, user_id, token_type, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            """,
            token, email.lower().strip(), user_id, token_type, expires_at
        )

    return token


async def verify_magic_link_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and consume a magic link token.

    Args:
        token: The token string to verify

    Returns:
        Token data dict if valid, None if expired/used/not found
    """
    from datetime import datetime

    async with get_connection() as conn:
        # Find the token
        row = await conn.fetchrow(
            """
            SELECT id, email, user_id, token_type, expires_at, used_at
            FROM magic_link_tokens
            WHERE token = $1
            """,
            token
        )

        if not row:
            return None

        # Check if already used
        if row["used_at"] is not None:
            return None

        # Check if expired
        if row["expires_at"] < datetime.utcnow():
            return None

        # Mark as used
        await conn.execute(
            """
            UPDATE magic_link_tokens
            SET used_at = NOW()
            WHERE id = $1
            """,
            row["id"]
        )

        return {
            "email": row["email"],
            "user_id": row["user_id"],
            "token_type": row["token_type"]
        }


async def create_passwordless_user(email: str) -> Dict[str, Any]:
    """
    Create a user without password (magic link user).
    Email is verified since they clicked the magic link.

    Args:
        email: User's email address

    Returns:
        User dict with id, email, credits, etc.
    """
    import uuid

    user_id = str(uuid.uuid4())
    email = email.lower().strip()

    async with get_connection() as conn:
        await conn.execute(
            """
            INSERT INTO users (id, email, password_hash, auth_provider, email_verified, credits, role)
            VALUES ($1, $2, NULL, 'magic_link', TRUE, 5, 'user')
            """,
            user_id, email
        )

    return {
        "id": user_id,
        "email": email,
        "credits": 5,
        "email_verified": True,
        "role": "user"
    }


async def mark_email_verified(user_id: str, grant_credits: bool = True) -> bool:
    """
    Mark a user's email as verified and optionally grant starter credits.

    Args:
        user_id: User ID
        grant_credits: Whether to grant 5 starter credits

    Returns:
        True if successful
    """
    async with get_connection() as conn:
        if grant_credits:
            await conn.execute(
                """
                UPDATE users
                SET email_verified = TRUE, credits = credits + 5
                WHERE id = $1 AND email_verified = FALSE
                """,
                user_id
            )
        else:
            await conn.execute(
                """
                UPDATE users
                SET email_verified = TRUE
                WHERE id = $1
                """,
                user_id
            )
    return True


async def cleanup_expired_magic_links() -> int:
    """
    Delete expired and used magic link tokens.
    Should be called periodically for housekeeping.

    Returns:
        Number of tokens deleted
    """
    async with get_connection() as conn:
        result = await conn.execute(
            """
            DELETE FROM magic_link_tokens
            WHERE expires_at < NOW() OR used_at IS NOT NULL
            """
        )
        # Extract count from "DELETE X" result
        count = int(result.split()[-1]) if result else 0
        return count


async def get_pending_magic_link(email: str) -> Optional[Dict[str, Any]]:
    """
    Check if there's a valid pending magic link for this email.
    Used for rate limiting and preventing spam.

    Args:
        email: Email address to check

    Returns:
        Token data if a valid pending link exists, None otherwise
    """
    from datetime import datetime

    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, token_type, expires_at, created_at
            FROM magic_link_tokens
            WHERE email = $1
              AND used_at IS NULL
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
            """,
            email.lower().strip()
        )

        if row:
            return {
                "token_type": row["token_type"],
                "expires_at": row["expires_at"],
                "created_at": row["created_at"]
            }
        return None
