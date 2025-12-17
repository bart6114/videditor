"""AI-powered video analysis using OpenRouter."""

import asyncio
import json
from typing import Any

import structlog
from openai import APIError, APITimeoutError, RateLimitError

from utils.analytics import get_openrouter_client, is_posthog_enabled

logger = structlog.get_logger()

# Valid platforms for social content generation
VALID_PLATFORMS = {"youtube", "instagram", "tiktok", "linkedin"}


def build_response_format(platforms: list[str]) -> dict[str, Any]:
    """
    Build OpenRouter response_format with dynamic JSON schema.

    OpenRouter strict mode requires:
    - No $defs/$ref references (must be inlined)
    - additionalProperties: false on ALL objects
    - required array listing all properties
    """
    properties: dict[str, Any] = {}
    required: list[str] = []

    for platform in platforms:
        if platform == "youtube":
            properties["youtube"] = {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["title", "description"],
                "additionalProperties": False,
            }
            required.append("youtube")
        elif platform == "instagram":
            properties["instagram"] = {
                "type": "object",
                "properties": {
                    "caption": {"type": "string"},
                },
                "required": ["caption"],
                "additionalProperties": False,
            }
            required.append("instagram")
        elif platform == "tiktok":
            properties["tiktok"] = {
                "type": "object",
                "properties": {
                    "caption": {"type": "string"},
                },
                "required": ["caption"],
                "additionalProperties": False,
            }
            required.append("tiktok")
        elif platform == "linkedin":
            properties["linkedin"] = {
                "type": "object",
                "properties": {
                    "caption": {"type": "string"},
                },
                "required": ["caption"],
                "additionalProperties": False,
            }
            required.append("linkedin")

    if not properties:
        raise ValueError("No valid platforms provided")

    return {
        "type": "json_schema",
        "json_schema": {
            "name": "social_content",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": properties,
                "required": required,
                "additionalProperties": False,
            },
        },
    }


class ShortSuggestion:
    """Represents a suggested short clip from AI analysis."""

    def __init__(
        self,
        segment_id: str,
        start_time: float,
        end_time: float,
        transcription: str,
    ):
        self.segment_id = segment_id
        self.start_time = start_time
        self.end_time = end_time
        self.transcription = transcription

    @property
    def duration(self) -> float:
        """Duration of the clip in seconds."""
        return self.end_time - self.start_time


def parse_timestamp(timestamp: str) -> float:
    """
    Convert timestamp from "HH:MM:SS,mmm" format to seconds.

    Args:
        timestamp: Time string in format "HH:MM:SS,mmm" or "HH:MM:SS.mmm"

    Returns:
        Time in seconds as float

    Example:
        >>> parse_timestamp("00:01:23,456")
        83.456
    """
    # Handle both comma and period as millisecond separator
    timestamp = timestamp.replace(",", ".")

    # Split into time and milliseconds
    if "." in timestamp:
        time_part, ms_part = timestamp.split(".")
    else:
        time_part = timestamp
        ms_part = "0"

    # Parse HH:MM:SS
    parts = time_part.split(":")
    if len(parts) == 3:
        hours, minutes, seconds = parts
        total_seconds = int(hours) * 3600 + int(minutes) * 60 + int(seconds)
    elif len(parts) == 2:
        minutes, seconds = parts
        total_seconds = int(minutes) * 60 + int(seconds)
    else:
        raise ValueError(f"Invalid timestamp format: {timestamp}")

    # Add milliseconds
    total_seconds += float(f"0.{ms_part}")

    return total_seconds


def _format_time(seconds: float) -> str:
    """Convert seconds to HH:MM:SS format (integer seconds only)."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def _format_time_precise(seconds: float) -> str:
    """Convert seconds to HH:MM:SS,mmm format with millisecond precision."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def format_transcript_for_ai(words: list[dict[str, Any]]) -> str:
    """
    Format word-level transcript data into segments for AI analysis.

    Uses speaker-first segmentation strategy:
    1. Speaker changes - Always break when speaker changes
    2. Time gaps > 0.8s - Natural pauses indicate thought boundaries
    3. Max duration ~20s - Force break at next small pause if segment too long

    Args:
        words: List of word objects with start, end, text, speaker

    Returns:
        Formatted transcript string with precise timestamps and speakers
    """
    if not words:
        return ""

    segments: list[list[dict[str, Any]]] = []
    current_segment: list[dict[str, Any]] = []

    for i, word in enumerate(words):
        current_segment.append(word)
        should_break = False

        if i + 1 < len(words):
            next_word = words[i + 1]
            curr_speaker = word.get("speaker")
            next_speaker = next_word.get("speaker")
            gap = next_word["start"] - word["end"]

            # Priority 1: Speaker change (always break)
            if curr_speaker is not None and next_speaker is not None and curr_speaker != next_speaker:
                should_break = True

            # Priority 2: Significant pause (>0.8s)
            elif gap > 0.8:
                should_break = True

            # Priority 3: Segment too long (>20s), break at any pause >0.3s
            elif current_segment:
                duration = word["end"] - current_segment[0]["start"]
                if duration > 20 and gap > 0.3:
                    should_break = True

        if should_break and current_segment:
            segments.append(current_segment)
            current_segment = []

    # Don't forget remaining words
    if current_segment:
        segments.append(current_segment)

    # Format segments with millisecond precision
    lines = []
    for segment in segments:
        start_time = segment[0]["start"]
        end_time = segment[-1]["end"]
        segment_text = " ".join(w["text"] for w in segment)
        speaker = segment[0].get("speaker")

        timestamp = f"{_format_time_precise(start_time)} - {_format_time_precise(end_time)}"
        if speaker is not None:
            lines.append(f"{timestamp} [Speaker {speaker}]: {segment_text}")
        else:
            lines.append(f"{timestamp}: {segment_text}")

    return "\n".join(lines)


def extract_context_window(
    words: list[dict[str, Any]],
    start_time: float,
    end_time: float,
    char_limit: int = 2000,
) -> tuple[str, str]:
    """
    Extract surrounding context from word-level transcript data.

    Args:
        words: List of word objects with start, end, text
        start_time: Start time of the segment in seconds
        end_time: End time of the segment in seconds
        char_limit: Maximum characters to extract before/after (default 2000)

    Returns:
        Tuple of (context_before, context_after)
    """
    # Collect words before the start time
    before_words = [w for w in words if w["end"] <= start_time]

    # Collect words after the end time
    after_words = [w for w in words if w["start"] >= end_time]

    # Build context_before by taking words from the end (closest to our segment)
    context_before = ""
    for word in reversed(before_words):
        text = word["text"].strip()
        if len(context_before) + len(text) + 1 > char_limit:
            break
        context_before = text + " " + context_before if context_before else text

    # Build context_after by taking words from the start (closest to our segment)
    context_after = ""
    for word in after_words:
        text = word["text"].strip()
        if len(context_after) + len(text) + 1 > char_limit:
            break
        context_after = context_after + " " + text if context_after else text

    return context_before.strip(), context_after.strip()


async def analyze_transcript_for_shorts(
    api_key: str,
    transcript_segments: list[dict[str, Any]],
    num_shorts: int = 3,
    preferred_length: int = 45,
    max_length: int = 60,
    custom_prompt: str | None = None,
    existing_shorts: list[dict[str, Any]] | None = None,
    model: str = "openai/gpt-4o",
    trace_id: str | None = None,
    user_id: str | None = None,
) -> list[ShortSuggestion]:
    """
    Analyze transcript using OpenRouter GPT-4o to identify viral short opportunities.

    Args:
        api_key: OpenRouter API key
        transcript_segments: List of transcript segments with start, end, text
        num_shorts: Number of shorts to generate (default: 3)
        preferred_length: Preferred length for shorts in seconds (default: 45)
        max_length: Maximum allowed length in seconds (default: 60)
        custom_prompt: Optional custom instructions to include in prompt
        existing_shorts: Optional list of existing shorts to avoid overlapping with
        model: OpenRouter model to use (default: "openai/gpt-4o")
        trace_id: Optional trace ID for analytics
        user_id: Optional user ID (Clerk ID) for PostHog attribution

    Returns:
        List of ShortSuggestion objects with suggested clips

    Raises:
        httpx.HTTPError: If API request fails
        ValueError: If response format is invalid
    """
    logger.info(
        "analyzing_transcript_for_shorts",
        num_shorts=num_shorts,
        preferred_length=preferred_length,
        max_length=max_length,
        num_segments=len(transcript_segments),
        has_custom_prompt=custom_prompt is not None,
        num_existing_shorts=len(existing_shorts) if existing_shorts else 0,
    )

    # Format transcript with timestamps
    transcript = format_transcript_for_ai(transcript_segments)

    # Build custom instructions section
    custom_section = ""
    if custom_prompt:
        custom_section = f"\n\nCustom Instructions:\n{custom_prompt}\n"

    # Build existing shorts avoidance section
    existing_shorts_section = ""
    if existing_shorts:
        existing_list = json.dumps(
            [{"transcription": s["transcription"]} for s in existing_shorts],
            indent=2,
        )
        existing_shorts_section = f"""

IMPORTANT - Avoid Overlap with Existing Shorts:
The following shorts have already been created from this video. You MUST NOT select segments that overlap with or duplicate this content:
{existing_list}

Select completely different moments from the video that do not cover the same topics or content as these existing shorts.
"""

    # Build prompt based on user's example
    # Calculate minimum as 80% of preferred length (scales proportionally)
    min_length = max(15, int(preferred_length * 0.8))
    prompt = f"""You are analyzing a video transcript to find the best moments for creating EXACTLY {num_shorts} short-form video(s).

COUNT REQUIREMENT (CRITICAL):
- You MUST return EXACTLY {num_shorts} segment(s), no more, no less
- If you find more good candidates, select only the {num_shorts} BEST ones
- Returning more or fewer segments than requested is NOT acceptable

DURATION REQUIREMENTS (CRITICAL):
- TARGET: {preferred_length}-{max_length} seconds per segment
- MINIMUM: {min_length} seconds (segments shorter than this are NOT acceptable)
- When in doubt, include MORE content to reach the target duration
- It is better to be slightly over {preferred_length}s than under it
{custom_section}{existing_shorts_section}
Criteria for selection:
- Engaging moments (exciting, funny, emotionally compelling)
- High information density (valuable tips, insights, key points)
- Complete thoughts (not cut off mid-sentence or mid-idea)
- Natural start and end points (speech pauses, topic transitions)
- Self-contained segments that feel like standalone content, not fragments
- Segments MUST NOT overlap with each other - each segment should cover unique content from the video

DURATION GUIDANCE:
- If a segment feels complete but is under {preferred_length} seconds, EXTEND it by including:
  - The speaker's elaboration or examples that follow
  - Supporting statements or context that precedes
  - The full explanation, not just the key point
- Only end a segment early ({min_length}-{preferred_length}s) if there is a STRONG natural break with no related content nearby
- Prefer longer, complete explanations over short, punchy clips

Flow & Naturalness Guidelines:
- Segments should feel complete and standalone
- The opening should establish context - avoid starting with pronouns ("it", "that", "this") without clear referents
- The ending should feel conclusive, not abruptly cut off
- Balance flow with duration: a well-flowing {preferred_length}s segment is ideal, but don't sacrifice duration for marginal flow improvements
- When choosing between a shorter segment with perfect flow and a longer segment with good flow, choose the longer segment

Transcript with timestamps:
{transcript}

You MUST return EXACTLY {num_shorts} segment(s). Select only the {num_shorts} BEST segments from the transcript. Each segment MUST:
- Be {preferred_length}-{max_length} seconds long (absolute minimum: {min_length} seconds)
- Include complete thoughts WITH their supporting context, examples, and elaboration
- Capture the FULL explanation, not just the headline point
- Start and end at natural pauses (breath breaks, sentence completions, topic shifts)
- Be engaging and valuable on its own

For each segment, provide:
1. The exact start and end timestamps
2. The full transcription of the spoken words in that segment

Return your response as a JSON array with this exact format:
[
  {{
    "segment_id": "001",
    "start_time": "00:01:23,456",
    "end_time": "00:02:05,789",
    "transcription": "The exact words spoken in this segment..."
  }}
]

Return ONLY the JSON array with EXACTLY {num_shorts} segment(s), no other text."""

    # Call OpenRouter API using OpenAI SDK
    # Uses PostHog-wrapped client if POSTHOG_API_KEY is configured
    client = get_openrouter_client(api_key=api_key, timeout=120.0)

    # Build kwargs - only include PostHog params if PostHog is enabled
    create_kwargs: dict[str, Any] = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 4000,
    }
    if is_posthog_enabled():
        create_kwargs["posthog_trace_id"] = trace_id
        create_kwargs["posthog_distinct_id"] = user_id
        create_kwargs["posthog_properties"] = {"$ai_span_name": "shorts_analysis"}

    try:
        response = await client.chat.completions.create(**create_kwargs)
    except (APIError, APITimeoutError, RateLimitError) as e:
        logger.error("openrouter_api_error", error=str(e))
        raise

    logger.debug("openrouter_response", response=response.model_dump(), trace_id=trace_id)

    # Extract content from response
    try:
        content = response.choices[0].message.content
        if content is None:
            raise ValueError("Response content is None")
    except (IndexError, AttributeError) as e:
        logger.error("invalid_openrouter_response", error=str(e), response=response.model_dump())
        raise ValueError("Invalid response format from OpenRouter") from e

    # Parse JSON array from content
    # Handle markdown code blocks if present
    content = content.strip()
    if content.startswith("```json"):
        content = content[7:]
    elif content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    try:
        segments_data = json.loads(content)
    except json.JSONDecodeError as e:
        logger.error("failed_to_parse_json", error=str(e), content=content)
        raise ValueError("Failed to parse JSON response from AI") from e

    # Convert to ShortSuggestion objects
    suggestions = []
    for segment in segments_data:
        try:
            suggestion = ShortSuggestion(
                segment_id=segment["segment_id"],
                start_time=parse_timestamp(segment["start_time"]),
                end_time=parse_timestamp(segment["end_time"]),
                transcription=segment["transcription"],
            )
            suggestions.append(suggestion)
            logger.debug(
                "parsed_suggestion",
                segment_id=suggestion.segment_id,
                start=suggestion.start_time,
                end=suggestion.end_time,
                duration=suggestion.duration,
            )
        except (KeyError, ValueError) as e:
            logger.warning("skipping_invalid_segment", error=str(e), segment=segment)
            continue

    logger.info(
        "analysis_complete",
        num_suggestions=len(suggestions),
        total_duration=sum(s.duration for s in suggestions),
    )

    return suggestions


# Platform-specific instructions for social content generation
PLATFORM_INSTRUCTIONS = {
    "youtube": """YouTube (Title + Description):
Title (max 100 chars):
- Front-load key information in first 60 chars
- Include primary keyword naturally
- Use numbers/lists when relevant ("5 Ways to...")
- Create curiosity gap without clickbait
- Capitalize appropriately (avoid ALL CAPS)

Description (max 5,000 chars, but keep concise):
- First 125 chars appear in search - make them count
- Include 2-3 relevant keywords naturally
- Include relevant call to action
- Use hashtags sparingly (3-5 max at end)""",
    "instagram": """Instagram (Caption only):
Caption (max 2,200 chars):
- Hook in first line (visible without "more")
- Use line breaks for readability
- Tell a story or provide value
- Include CTA ("Link in bio", "Save this post")
- Place hashtags at end (5-15 relevant ones)
- Use emojis strategically for visual breaks""",
    "tiktok": """TikTok (Caption only):
Caption (max 2,200 chars, but keep under 150 for best engagement):
- Ultra-concise hook statement
- 3-5 highly targeted hashtags
- Question or CTA to boost engagement
- Match caption energy to video tone
- Front-load the value proposition""",
    "linkedin": """LinkedIn (Caption only):
Caption (max 3,000 chars):
- First 1-2 lines are critical - act as your "headline" in the feed
- Hook with bold statement, statistic, or counterintuitive insight
- Use line breaks between sentences for mobile readability
- Professional tone with authentic personality
- Share actionable insights or lessons learned
- End with engaging question or clear CTA
- 3-5 relevant hashtags at the very end
- Avoid overused phrases ("I'm humbled to announce...")""",
}


async def generate_social_content(
    api_key: str,
    transcription: str,
    platforms: list[str],
    model: str = "openai/gpt-5-mini",
    context_before: str | None = None,
    context_after: str | None = None,
    custom_prompt: str | None = None,
    trace_id: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """
    Generate social media content for a short video clip using structured outputs.

    Args:
        api_key: OpenRouter API key
        transcription: The transcription text of the short video clip
        platforms: List of platforms to generate content for (youtube, instagram, tiktok, linkedin)
        model: The model to use for generation (default: gpt-5-mini)
        context_before: Optional context from before the segment (~2000 chars)
        context_after: Optional context from after the segment (~2000 chars)
        custom_prompt: Optional custom instructions for content generation style/tone
        trace_id: Optional trace ID for analytics
        user_id: Optional user ID (Clerk ID) for PostHog attribution

    Returns:
        Dictionary with content for each platform, e.g.:
        {
            "youtube": {"title": "...", "description": "..."},
            "instagram": {"caption": "..."},
            "tiktok": {"caption": "..."},
            "linkedin": {"caption": "..."}
        }

    Raises:
        httpx.HTTPError: If API request fails after retries
        ValueError: If no valid platforms provided
    """
    logger.info(
        "generating_social_content",
        platforms=platforms,
        transcription_length=len(transcription),
        model=model,
    )

    if not platforms:
        return {}

    # Validate platforms and build response format
    valid_platforms = [p for p in platforms if p in VALID_PLATFORMS]
    if not valid_platforms:
        logger.warning("no_valid_platforms", requested=platforms)
        return {}

    response_format = build_response_format(valid_platforms)

    # Build platform instructions section
    platform_sections = []
    for platform in valid_platforms:
        if platform in PLATFORM_INSTRUCTIONS:
            platform_sections.append(PLATFORM_INSTRUCTIONS[platform])
    platform_instructions = "\n\n".join(platform_sections)

    # Build transcript section with optional context
    if context_before or context_after:
        transcript_section = f"""For context, here is the surrounding transcript from the full video:

[CONTEXT BEFORE THE CLIP]
{context_before if context_before else "(beginning of video)"}

[THE VIDEO CLIP - Generate content based on THIS segment]
{transcription}

[CONTEXT AFTER THE CLIP]
{context_after if context_after else "(end of video)"}

Use the surrounding context to better understand what the speaker is discussing, but generate content specifically for the video clip section."""
    else:
        transcript_section = f"""Video Transcript:
{transcription}"""

    # Build custom instructions section if provided
    custom_instructions = ""
    if custom_prompt:
        custom_instructions = f"""
CUSTOM INSTRUCTIONS FROM USER:
{custom_prompt}

Apply these instructions when generating all content below.
"""

    prompt = f"""You are a social media content expert. Based on the following video transcript, generate optimized social media content for the specified platforms.
{custom_instructions}
{transcript_section}

Generate content for these platforms with the following guidelines:

{platform_instructions}

IMPORTANT:
- Generate compelling, engaging content that would make viewers want to watch the video
- Tailor the tone and style to each platform's audience
- Keep content authentic and avoid clickbait
- Use relevant hashtags where appropriate
- Fix any typos or transcription errors from the source transcript
- NEVER include placeholder text like "[link]", "[URL]", "Watch more: [link]", or similar bracketed placeholders unless the user explicitly requests them in their custom instructions
- Write complete, ready-to-use content"""

    # Retry configuration - only retry API errors, not parsing errors
    max_retries = 3
    retry_base_delay = 1.0

    # Get OpenRouter client (PostHog-wrapped if configured)
    client = get_openrouter_client(api_key=api_key, timeout=60.0)

    # Build kwargs - only include PostHog params if PostHog is enabled
    create_kwargs: dict[str, Any] = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 1,
        "max_tokens": 4800,
        "response_format": response_format,
    }
    if is_posthog_enabled():
        create_kwargs["posthog_trace_id"] = trace_id
        create_kwargs["posthog_distinct_id"] = user_id
        create_kwargs["posthog_properties"] = {"$ai_span_name": "social_content_generation"}

    last_error: Exception | None = None

    for attempt in range(max_retries):
        try:
            response = await client.chat.completions.create(**create_kwargs)

            logger.debug("openrouter_response_social_content", response=response.model_dump(), trace_id=trace_id)

            # With structured outputs, content is guaranteed valid JSON
            content = response.choices[0].message.content
            if content is None:
                raise ValueError("Response content is None")
            social_content = json.loads(content)

            logger.info(
                "social_content_generated",
                platforms=list(social_content.keys()),
            )

            return social_content

        except (APIError, APITimeoutError, RateLimitError) as e:
            last_error = e
            if attempt < max_retries - 1:
                delay = retry_base_delay * (2**attempt)
                logger.warning(
                    "social_content_api_retry",
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    delay_seconds=delay,
                    error=str(e),
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    "social_content_api_failed_all_retries",
                    attempts=max_retries,
                    error=str(e),
                )
                raise

    # Should not reach here, but satisfy type checker
    if last_error:
        raise last_error
    return {}
