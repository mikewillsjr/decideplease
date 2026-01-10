"""OpenRouter API client for making LLM requests."""

import asyncio
import json
import httpx
from typing import List, Dict, Any, Optional, AsyncGenerator
from .config import OPENROUTER_API_KEY, OPENROUTER_API_URL

# Retry configuration
MAX_RETRIES = 1  # One retry attempt (total 2 attempts)
RETRY_DELAY = 1.0  # Initial delay in seconds
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

# Module-level HTTP client for connection pooling
# This reuses TCP connections across requests, reducing latency
_http_client: Optional[httpx.AsyncClient] = None


async def get_http_client() -> httpx.AsyncClient:
    """Get or create the shared HTTP client with connection pooling."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
        )
    return _http_client


async def close_http_client():
    """Close the HTTP client. Call on application shutdown."""
    global _http_client
    if _http_client is not None and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None


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

    client = await get_http_client()

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.post(
                OPENROUTER_API_URL,
                headers=headers,
                json=payload,
                timeout=timeout
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


async def query_model_streaming(
    model: str,
    messages: List[Dict[str, Any]],
    timeout: float = 120.0
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Query a single model via OpenRouter API with streaming.

    Yields events as tokens arrive from the model:
    - {'type': 'token', 'content': '...'} for each token chunk
    - {'type': 'complete', 'content': '...'} when finished (full accumulated content)
    - {'type': 'error', 'message': '...'} on failure

    Args:
        model: OpenRouter model identifier (e.g., "openai/gpt-4o")
        messages: List of message dicts with 'role' and 'content'
        timeout: Request timeout in seconds

    Yields:
        Event dicts with 'type' and associated data
    """
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": messages,
        "stream": True,  # Enable streaming
    }

    client = await get_http_client()
    accumulated_content = ""

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with client.stream(
                "POST",
                OPENROUTER_API_URL,
                headers=headers,
                json=payload,
                timeout=timeout
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    # Skip empty lines
                    if not line.strip():
                        continue

                    # SSE format: lines starting with "data: "
                    if line.startswith("data: "):
                        data_str = line[6:]  # Remove "data: " prefix

                        # Check for stream end marker
                        if data_str.strip() == "[DONE]":
                            break

                        try:
                            data = json.loads(data_str)
                            # Extract token from delta
                            choices = data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    accumulated_content += content
                                    yield {"type": "token", "content": content}
                        except json.JSONDecodeError:
                            # Skip malformed JSON lines
                            continue

                # Stream complete - yield final accumulated content
                yield {"type": "complete", "content": accumulated_content}
                return  # Success - exit the retry loop

        except httpx.HTTPStatusError as e:
            if e.response.status_code in RETRYABLE_STATUS_CODES and attempt < MAX_RETRIES:
                delay = RETRY_DELAY * (2 ** attempt)
                print(f"[OpenRouter Streaming] Retry {attempt + 1}/{MAX_RETRIES} for {model} after {delay}s (HTTP {e.response.status_code})")
                await asyncio.sleep(delay)
                accumulated_content = ""  # Reset for retry
                continue
            print(f"[OpenRouter Streaming] HTTP error for {model}: {e.response.status_code}")
            yield {"type": "error", "message": f"HTTP error: {e.response.status_code}"}
            return

        except (httpx.ConnectError, httpx.TimeoutException) as e:
            if attempt < MAX_RETRIES:
                delay = RETRY_DELAY * (2 ** attempt)
                print(f"[OpenRouter Streaming] Retry {attempt + 1}/{MAX_RETRIES} for {model} after {delay}s ({type(e).__name__})")
                await asyncio.sleep(delay)
                accumulated_content = ""  # Reset for retry
                continue
            print(f"[OpenRouter Streaming] Network error for {model}: {type(e).__name__}: {e}")
            yield {"type": "error", "message": f"Network error: {type(e).__name__}"}
            return

        except Exception as e:
            print(f"[OpenRouter Streaming] Error querying {model}: {type(e).__name__}: {e}")
            yield {"type": "error", "message": str(e)}
            return
