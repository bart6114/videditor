"""AI-powered video analysis using OpenRouter."""

import json
from typing import Any

import httpx
import structlog

logger = structlog.get_logger()


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


async def analyze_transcript_for_shorts(
    api_key: str,
    transcript_segments: list[dict[str, Any]],
    num_shorts: int = 3,
    custom_prompt: str | None = None,
) -> list[ShortSuggestion]:
    """
    Analyze transcript using OpenRouter GPT-4o to identify viral short opportunities.

    Args:
        api_key: OpenRouter API key
        transcript_segments: List of transcript segments with start, end, text
        num_shorts: Number of shorts to generate (default: 3)
        custom_prompt: Optional custom instructions to include in prompt

    Returns:
        List of ShortSuggestion objects with suggested clips

    Raises:
        httpx.HTTPError: If API request fails
        ValueError: If response format is invalid
    """
    logger.info(
        "analyzing_transcript_for_shorts",
        num_shorts=num_shorts,
        num_segments=len(transcript_segments),
        has_custom_prompt=custom_prompt is not None,
    )

    # Format transcript with timestamps
    transcript = format_transcript_for_ai(transcript_segments)

    # Build custom instructions section
    custom_section = ""
    if custom_prompt:
        custom_section = f"\n\nCustom Instructions:\n{custom_prompt}\n"

    # Build prompt based on user's example
    prompt = f"""You are analyzing a video transcript to find the best moments for creating {num_shorts} short-form videos (ideally between 30 and 45 seconds, max 60 seconds if needed for message consistency).
{custom_section}
Criteria for selection:
- Engaging moments (exciting, funny, emotionally compelling)
- High information density (valuable tips, insights, key points)
- Complete thoughts (not cut off mid-sentence or mid-idea)
- Natural start and end points (speech pauses, topic transitions)
- Self-contained segments that feel like standalone content, not fragments

CRITICAL - Flow & Naturalness Requirements:
- The segment MUST feel like a complete, standalone piece with a natural beginning and ending
- Viewers should NOT feel confused, disoriented, or like they're entering mid-conversation
- The opening should establish context naturally - avoid starting with pronouns ("it", "that", "this") without clear referents
- The ending should provide closure and feel conclusive - avoid cutting off mid-thought or mid-statement
- Avoid segments that would create jarring audio transitions or make the speaker sound abruptly interrupted
- Prioritize smooth, natural flow over raw engagement - a slightly less exciting segment with perfect flow is better than an engaging segment with abrupt cuts

Transcript with timestamps:
{transcript}

Please identify the {num_shorts} best segments. Each segment should be:
- Ideally between 30 and 45 seconds long, but can extend up to 60 seconds if needed to complete the thought/message
- Start and end at natural pauses (breath breaks, sentence completions, topic shifts)
- Contain a complete thought or idea that stands alone without requiring prior context
- Be engaging and valuable on its own
- Feel polished and intentional, not like a fragment ripped from a longer video

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
                    "model": "openai/gpt-4o",
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
