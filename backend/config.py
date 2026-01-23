"""Configuration for the DecidePlease."""

import os
from dotenv import load_dotenv

load_dotenv()

# OpenRouter API key
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Model tiers for different quality/cost tradeoffs
HAIKU_TIER = [
    "openai/gpt-4o-mini",
    "anthropic/claude-3-haiku",
    "google/gemini-2.0-flash-exp",
    "x-ai/grok-2-mini",
    "deepseek/deepseek-chat",
]

PREMIUM_TIER = [
    "openai/gpt-5.2",
    "anthropic/claude-opus-4.5",
    "google/gemini-3-pro-preview",
    "x-ai/grok-4.1-fast",
    "deepseek/deepseek-v3.2",
]

# Run modes with different speed/cost/quality tradeoffs
# Terminology: "Decision Makers" (the AI council), "Moderator" (the synthesizer)
RUN_MODES = {
    "quick_decision": {
        "enable_peer_review": False,
        "enable_cross_review": False,
        "label": "Quick Decision",
        "decision_makers": HAIKU_TIER,
        "moderator_model": "anthropic/claude-sonnet-4.5",
        "context_mode": "minimal",
        "credit_cost": 1,  # Legacy: kept for backward compatibility during migration
    },
    "decide_please": {
        "enable_peer_review": True,
        "enable_cross_review": False,
        "label": "Decide Please",
        "decision_makers": PREMIUM_TIER,
        "moderator_model": "anthropic/claude-sonnet-4.5",
        "context_mode": "standard",
        "credit_cost": 2,  # Legacy: kept for backward compatibility during migration
    },
    "decide_pretty_please": {
        "enable_peer_review": True,
        "enable_cross_review": True,
        "label": "Decide Pretty Please",
        "decision_makers": PREMIUM_TIER,
        "moderator_model": "anthropic/claude-sonnet-4.5",
        "context_mode": "full",
        "credit_cost": 4,  # Legacy: kept for backward compatibility during migration
    },
}

# Legacy mode name mapping (for backward compatibility)
LEGACY_MODE_MAPPING = {
    "quick": "quick_decision",
    "standard": "decide_please",
    "extra_care": "decide_pretty_please",
}

# Subscription plan quotas (monthly run counts)
PLAN_QUOTAS = {
    "starter": {
        "price": 49,
        "quick_decision": 150,        # per month
        "decide_please": 8,           # per month
        "decide_pretty_please": 1,    # per month
        "max_file_size_mb": 10,
        "briefing_packs": 5,
        "decision_library_days": 90,
        "white_label": False,
    },
    "professional": {
        "price": 129,
        "quick_decision": 400,        # per month
        "decide_please": 25,          # per month
        "decide_pretty_please": 5,    # per month
        "max_file_size_mb": 50,
        "briefing_packs": 20,
        "decision_library_days": 365,
        "white_label": True,
    },
    "team": {
        "price": 299,
        "seats": 3,
        "quick_decision": 1000,       # shared pool per month
        "decide_please": 75,          # shared pool per month
        "decide_pretty_please": 20,   # shared pool per month
        "max_file_size_mb": 100,
        "briefing_packs": -1,         # unlimited
        "decision_library_days": -1,  # unlimited
        "white_label": True,
        "client_portal": True,
        "additional_seat_price": 60,
    },
}

# Overage pricing (per run, in dollars) - for subscribers who exceed quota
OVERAGE_PRICING = {
    "starter": {
        "quick_decision": None,       # hard cap, no overages
        "decide_please": 4.00,
        "decide_pretty_please": 10.00,
    },
    "professional": {
        "quick_decision": None,       # hard cap, no overages
        "decide_please": 3.00,
        "decide_pretty_please": 8.00,
    },
    "team": {
        "quick_decision": None,       # hard cap, no overages
        "decide_please": 2.50,
        "decide_pretty_please": 6.00,
    },
}

# Pay-per-use pricing (in cents) - for non-subscribers
PAYPERUSE_PRICING = {
    "quick_decision": 99,             # $0.99
    "decide_please": 599,             # $5.99
    "decide_pretty_please": 1299,     # $12.99
}

# Rate limits (anti-abuse)
RATE_LIMITS = {
    "quick_per_hour": 50,             # max Quick Decisions per hour
    "quick_per_day": 200,             # soft limit, triggers review
}

# Backwards compatibility - default to decide_please mode
DECISION_MAKERS = RUN_MODES["decide_please"]["decision_makers"]
MODERATOR_MODEL = RUN_MODES["decide_please"]["moderator_model"]

# Legacy aliases (deprecated, use new names)
COUNCIL_MODELS = DECISION_MAKERS
CHAIRMAN_MODEL = MODERATOR_MODEL

# OpenRouter API endpoint
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Data directory for conversation storage
DATA_DIR = "data/conversations"

# ============== Vision Model Configuration ==============
# Models that support vision/image input
VISION_MODELS = [
    # Premium tier
    "openai/gpt-5.2",
    "anthropic/claude-opus-4.5",
    "google/gemini-3-pro-preview",
    "x-ai/grok-4.1-fast",
    # Haiku tier
    "openai/gpt-4o-mini",
    "anthropic/claude-3-haiku",
    "google/gemini-2.0-flash-exp",
    "x-ai/grok-2-mini",
]

# Models that are text-only (need image descriptions)
TEXT_ONLY_MODELS = [
    "deepseek/deepseek-v3.2",
    "deepseek/deepseek-chat",
]

# Model used to generate image descriptions for text-only models
DESCRIPTION_MODEL = "google/gemini-2.0-flash-exp"

# ============== File Upload Configuration ==============
# Note: File size limits are now per-plan (see PLAN_QUOTAS)
FILE_UPLOAD_CREDIT_COST = 1  # Legacy: kept for backward compatibility during migration
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB default (Starter tier)
MAX_FILES = 5  # Maximum files per message

# ============== Auth Configuration ==============
AUTH_CONFIG = {
    "jwt_secret": os.getenv("JWT_SECRET", "dev-secret-change-in-production"),
    "jwt_algorithm": "HS256",
    "access_token_expire_minutes": 60 * 24,  # 24 hours
    "refresh_token_expire_days": 30,
    "oauth_enabled": os.getenv("OAUTH_ENABLED", "false").lower() == "true",
}
