"""AI-powered video analysis using OpenRouter."""

import asyncio
import json
from typing import Any

import httpx
import structlog

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


def format_transcript_for_ai(segments: list[dict[str, Any]]) -> str:
    """
    Format transcript segments with timestamps for AI analysis.

    Args:
        segments: List of transcript segments with start, end, text

    Returns:
        Formatted transcript string with timestamps
    """
    lines = []
    for segment in segments:
        start = segment["start"]
        end = segment["end"]
        text = segment["text"].strip()

        # Convert seconds to HH:MM:SS format
        start_h = int(start // 3600)
        start_m = int((start % 3600) // 60)
        start_s = int(start % 60)

        end_h = int(end // 3600)
        end_m = int((end % 3600) // 60)
        end_s = int(end % 60)

        timestamp = f"{start_h:02d}:{start_m:02d}:{start_s:02d} - {end_h:02d}:{end_m:02d}:{end_s:02d}"
        lines.append(f"{timestamp}: {text}")

    return "\n".join(lines)


def extract_context_window(
    segments: list[dict[str, Any]],
    start_time: float,
    end_time: float,
    char_limit: int = 2000,
) -> tuple[str, str]:
    """
    Extract surrounding context from transcript segments.

    Args:
        segments: List of transcript segments with start, end, text
        start_time: Start time of the segment in seconds
        end_time: End time of the segment in seconds
        char_limit: Maximum characters to extract before/after (default 2000)

    Returns:
        Tuple of (context_before, context_after)
    """
    # Collect segments before the start time
    before_segments = []
    for seg in segments:
        if seg["end"] <= start_time:
            before_segments.append(seg)

    # Collect segments after the end time
    after_segments = []
    for seg in segments:
        if seg["start"] >= end_time:
            after_segments.append(seg)

    # Build context_before by taking segments from the end (closest to our segment)
    context_before = ""
    for seg in reversed(before_segments):
        text = seg["text"].strip()
        if len(context_before) + len(text) + 1 > char_limit:
            # Add partial text if we have room
            remaining = char_limit - len(context_before)
            if remaining > 50:  # Only add if meaningful amount
                context_before = text[-remaining:].lstrip() + " " + context_before
            break
        context_before = text + " " + context_before if context_before else text

    # Build context_after by taking segments from the start (closest to our segment)
    context_after = ""
    for seg in after_segments:
        text = seg["text"].strip()
        if len(context_after) + len(text) + 1 > char_limit:
            # Add partial text if we have room
            remaining = char_limit - len(context_after)
            if remaining > 50:  # Only add if meaningful amount
                context_after = context_after + " " + text[:remaining].rstrip()
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
    prompt = f"""You are analyzing a video transcript to find the best moments for creating {num_shorts} short-form videos.

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

Please identify the {num_shorts} best segments. Each segment MUST:
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

Return ONLY the JSON array, no other text."""

    # Call OpenRouter API
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://videditor.app",
                },
                json={
                    "model": model,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt,
                        }
                    ],
                    "temperature": 0.7,
                    "max_tokens": 4000,
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as e:
            logger.error("openrouter_api_error", error=str(e))
            raise

    # Parse response
    result = response.json()
    logger.debug("openrouter_response", result=result)

    # Extract content from response
    try:
        content = result["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        logger.error("invalid_openrouter_response", error=str(e), result=result)
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

    # Retry configuration - only retry HTTP errors, not parsing errors
    max_retries = 3
    retry_base_delay = 1.0

    last_error: Exception | None = None

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://videditor.app",
                    },
                    json={
                        "model": model,
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt,
                            }
                        ],
                        "temperature": 1,
                        "max_tokens": 4800,
                        "response_format": response_format,
                    },
                )
                response.raise_for_status()

            result = response.json()
            logger.debug("openrouter_response_social_content", result=result)

            # With structured outputs, content is guaranteed valid JSON
            content = result["choices"][0]["message"]["content"]
            social_content = json.loads(content)

            logger.info(
                "social_content_generated",
                platforms=list(social_content.keys()),
            )

            return social_content

        except httpx.HTTPError as e:
            last_error = e
            if attempt < max_retries - 1:
                delay = retry_base_delay * (2**attempt)
                logger.warning(
                    "social_content_http_retry",
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    delay_seconds=delay,
                    error=str(e),
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    "social_content_http_failed_all_retries",
                    attempts=max_retries,
                    error=str(e),
                )
                raise

    # Should not reach here, but satisfy type checker
    if last_error:
        raise last_error
    return {}
