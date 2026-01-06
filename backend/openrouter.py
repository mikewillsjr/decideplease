"""OpenRouter API client for making LLM requests."""

import asyncio
import httpx
from typing import List, Dict, Any, Optional
from .config import OPENROUTER_API_KEY, OPENROUTER_API_URL

# Retry configuration
MAX_RETRIES = 1  # One retry attempt (total 2 attempts)
RETRY_DELAY = 1.0  # Initial delay in seconds
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


async def query_model(
    model: str,
    messages: List[Dict[str, Any]],
    timeout: float = 120.0
) -> Optional[Dict[str, Any]]:
    """
    Query a single model via OpenRouter API with retry logic.

    Args:
        model: OpenRouter model identifier (e.g., "openai/gpt-4o")
        messages: List of message dicts with 'role' and 'content'.
                  Content can be a string or a list of content parts for multimodal:
                  [{"type": "text", "text": "..."}, {"type": "image_url", "image_url": {"url": "data:..."}}]
        timeout: Request timeout in seconds

    Returns:
        Response dict with 'content' and optional 'reasoning_details', or None if failed
    """
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": messages,
    }

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    OPENROUTER_API_URL,
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()

                data = response.json()
                message = data['choices'][0]['message']

                return {
                    'content': message.get('content'),
                    'reasoning_details': message.get('reasoning_details')
                }

        except httpx.HTTPStatusError as e:
            # Retry on specific status codes (rate limit, server errors)
            if e.response.status_code in RETRYABLE_STATUS_CODES and attempt < MAX_RETRIES:
                delay = RETRY_DELAY * (2 ** attempt)  # Exponential backoff
                print(f"[OpenRouter] Retry {attempt + 1}/{MAX_RETRIES} for {model} after {delay}s (HTTP {e.response.status_code})")
                await asyncio.sleep(delay)
                continue
            print(f"[OpenRouter] HTTP error for {model}: {e.response.status_code}")
            return None

        except (httpx.ConnectError, httpx.TimeoutException) as e:
            # Retry on network/timeout errors
            if attempt < MAX_RETRIES:
                delay = RETRY_DELAY * (2 ** attempt)
                print(f"[OpenRouter] Retry {attempt + 1}/{MAX_RETRIES} for {model} after {delay}s ({type(e).__name__})")
                await asyncio.sleep(delay)
                continue
            print(f"[OpenRouter] Network error for {model}: {type(e).__name__}: {e}")
            return None

        except Exception as e:
            # Don't retry on unexpected errors (JSON parse, key errors, etc.)
            print(f"[OpenRouter] Error querying {model}: {type(e).__name__}: {e}")
            return None

    return None


async def query_models_parallel(
    models: List[str],
    messages: List[Dict[str, Any]]
) -> Dict[str, Optional[Dict[str, Any]]]:
    """
    Query multiple models in parallel.

    Args:
        models: List of OpenRouter model identifiers
        messages: List of message dicts to send to each model

    Returns:
        Dict mapping model identifier to response dict (or None if failed)
    """
    import asyncio

    # Create tasks for all models
    tasks = [query_model(model, messages) for model in models]

    # Wait for all to complete
    responses = await asyncio.gather(*tasks)

    # Map models to their responses
    return {model: response for model, response in zip(models, responses)}
