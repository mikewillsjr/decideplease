"""3-stage DecidePlease orchestration."""

import asyncio
from typing import List, Dict, Any, Tuple, Optional, AsyncGenerator
from .openrouter import query_models_parallel, query_model, query_model_streaming
from .config import (
    DECISION_MAKERS, MODERATOR_MODEL, RUN_MODES, VISION_MODELS, TEXT_ONLY_MODELS,
    LEGACY_MODE_MAPPING,
    # Legacy aliases for backward compatibility
    COUNCIL_MODELS, CHAIRMAN_MODEL
)
from .file_processing import generate_image_descriptions_for_text_models


async def stage1_collect_responses(
    user_query: str,
    decision_makers: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Stage 1: Collect individual responses from all Decision Makers.

    Args:
        user_query: The user's question
        decision_makers: Optional list of models to use (defaults to DECISION_MAKERS)

    Returns:
        List of dicts with 'model' and 'response' keys
    """
    models = decision_makers or DECISION_MAKERS
    messages = [{"role": "user", "content": user_query}]

    # Query all models in parallel
    responses = await query_models_parallel(models, messages)

    # Format results
    stage1_results = []
    for model, response in responses.items():
        if response is not None:  # Only include successful responses
            stage1_results.append({
                "model": model,
                "response": response.get('content', '')
            })

    return stage1_results


def build_multimodal_message(
    user_query: str,
    processed_files: List[Dict[str, Any]],
    model: str,
    image_descriptions: Dict[str, str]
) -> Dict[str, Any]:
    """
    Build a message appropriate for the target model.

    Args:
        user_query: The user's question
        processed_files: List of processed file dicts from file_processing.py
        model: The target model identifier
        image_descriptions: Pre-generated descriptions for images (for text-only models)

    Returns:
        Message dict with 'role' and 'content'
    """
    is_vision_model = model in VISION_MODELS

    # Build content parts
    content_parts = []

    # Add user query as text
    content_parts.append({"type": "text", "text": user_query})

    # Add file content
    for file in processed_files:
        if file['file_type'] == 'image':
            if is_vision_model:
                # Vision model: include actual image
                content_parts.append({
                    "type": "image_url",
                    "image_url": {"url": file['data_uri']}
                })
            else:
                # Text-only model: include description
                description = image_descriptions.get(
                    file['filename'],
                    f"[Image: {file['filename']} - description unavailable]"
                )
                content_parts.append({
                    "type": "text",
                    "text": f"\n\n[ATTACHED IMAGE: {file['filename']}]\n{description}"
                })
        else:
            # Document: include extracted text for all models
            text = file.get('extracted_text', '[Document content unavailable]')
            content_parts.append({
                "type": "text",
                "text": f"\n\n[ATTACHED {file['file_type'].upper()}: {file['filename']}]\n{text}"
            })

    return {"role": "user", "content": content_parts}


async def stage1_collect_responses_with_files(
    user_query: str,
    processed_files: List[Dict[str, Any]],
    decision_makers: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Stage 1 with file support: Collect individual responses from all Decision Makers.

    For vision models, includes actual images. For text-only models (DeepSeek),
    uses Gemini Flash to generate text descriptions of images.

    Args:
        user_query: The user's question
        processed_files: List of processed file dicts from file_processing.py
        decision_makers: Optional list of models to use (defaults to DECISION_MAKERS)

    Returns:
        List of dicts with 'model' and 'response' keys
    """
    models = decision_makers or DECISION_MAKERS

    # Check if we have any images that need descriptions for text-only models
    has_images = any(f['file_type'] == 'image' for f in processed_files)
    has_text_only_models = any(m in TEXT_ONLY_MODELS for m in models)

    # Generate image descriptions for text-only models if needed
    image_descriptions = {}
    if has_images and has_text_only_models:
        image_descriptions = await generate_image_descriptions_for_text_models(processed_files)

    # Build messages for each model and query in parallel
    async def query_with_files(model: str) -> Optional[Dict[str, Any]]:
        message = build_multimodal_message(user_query, processed_files, model, image_descriptions)
        response = await query_model(model, [message])
        if response is not None:
            return {
                "model": model,
                "response": response.get('content', '')
            }
        return None

    # Query all models in parallel
    tasks = [query_with_files(model) for model in models]
    results = await asyncio.gather(*tasks)

    # Filter out None results
    stage1_results = [r for r in results if r is not None]

    return stage1_results


async def stage1_5_cross_review(
    user_query: str,
    stage1_results: List[Dict[str, Any]],
    decision_makers: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Stage 1.5: Cross-Review step for Decide Pretty Please mode.

    Each model sees their own response labeled clearly, and other responses
    anonymized as "Response A", "Response B", etc. to prevent bias.
    Responses are shuffled before labeling for additional anonymization.

    Args:
        user_query: The original user query
        stage1_results: Results from Stage 1
        decision_makers: Optional list of models to use

    Returns:
        List of refined responses (same format as Stage 1)
    """
    import asyncio
    import random

    models = decision_makers or DECISION_MAKERS

    # Create model -> stage1 response lookup
    model_to_response = {r['model']: r['response'] for r in stage1_results}

    async def get_refined_response(model: str):
        """Build personalized prompt for this model and query."""
        own_response = model_to_response.get(model, "")

        # Get other responses and shuffle them for anonymization
        other_results = [r for r in stage1_results if r['model'] != model]
        random.shuffle(other_results)

        # Build anonymized list of other responses
        other_responses = []
        for i, result in enumerate(other_results):
            label = chr(65 + i)  # A, B, C...
            other_responses.append(f"Response {label}:\n{result['response']}")

        other_responses_text = "\n\n".join(other_responses)

        prompt = f"""You are participating in a cross-review step of a Decision Makers deliberation.

ORIGINAL QUESTION:
{user_query}

YOUR ORIGINAL RESPONSE:
{own_response}

OTHER DECISION MAKER RESPONSES (anonymized):
{other_responses_text}

---

YOUR TASK:
The response labeled "YOUR ORIGINAL RESPONSE" above is yours from Stage 1.
The other responses (A, B, C, etc.) are from anonymous fellow Decision Makers.

Provide your REFINED answer considering all perspectives. You may:
- Incorporate valuable insights from other responses you hadn't considered
- Strengthen your argument if you believe your initial position was correct
- Change or nuance your position if another response convinced you
- Address points of disagreement directly
- Correct any errors you notice

Important: This is your FINAL answer before the peer ranking phase. Make it comprehensive and well-reasoned.

Your refined response:"""

        messages = [{"role": "user", "content": prompt}]
        return model, await query_model(model, messages)

    # Query all models in parallel with personalized prompts
    tasks = [get_refined_response(model) for model in models]
    results = await asyncio.gather(*tasks)

    # Format results
    stage1_5_results = []
    for model, response in results:
        if response is not None:
            stage1_5_results.append({
                "model": model,
                "response": response.get('content', ''),
                "refined": True  # Flag indicating this is a refined response
            })

    return stage1_5_results


async def stage2_collect_rankings(
    user_query: str,
    stage1_results: List[Dict[str, Any]],
    decision_makers: Optional[List[str]] = None
) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    """
    Stage 2: Each Decision Maker ranks the anonymized responses.

    Args:
        user_query: The original user query
        stage1_results: Results from Stage 1
        decision_makers: Optional list of models to use (defaults to DECISION_MAKERS)

    Returns:
        Tuple of (rankings list, label_to_model mapping)
    """
    models = decision_makers or DECISION_MAKERS
    # Create anonymized labels for responses (Response A, Response B, etc.)
    labels = [chr(65 + i) for i in range(len(stage1_results))]  # A, B, C, ...

    # Create mapping from label to model name
    label_to_model = {
        f"Response {label}": result['model']
        for label, result in zip(labels, stage1_results)
    }

    # Build the ranking prompt
    responses_text = "\n\n".join([
        f"Response {label}:\n{result['response']}"
        for label, result in zip(labels, stage1_results)
    ])

    ranking_prompt = f"""You are evaluating different responses to the following question:

Question: {user_query}

Here are the responses from different models (anonymized):

{responses_text}

Your task:
1. First, evaluate each response individually. For each response, explain what it does well and what it does poorly.
2. Then, at the very end of your response, provide a final ranking.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line should be: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text or explanations in the ranking section

Example of the correct format for your ENTIRE response:

Response A provides good detail on X but misses Y...
Response B is accurate but lacks depth on Z...
Response C offers the most comprehensive answer...

FINAL RANKING:
1. Response C
2. Response A
3. Response B

Now provide your evaluation and ranking:"""

    messages = [{"role": "user", "content": ranking_prompt}]

    # Get rankings from all Decision Makers in parallel
    responses = await query_models_parallel(models, messages)

    # Format results
    stage2_results = []
    for model, response in responses.items():
        if response is not None:
            full_text = response.get('content', '')
            parsed = parse_ranking_from_text(full_text)
            stage2_results.append({
                "model": model,
                "ranking": full_text,
                "parsed_ranking": parsed
            })

    return stage2_results, label_to_model


async def stage3_synthesize_final(
    user_query: str,
    stage1_results: List[Dict[str, Any]],
    stage2_results: List[Dict[str, Any]],
    moderator_model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Stage 3: Moderator synthesizes final response.

    Args:
        user_query: The original user query
        stage1_results: Individual model responses from Stage 1
        stage2_results: Rankings from Stage 2
        moderator_model: Optional model to use as moderator (defaults to MODERATOR_MODEL)

    Returns:
        Dict with 'model' and 'response' keys
    """
    moderator = moderator_model or MODERATOR_MODEL

    # Log input sizes for debugging
    print(f"[STAGE3] Moderator model: {moderator}")
    print(f"[STAGE3] Query length: {len(user_query)} chars")
    print(f"[STAGE3] Stage 1 responses: {len(stage1_results)}")
    print(f"[STAGE3] Stage 2 rankings: {len(stage2_results)}")
    # Build comprehensive context for moderator
    stage1_text = "\n\n".join([
        f"Decision Maker: {result['model']}\nResponse: {result['response']}"
        for result in stage1_results
    ])

    # Build prompt based on whether peer review was conducted
    if stage2_results:
        stage2_text = "\n\n".join([
            f"Decision Maker: {result['model']}\nRanking: {result['ranking']}"
            for result in stage2_results
        ])

        moderator_prompt = f"""You are the Moderator of a Decision Makers panel. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: {user_query}

STAGE 1 - Individual Responses:
{stage1_text}

STAGE 2 - Peer Rankings:
{stage2_text}

Your task as Moderator is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question.

IMPORTANT: Do NOT reference "Response A", "Response B", etc. in your synthesis. The anonymous labels are internal to the peer review process. Instead, directly synthesize the best insights into a unified answer.

Consider:
- The individual responses and their insights
- The peer rankings and what they reveal about response quality
- Any patterns of agreement or disagreement

Provide a clear, well-reasoned final answer that represents the Decision Makers' collective wisdom:"""
    else:
        # Quick mode - no peer review
        moderator_prompt = f"""You are the Moderator of a Decision Makers panel. Multiple AI models have provided responses to a user's question.

Original Question: {user_query}

Individual Responses:
{stage1_text}

Your task as Moderator is to synthesize all of these responses into a single, comprehensive, accurate answer to the user's original question.

IMPORTANT: Do NOT reference individual models or responses by name. Directly synthesize the best insights into a unified answer.

Consider:
- The key insights from each response
- Areas of agreement and disagreement
- The strongest arguments and evidence presented

Provide a clear, well-reasoned final answer that represents the Decision Makers' collective wisdom:"""

    messages = [{"role": "user", "content": moderator_prompt}]

    # Query the moderator model
    response = await query_model(moderator, messages)

    if response is None:
        # Fallback if moderator fails
        print(f"[STAGE3] ERROR: Moderator model returned None")
        return {
            "model": moderator,
            "response": "Error: Unable to generate final synthesis."
        }

    content = response.get('content', '')
    print(f"[STAGE3] Response length: {len(content)} chars")
    print(f"[STAGE3] Query length: {len(user_query)} chars")
    print(f"[STAGE3] Response preview: {content[:150]}...")

    # Validate that the response is a synthesis, not an echo of the question
    # IMPORTANT: Echo detection must be strict to avoid false positives on long, complex prompts
    # Only trigger if response literally starts with the query text
    echo_detected = False
    synthesis_found = False

    if len(user_query) > 100:
        query_start = user_query[:150].strip()
        response_start = content[:300].strip()

        # Method 1: Direct prefix match - response literally starts with query text
        # This is the ONLY reliable echo detection method
        if response_start.startswith(query_start[:80]):
            echo_detected = True
            print(f"[STAGE3] Echo detected: Response starts with query text")

        # Method 2: Check if response contains synthesis indicators (anti-echo check)
        # If these are present, it's likely NOT an echo even if some query text appears
        synthesis_indicators = [
            "based on", "analysis", "recommend", "council", "synthesis",
            "conclusion", "verdict", "assessment", "evaluation", "##", "**",
            "1.", "2.", "first", "second", "however", "therefore", "critique"
        ]
        has_synthesis_markers = any(ind in content[:500].lower() for ind in synthesis_indicators)

        # If we detected a potential echo but synthesis markers are present,
        # give benefit of doubt - some models summarize the question before answering
        if echo_detected and has_synthesis_markers:
            # Check if substantial content follows the query text
            if len(content) > len(query_start) + 500:
                print(f"[STAGE3] Echo-like start detected but synthesis markers present - allowing")
                echo_detected = False

        if echo_detected:
            print(f"[STAGE3] WARNING: Response appears to echo the question!")
            print(f"[STAGE3] Query start: {query_start[:100]}...")
            print(f"[STAGE3] Response start: {response_start[:100]}...")

            # Try to extract any synthesis that might come after the echo
            # Some models repeat context before answering
            synthesis_markers = [
                "Based on the council's analysis",
                "The council recommends",
                "After reviewing",
                "In conclusion",
                "The consensus is",
                "My synthesis",
                "Final recommendation",
                "Synthesis:",
                "My recommendation",
                "The verdict",
            ]
            for marker in synthesis_markers:
                if marker.lower() in content.lower():
                    marker_pos = content.lower().find(marker.lower())
                    if marker_pos > len(query_start):
                        print(f"[STAGE3] Found synthesis after echo at position {marker_pos}")
                        # Keep the synthesis part
                        content = content[marker_pos:]
                        synthesis_found = True
                        break

    # If echo detected but no synthesis found, retry with a clearer prompt
    if echo_detected and not synthesis_found:
        print(f"[STAGE3] Echo detected without synthesis - retrying with explicit prompt")

        # Build a summary of Decision Maker responses for the retry
        # Include more context than before to handle complex questions
        decision_maker_summary = "\n".join([
            f"- {r['model'].split('/')[-1]}: {r['response'][:800]}{'...' if len(r['response']) > 800 else ''}"
            for r in stage1_results[:4]  # Include top 4 responses with more detail
        ])

        # For long queries, include more context (up to 1500 chars)
        query_context_len = min(1500, len(user_query))
        query_context = user_query[:query_context_len]
        if len(user_query) > query_context_len:
            query_context += "..."

        retry_prompt = f"""CRITICAL: Do NOT repeat the question. Provide ONLY your synthesis/recommendation.

QUESTION CONTEXT (reference only - DO NOT INCLUDE IN YOUR RESPONSE):
{query_context}

DECISION MAKER RESPONSES:
{decision_maker_summary}

INSTRUCTIONS:
- Start DIRECTLY with your synthesis or recommendation
- Do NOT echo, quote, or summarize the question
- Synthesize the Decision Maker responses into actionable guidance
- Use structured formatting (headers, bullets) for clarity

YOUR SYNTHESIS:"""

        retry_response = await query_model(moderator, [{"role": "user", "content": retry_prompt}])

        if retry_response and retry_response.get('content'):
            retry_content = retry_response['content'].strip()
            # Verify retry didn't also echo
            if not (len(user_query) > 100 and user_query[:100] in retry_content[:200]):
                print(f"[STAGE3] Retry successful - got clean response of {len(retry_content)} chars")
                content = retry_content
            else:
                print(f"[STAGE3] Retry also echoed - falling back to error message")
                content = """**Unable to generate synthesis** - The moderator model encountered an issue processing this query.

**Workaround:** Please try:
1. Shortening your question
2. Splitting into multiple smaller questions
3. Using "Quick Answer" mode

The individual Decision Maker responses above may still be helpful."""
        else:
            print(f"[STAGE3] Retry failed - model returned None")
            content = """**Unable to generate synthesis** - The moderator model failed to respond.

Please try again or review the individual Decision Maker responses above."""

    return {
        "model": moderator,
        "response": content
    }


async def stage3_synthesize_final_streaming(
    user_query: str,
    stage1_results: List[Dict[str, Any]],
    stage2_results: List[Dict[str, Any]],
    moderator_model: Optional[str] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Stage 3: Moderator synthesizes final response with streaming.

    Yields events as the response is generated:
    - {'type': 'token', 'content': '...'} for each token chunk
    - {'type': 'complete', 'content': '...', 'model': '...'} when finished
    - {'type': 'retry', 'reason': '...'} if echo detected and retrying
    - {'type': 'error', 'message': '...'} on failure

    Args:
        user_query: The original user query
        stage1_results: Individual model responses from Stage 1
        stage2_results: Rankings from Stage 2
        moderator_model: Optional model to use as moderator

    Yields:
        Event dicts with streaming progress
    """
    moderator = moderator_model or MODERATOR_MODEL

    # Build comprehensive context for moderator (same as non-streaming version)
    stage1_text = "\n\n".join([
        f"Decision Maker: {result['model']}\nResponse: {result['response']}"
        for result in stage1_results
    ])

    # Build prompt based on whether peer review was conducted
    if stage2_results:
        stage2_text = "\n\n".join([
            f"Decision Maker: {result['model']}\nRanking: {result['ranking']}"
            for result in stage2_results
        ])

        moderator_prompt = f"""You are the Moderator of a Decision Makers panel. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: {user_query}

STAGE 1 - Individual Responses:
{stage1_text}

STAGE 2 - Peer Rankings:
{stage2_text}

Your task as Moderator is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question.

IMPORTANT: Do NOT reference "Response A", "Response B", etc. in your synthesis. The anonymous labels are internal to the peer review process. Instead, directly synthesize the best insights into a unified answer.

Consider:
- The individual responses and their insights
- The peer rankings and what they reveal about response quality
- Any patterns of agreement or disagreement

Provide a clear, well-reasoned final answer that represents the Decision Makers' collective wisdom:"""
    else:
        # Quick mode - no peer review
        moderator_prompt = f"""You are the Moderator of a Decision Makers panel. Multiple AI models have provided responses to a user's question.

Original Question: {user_query}

Individual Responses:
{stage1_text}

Your task as Moderator is to synthesize all of these responses into a single, comprehensive, accurate answer to the user's original question.

IMPORTANT: Do NOT reference individual models or responses by name. Directly synthesize the best insights into a unified answer.

Consider:
- The key insights from each response
- Areas of agreement and disagreement
- The strongest arguments and evidence presented

Provide a clear, well-reasoned final answer that represents the Decision Makers' collective wisdom:"""

    messages = [{"role": "user", "content": moderator_prompt}]

    # Buffer initial tokens for echo detection before streaming to client
    ECHO_BUFFER_SIZE = 300
    buffer = ""
    buffer_complete = False
    echo_detected = False

    async for event in query_model_streaming(moderator, messages):
        if event['type'] == 'token':
            if not buffer_complete:
                # Still buffering for echo detection
                buffer += event['content']
                if len(buffer) >= ECHO_BUFFER_SIZE:
                    buffer_complete = True
                    # Check for echo
                    if len(user_query) > 100:
                        query_start = user_query[:150].strip()
                        if buffer.strip().startswith(query_start[:80]):
                            echo_detected = True
                            print(f"[STAGE3 STREAMING] Echo detected in buffer")

                    if echo_detected:
                        # Don't stream the echo, will retry
                        break
                    else:
                        # No echo - stream the buffer and continue
                        yield {'type': 'token', 'content': buffer}
            else:
                # Buffer complete, stream tokens directly
                yield event

        elif event['type'] == 'complete':
            if not buffer_complete:
                # Stream completed before buffer was full - check for echo anyway
                if len(user_query) > 100:
                    query_start = user_query[:150].strip()
                    if buffer.strip().startswith(query_start[:80]):
                        echo_detected = True
                        print(f"[STAGE3 STREAMING] Echo detected in short response")

                if not echo_detected:
                    # No echo - yield buffered content and complete
                    if buffer:
                        yield {'type': 'token', 'content': buffer}
                    yield {'type': 'complete', 'content': event['content'], 'model': moderator}
                    return
            else:
                if not echo_detected:
                    yield {'type': 'complete', 'content': event['content'], 'model': moderator}
                    return

        elif event['type'] == 'error':
            yield event
            return

    # If we got here with echo detected, retry with explicit prompt
    if echo_detected:
        print(f"[STAGE3 STREAMING] Retrying with explicit prompt")
        yield {'type': 'retry', 'reason': 'echo_detected'}

        # Build retry prompt (same as non-streaming version)
        decision_maker_summary = "\n".join([
            f"- {r['model'].split('/')[-1]}: {r['response'][:800]}{'...' if len(r['response']) > 800 else ''}"
            for r in stage1_results[:4]
        ])

        query_context_len = min(1500, len(user_query))
        query_context = user_query[:query_context_len]
        if len(user_query) > query_context_len:
            query_context += "..."

        retry_prompt = f"""CRITICAL: Do NOT repeat the question. Provide ONLY your synthesis/recommendation.

QUESTION CONTEXT (reference only - DO NOT INCLUDE IN YOUR RESPONSE):
{query_context}

DECISION MAKER RESPONSES:
{decision_maker_summary}

INSTRUCTIONS:
- Start DIRECTLY with your synthesis or recommendation
- Do NOT echo, quote, or summarize the question
- Synthesize the Decision Maker responses into actionable guidance
- Use structured formatting (headers, bullets) for clarity

YOUR SYNTHESIS:"""

        retry_messages = [{"role": "user", "content": retry_prompt}]

        # Stream the retry response
        async for event in query_model_streaming(moderator, retry_messages):
            if event['type'] == 'token':
                yield event
            elif event['type'] == 'complete':
                yield {'type': 'complete', 'content': event['content'], 'model': moderator}
                return
            elif event['type'] == 'error':
                yield event
                return

        # If retry also failed, yield error
        yield {
            'type': 'error',
            'message': 'Unable to generate synthesis after retry'
        }


def parse_ranking_from_text(ranking_text: str) -> List[str]:
    """
    Parse the FINAL RANKING section from the model's response.

    Args:
        ranking_text: The full text response from the model

    Returns:
        List of response labels in ranked order
    """
    import re

    # Look for "FINAL RANKING:" section
    if "FINAL RANKING:" in ranking_text:
        # Extract everything after "FINAL RANKING:"
        parts = ranking_text.split("FINAL RANKING:")
        if len(parts) >= 2:
            ranking_section = parts[1]
            # Try to extract numbered list format (e.g., "1. Response A")
            # This pattern looks for: number, period, optional space, "Response X"
            numbered_matches = re.findall(r'\d+\.\s*Response [A-Z]', ranking_section)
            if numbered_matches:
                # Extract just the "Response X" part
                return [re.search(r'Response [A-Z]', m).group() for m in numbered_matches]

            # Fallback: Extract all "Response X" patterns in order
            matches = re.findall(r'Response [A-Z]', ranking_section)
            return matches

    # Fallback: try to find any "Response X" patterns in order
    matches = re.findall(r'Response [A-Z]', ranking_text)
    return matches


def calculate_aggregate_rankings(
    stage2_results: List[Dict[str, Any]],
    label_to_model: Dict[str, str]
) -> List[Dict[str, Any]]:
    """
    Calculate aggregate rankings across all models.

    Args:
        stage2_results: Rankings from each model
        label_to_model: Mapping from anonymous labels to model names

    Returns:
        List of dicts with model name and average rank, sorted best to worst
    """
    from collections import defaultdict

    # Track positions for each model
    model_positions = defaultdict(list)

    for ranking in stage2_results:
        ranking_text = ranking['ranking']

        # Parse the ranking from the structured format
        parsed_ranking = parse_ranking_from_text(ranking_text)

        for position, label in enumerate(parsed_ranking, start=1):
            if label in label_to_model:
                model_name = label_to_model[label]
                model_positions[model_name].append(position)

    # Calculate average position for each model
    aggregate = []
    for model, positions in model_positions.items():
        if positions:
            avg_rank = sum(positions) / len(positions)
            aggregate.append({
                "model": model,
                "average_rank": round(avg_rank, 2),
                "rankings_count": len(positions)
            })

    # Sort by average rank (lower is better)
    aggregate.sort(key=lambda x: x['average_rank'])

    return aggregate


async def generate_conversation_title(user_query: str) -> str:
    """
    Generate a short title for a conversation based on the first user message.

    Args:
        user_query: The first user message

    Returns:
        A short title (3-5 words)
    """
    title_prompt = f"""Generate a very short title (3-5 words maximum) that summarizes the following question.
The title should be concise and descriptive. Do not use quotes or punctuation in the title.

Question: {user_query}

Title:"""

    messages = [{"role": "user", "content": title_prompt}]

    # Use gemini-2.5-flash for title generation (fast and cheap)
    response = await query_model("google/gemini-2.5-flash", messages, timeout=30.0)

    if response is None:
        # Fallback to a generic title
        return "New Conversation"

    title = response.get('content', 'New Conversation').strip()

    # Clean up the title - remove quotes, limit length
    title = title.strip('"\'')

    # Truncate if too long
    if len(title) > 50:
        title = title[:47] + "..."

    return title


async def run_full_council(user_query: str) -> Tuple[List, List, List, Dict, Dict]:
    """
    Run the complete 3-stage council process (backwards compatible, uses standard mode).

    Args:
        user_query: The user's question

    Returns:
        Tuple of (stage1_results, stage1_5_results, stage2_results, stage3_result, metadata)
    """
    return await run_council_with_mode(user_query, mode="standard")


async def run_council_with_mode(
    user_query: str,
    mode: str = "decide_please",
    context_packet: Optional[Dict[str, Any]] = None,
    is_rerun: bool = False,
    new_input: Optional[str] = None,
    processed_files: Optional[List[Dict[str, Any]]] = None
) -> Tuple[List, List, List, Dict, Dict]:
    """
    Run the Decision Makers process with a specific mode.

    Args:
        user_query: The user's question
        mode: Run mode - "quick_decision", "decide_please", or "decide_pretty_please"
              (legacy names "quick", "standard", "extra_care" also supported)
        context_packet: Optional context from previous run (for reruns)
        is_rerun: Whether this is a rerun of a previous decision
        new_input: Optional new input for refinement reruns
        processed_files: Optional list of processed file dicts for multimodal queries

    Returns:
        Tuple of (stage1_results, stage1_5_results, stage2_results, stage3_result, metadata)
    """
    # Handle legacy mode names
    if mode in LEGACY_MODE_MAPPING:
        mode = LEGACY_MODE_MAPPING[mode]

    # Get mode configuration (fallback to decide_please if invalid)
    if mode not in RUN_MODES:
        mode = "decide_please"
    mode_config = RUN_MODES[mode]

    decision_makers = mode_config["decision_makers"]
    moderator_model = mode_config["moderator_model"]
    enable_peer_review = mode_config["enable_peer_review"]
    enable_cross_review = mode_config.get("enable_cross_review", False)

    # Build the effective query
    if is_rerun and context_packet:
        effective_query = build_rerun_query(user_query, context_packet, new_input)
    else:
        effective_query = user_query

    # Stage 1: Collect individual responses (with or without files)
    if processed_files:
        stage1_results = await stage1_collect_responses_with_files(
            effective_query, processed_files, decision_makers
        )
    else:
        stage1_results = await stage1_collect_responses(effective_query, decision_makers)

    # If no models responded successfully, return error
    if not stage1_results:
        return [], [], [], {
            "model": "error",
            "response": "All Decision Makers failed to respond. Please try again."
        }, {"mode": mode}

    # Stage 1.5: Cross-Review (Decide Pretty Please mode only)
    stage1_5_results = []
    if enable_cross_review and stage1_results:
        stage1_5_results = await stage1_5_cross_review(
            effective_query, stage1_results, decision_makers
        )
        # Use refined responses for subsequent stages if cross-review succeeded
        responses_for_ranking = stage1_5_results if stage1_5_results else stage1_results
    else:
        responses_for_ranking = stage1_results

    # Stage 2: Collect rankings (skip if peer review disabled)
    label_to_model = {}
    aggregate_rankings = []
    stage2_results = []

    if enable_peer_review:
        stage2_results, label_to_model = await stage2_collect_rankings(
            effective_query, responses_for_ranking, decision_makers
        )
        aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)

    # Stage 3: Synthesize final answer (use refined responses if available)
    stage3_result = await stage3_synthesize_final(
        effective_query,
        responses_for_ranking,
        stage2_results,
        moderator_model
    )

    # Prepare metadata
    metadata = {
        "label_to_model": label_to_model,
        "aggregate_rankings": aggregate_rankings,
        "mode": mode,
        "mode_label": mode_config["label"],
        "enable_peer_review": enable_peer_review,
        "enable_cross_review": enable_cross_review,
        "has_stage1_5": bool(stage1_5_results),
        "is_rerun": is_rerun
    }

    return stage1_results, stage1_5_results, stage2_results, stage3_result, metadata


def build_rerun_query(
    original_question: str,
    context_packet: Dict[str, Any],
    new_input: Optional[str] = None
) -> str:
    """
    Build the query for a rerun, incorporating context from the previous run.

    Args:
        original_question: The original decision question
        context_packet: Previous run's TL;DR context
        new_input: Optional new information or follow-up

    Returns:
        The constructed query string for the rerun
    """
    # Build context summary from previous run
    context_parts = [f"Original Decision Question: {original_question}"]

    if context_packet.get("recommendation"):
        context_parts.append(f"Previous Recommendation: {context_packet['recommendation']}")
    if context_packet.get("confidence"):
        context_parts.append(f"Previous Confidence: {context_packet['confidence']}")
    if context_packet.get("key_risks"):
        context_parts.append(f"Key Risks Identified: {context_packet['key_risks']}")
    if context_packet.get("tradeoffs"):
        context_parts.append(f"Tradeoffs: {context_packet['tradeoffs']}")
    if context_packet.get("flip_condition"):
        context_parts.append(f"Flip Condition: {context_packet['flip_condition']}")

    context_summary = "\n".join(context_parts)

    if new_input and new_input.strip():
        # Refinement/follow-up case
        return f"""{context_summary}

NEW INFORMATION/FOLLOW-UP:
{new_input}

INSTRUCTION: Update the verdict based on the new input above. Clearly state what changed since the last verdict and provide an updated recommendation."""
    else:
        # Second opinion case
        return f"""{context_summary}

INSTRUCTION: Provide an independent recommendation for this decision. Do NOT assume the previous verdict is correct. If you agree with the previous recommendation, explain why. If you disagree, explain what you would change and why."""


def extract_tldr_packet(stage3_response: str) -> Dict[str, Any]:
    """
    Extract TL;DR fields from a Stage 3 response for use in reruns.

    This is a best-effort extraction - the response may not have all fields.

    Args:
        stage3_response: The moderator's response text

    Returns:
        Dict with available TL;DR fields
    """
    packet = {
        "recommendation": None,
        "confidence": None,
        "key_risks": None,
        "tradeoffs": None,
        "flip_condition": None,
        "action_plan": None,
    }

    # Simple extraction - look for common section headers
    # This is heuristic and may need refinement based on actual response patterns
    lines = stage3_response.split('\n')

    for i, line in enumerate(lines):
        line_lower = line.lower().strip()

        if 'recommendation' in line_lower or 'verdict' in line_lower:
            # Take next few lines as recommendation
            packet["recommendation"] = _extract_section(lines, i)
        elif 'confidence' in line_lower:
            packet["confidence"] = _extract_section(lines, i)
        elif 'risk' in line_lower:
            packet["key_risks"] = _extract_section(lines, i)
        elif 'tradeoff' in line_lower or 'trade-off' in line_lower:
            packet["tradeoffs"] = _extract_section(lines, i)
        elif 'flip' in line_lower or 'reconsider' in line_lower:
            packet["flip_condition"] = _extract_section(lines, i)
        elif 'action' in line_lower or 'next step' in line_lower:
            packet["action_plan"] = _extract_section(lines, i)

    # If we couldn't extract structured data, use a summary of the response
    if not any(packet.values()):
        # Take first 500 chars as a summary
        packet["recommendation"] = stage3_response[:500] + "..." if len(stage3_response) > 500 else stage3_response

    return packet


def _extract_section(lines: List[str], header_idx: int, max_lines: int = 5) -> str:
    """Extract content following a section header."""
    content_lines = []
    for i in range(header_idx, min(header_idx + max_lines, len(lines))):
        line = lines[i].strip()
        if line:
            content_lines.append(line)
        elif content_lines:  # Stop at empty line after content
            break
    return ' '.join(content_lines) if content_lines else None


def build_context_summary(
    original_question: str,
    stage1_results: List[Dict[str, Any]],
    stage2_results: List[Dict[str, Any]],
    stage3_result: Dict[str, Any],
    aggregate_rankings: List[Dict[str, Any]],
    stage1_5_results: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Build a context summary packet for follow-up messages.

    This extracts key information from a completed council run to provide
    context for subsequent messages in the same conversation.

    Args:
        original_question: The user's original question
        stage1_results: Individual model responses from Stage 1
        stage2_results: Rankings from Stage 2 (may be empty for Quick mode)
        stage3_result: Chairman's final synthesis
        aggregate_rankings: Calculated aggregate rankings
        stage1_5_results: Optional refined responses from Stage 1.5

    Returns:
        Dict with context summary for different verbosity levels
    """
    # Extract verdict summary from stage3
    verdict_text = stage3_result.get("response", "")
    verdict_summary = _extract_verdict_summary(verdict_text)

    # Extract dissenting points (models that disagreed with top-ranked)
    dissenting_points = _extract_dissenting_points(
        stage1_results, stage2_results, aggregate_rankings
    )

    return {
        "original_question": original_question,
        "verdict_summary": verdict_summary,
        "key_dissenting_points": dissenting_points,
        "full_stages": {
            "stage1": stage1_results,
            "stage1_5": stage1_5_results,
            "stage2": stage2_results,
            "stage3": stage3_result,
        },
        "aggregate_rankings": aggregate_rankings,
    }


def _extract_verdict_summary(stage3_response: str, max_chars: int = 800) -> str:
    """
    Extract a concise verdict summary from the moderator's response.

    Tries to find structured sections first, falls back to truncation.
    """
    # Try to find verdict/recommendation sections
    lines = stage3_response.split('\n')
    verdict_lines = []
    in_verdict_section = False

    for line in lines:
        line_lower = line.lower().strip()

        # Start capturing after verdict-like headers
        if any(kw in line_lower for kw in ['verdict', 'recommendation', 'conclusion', 'final answer', 'summary']):
            in_verdict_section = True
            verdict_lines.append(line)
        elif in_verdict_section:
            # Stop at next major section header
            if line.startswith('#') or (line.strip() and line.strip()[0].isdigit() and '.' in line[:3]):
                if len(verdict_lines) > 2:  # Have enough content
                    break
            verdict_lines.append(line)

    if verdict_lines and len(' '.join(verdict_lines)) > 50:
        summary = ' '.join(verdict_lines).strip()
        if len(summary) > max_chars:
            summary = summary[:max_chars] + "..."
        return summary

    # Fallback: take first portion of response
    if len(stage3_response) > max_chars:
        return stage3_response[:max_chars] + "..."
    return stage3_response


def _extract_dissenting_points(
    stage1_results: List[Dict[str, Any]],
    stage2_results: List[Dict[str, Any]],
    aggregate_rankings: List[Dict[str, Any]]
) -> List[str]:
    """
    Extract key points of disagreement between models.

    Identifies models that ranked lower and extracts their unique perspectives.
    """
    dissenting = []

    if not aggregate_rankings or len(aggregate_rankings) < 2:
        return dissenting

    # Get bottom-ranked models (potential dissenters)
    bottom_models = [r['model'] for r in aggregate_rankings[-2:]]

    for result in stage1_results:
        if result['model'] in bottom_models:
            # Extract first 200 chars as their key point
            response = result.get('response', '')
            if response:
                # Try to get the first substantive paragraph
                paragraphs = [p.strip() for p in response.split('\n\n') if p.strip()]
                if paragraphs:
                    point = paragraphs[0][:200]
                    if len(paragraphs[0]) > 200:
                        point += "..."
                    model_name = result['model'].split('/')[-1]
                    dissenting.append(f"{model_name}: {point}")

    return dissenting[:3]  # Limit to top 3 dissenting points


def build_followup_query(
    new_question: str,
    context_summary: Dict[str, Any],
    context_mode: str
) -> str:
    """
    Build query with appropriate context level for follow-up messages.

    Args:
        new_question: The user's follow-up question
        context_summary: Context from previous council run
        context_mode: "minimal", "standard", or "full"

    Returns:
        The constructed query string with context
    """
    original = context_summary.get('original_question', '')
    verdict = context_summary.get('verdict_summary', '')

    if context_mode == "minimal":
        # Quick mode: Original question + verdict summary only
        return f"""CONTEXT FROM PREVIOUS COUNCIL DECISION:

Previous Question: {original}

Council's Verdict: {verdict}

---

FOLLOW-UP QUESTION:
{new_question}

Please answer the follow-up question, taking into account the previous council decision."""

    elif context_mode == "standard":
        # Standard mode: Add key dissenting points
        dissent = context_summary.get('key_dissenting_points', [])
        dissent_text = "\n".join(f"- {p}" for p in dissent) if dissent else "None noted"

        return f"""CONTEXT FROM PREVIOUS COUNCIL DECISION:

Previous Question: {original}

Council's Verdict: {verdict}

Key Dissenting Views:
{dissent_text}

---

FOLLOW-UP QUESTION:
{new_question}

Please answer the follow-up question, considering both the council's verdict and the dissenting perspectives."""

    else:  # "full" - Extra Care mode
        # Full context: include stage summaries
        full_stages = context_summary.get('full_stages', {})
        stage1 = full_stages.get('stage1', [])
        rankings = context_summary.get('aggregate_rankings', [])

        # Build model summaries
        model_summaries = []
        for result in stage1[:5]:  # Limit to first 5
            model = result.get('model', '').split('/')[-1]
            response = result.get('response', '')[:300]
            if len(result.get('response', '')) > 300:
                response += "..."
            model_summaries.append(f"{model}: {response}")

        summaries_text = "\n\n".join(model_summaries)

        # Build rankings text
        rankings_text = ""
        if rankings:
            rankings_text = "Model Rankings (best to worst): " + ", ".join(
                f"{r['model'].split('/')[-1]} (avg rank: {r['average_rank']})"
                for r in rankings
            )

        dissent = context_summary.get('key_dissenting_points', [])
        dissent_text = "\n".join(f"- {p}" for p in dissent) if dissent else "None noted"

        return f"""FULL CONTEXT FROM PREVIOUS COUNCIL DECISION:

Previous Question: {original}

INDIVIDUAL MODEL PERSPECTIVES (Summaries):
{summaries_text}

{rankings_text}

COUNCIL'S FINAL VERDICT:
{verdict}

KEY DISSENTING VIEWS:
{dissent_text}

---

FOLLOW-UP QUESTION:
{new_question}

Please provide a comprehensive answer to the follow-up question, building upon the council's previous analysis. Consider all perspectives and rankings when formulating your response."""
