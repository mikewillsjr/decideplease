"""Configuration for the DecidePlease."""

import os
from dotenv import load_dotenv

load_dotenv()

# OpenRouter API key
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Run modes with different speed/cost/quality tradeoffs
RUN_MODES = {
    "quick": {
        "credit_cost": 1,
        "enable_peer_review": False,
        "label": "Quick Answer",
        "council_models": [
            "openai/gpt-5.2-chat",
            "anthropic/claude-sonnet-4.5",
            "google/gemini-3-flash-preview",
            "x-ai/grok-4-fast",
            "deepseek/deepseek-v3.2",
        ],
        "chairman_model": "google/gemini-3-flash-preview",
    },
    "standard": {
        "credit_cost": 2,
        "enable_peer_review": True,
        "label": "Standard Answer",
        "council_models": [
            "openai/gpt-5.2-chat",
            "anthropic/claude-sonnet-4.5",
            "google/gemini-3-flash-preview",
            "x-ai/grok-4-fast",
            "deepseek/deepseek-v3.2",
        ],
        "chairman_model": "google/gemini-3-flash-preview",
    },
    "extra_care": {
        "credit_cost": 3,
        "enable_peer_review": True,
        "label": "Extra Care",
        "council_models": [
            "openai/gpt-5.2",
            "anthropic/claude-opus-4.5",
            "google/gemini-3-pro-preview",
            "x-ai/grok-4.1-fast",
            "deepseek/deepseek-v3.2",
        ],
        "chairman_model": "google/gemini-3-pro-preview",
    },
}

# Backwards compatibility - default to standard mode
COUNCIL_MODELS = RUN_MODES["standard"]["council_models"]
CHAIRMAN_MODEL = RUN_MODES["standard"]["chairman_model"]

# OpenRouter API endpoint
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Data directory for conversation storage
DATA_DIR = "data/conversations"
