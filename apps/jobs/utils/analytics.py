"""PostHog LLM Analytics integration for OpenAI and OpenRouter calls."""

import time
import uuid
import warnings
from dataclasses import dataclass, field
from typing import Any

import posthog
import structlog
from openai import AsyncOpenAI

logger = structlog.get_logger()

# Deepgram pricing per minute (USD) - https://deepgram.com/pricing
DEEPGRAM_PRICING_PER_MINUTE = {
    "nova-3": 0.0043,
    "nova-2": 0.0043,
    "nova": 0.0043,
    "enhanced": 0.0145,
    "base": 0.0125,
}

# Module-level state for lazy initialization
_posthog_initialized = False


def _ensure_posthog_initialized() -> bool:
    """
    Lazily initialize PostHog client from config.

    Returns True if PostHog is configured and ready, False otherwise.
    """
    global _posthog_initialized

    if _posthog_initialized:
        return True

    # Import here to avoid circular imports
    from config import load_job_config

    try:
        config = load_job_config()
    except Exception as e:
        logger.warning("posthog_config_load_failed", error=str(e))
        return False

    if not config.POSTHOG_API_KEY:
        logger.debug("posthog_not_configured", reason="POSTHOG_API_KEY not set")
        return False

    # PostHog SDK requires api_key (not project_api_key) for capture() calls
    posthog.api_key = config.POSTHOG_API_KEY
    posthog.project_api_key = config.POSTHOG_API_KEY
    posthog.host = config.POSTHOG_HOST

    _posthog_initialized = True
    logger.info(
        "posthog_initialized",
        host=config.POSTHOG_HOST,
    )
    return True


def get_openai_client(
    api_key: str,
    timeout: float = 600.0,
    **kwargs: Any,
) -> AsyncOpenAI:
    """
    Get an OpenAI client, optionally wrapped with PostHog analytics.

    If PostHog is configured (POSTHOG_API_KEY set), returns a wrapped client
    that automatically captures LLM analytics. Otherwise, returns a standard
    AsyncOpenAI client.

    Args:
        api_key: OpenAI API key
        timeout: Request timeout in seconds (default: 600)
        **kwargs: Additional arguments passed to AsyncOpenAI

    Returns:
        AsyncOpenAI client (wrapped or standard)
    """
    if _ensure_posthog_initialized():
        try:
            from posthog.ai.openai import AsyncOpenAI as PostHogAsyncOpenAI

            return PostHogAsyncOpenAI(
                api_key=api_key,
                timeout=timeout,
                posthog_client=posthog,
                **kwargs,
            )
        except ImportError:
            logger.warning("posthog_ai_import_failed", fallback="standard_client")

    # Fallback to standard client
    return AsyncOpenAI(api_key=api_key, timeout=timeout, **kwargs)


def get_openrouter_client(
    api_key: str,
    timeout: float = 120.0,
    **kwargs: Any,
) -> AsyncOpenAI:
    """
    Get an OpenRouter client using OpenAI SDK, optionally wrapped with PostHog.

    OpenRouter is OpenAI-compatible, so we use the OpenAI SDK with a custom
    base_url. If PostHog is configured, the client is wrapped for analytics.

    Args:
        api_key: OpenRouter API key
        timeout: Request timeout in seconds (default: 120)
        **kwargs: Additional arguments passed to AsyncOpenAI

    Returns:
        AsyncOpenAI client configured for OpenRouter
    """
    default_headers = kwargs.pop("default_headers", {})
    default_headers["HTTP-Referer"] = "https://videditor.app"

    if _ensure_posthog_initialized():
        try:
            from posthog.ai.openai import AsyncOpenAI as PostHogAsyncOpenAI

            return PostHogAsyncOpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1",
                timeout=timeout,
                default_headers=default_headers,
                posthog_client=posthog,
                **kwargs,
            )
        except ImportError:
            logger.warning("posthog_ai_import_failed", fallback="standard_client")

    # Fallback to standard client
    return AsyncOpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        timeout=timeout,
        default_headers=default_headers,
        **kwargs,
    )


def track_deepgram_transcription(
    trace_id: str,
    model: str,
    duration_seconds: float,
    word_count: int,
    latency_ms: float,
    success: bool,
    error: str | None = None,
    user_id: str | None = None,
) -> None:
    """
    DEPRECATED: Use start_deepgram_trace() + track_deepgram_chunk() + complete_deepgram_trace() instead.

    Track Deepgram transcription call in PostHog (legacy event format).
    """
    warnings.warn(
        "track_deepgram_transcription() is deprecated. Use DeepgramTraceContext with "
        "start_deepgram_trace(), track_deepgram_chunk(), and complete_deepgram_trace() instead.",
        DeprecationWarning,
        stacklevel=2,
    )

    if not _ensure_posthog_initialized():
        return

    # Use user_id if provided, otherwise fall back to anonymous identifier
    distinct_id = user_id or "videditor-jobs-anonymous"

    try:
        posthog.capture(
            distinct_id=distinct_id,
            event="deepgram_transcription",
            properties={
                "trace_id": trace_id,
                "model": model,
                "duration_seconds": duration_seconds,
                "word_count": word_count,
                "latency_ms": latency_ms,
                "success": success,
                "error": error,
            },
        )
    except Exception as e:
        logger.warning("posthog_capture_failed", error=str(e))


def capture_ai_generation(
    distinct_id: str | None,
    provider: str,
    model: str,
    input_data: str | list[dict[str, Any]] | None,
    output_data: str | list[dict[str, Any]] | None,
    latency_seconds: float,
    trace_id: str,
    parent_trace_id: str | None = None,
    span_name: str | None = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    http_status: int = 200,
    is_error: bool = False,
    error_message: str | None = None,
    base_url: str = "https://api.deepgram.com",
    extra_properties: dict[str, Any] | None = None,
) -> None:
    """
    Capture a PostHog $ai_generation event for any AI provider.

    This creates events compatible with PostHog's LLM dashboard.

    Args:
        distinct_id: User ID (Clerk ID). Falls back to trace_id if not provided.
        provider: AI provider name (e.g., "deepgram", "openrouter")
        model: Model identifier (e.g., "deepgram/nova-3")
        input_data: Input content - string or list of message dicts
        output_data: Output content - string or list of choice dicts
        latency_seconds: API call latency in seconds
        trace_id: Unique trace ID for linking related events
        parent_trace_id: Parent trace ID for hierarchical tracing
        span_name: Custom span name (e.g., "transcription", "chunk_0")
        input_tokens: Input token count (or audio seconds for STT)
        output_tokens: Output token count (word count for STT)
        http_status: HTTP status code (default 200)
        is_error: Whether this was an error
        error_message: Error message if is_error is True
        base_url: API base URL
        extra_properties: Additional custom properties
    """
    if not _ensure_posthog_initialized():
        return

    # Format input as message list if it's a string
    if isinstance(input_data, str):
        ai_input = [{"role": "user", "content": input_data}]
    else:
        ai_input = input_data

    # Format output as choices list if it's a string
    if isinstance(output_data, str):
        ai_output = [{"role": "assistant", "content": output_data}]
    else:
        ai_output = output_data

    # Build properties dict with PostHog's standard $ai_* fields
    properties: dict[str, Any] = {
        "$ai_provider": provider,
        "$ai_model": model,
        "$ai_input": ai_input,
        "$ai_output_choices": ai_output,
        "$ai_input_tokens": input_tokens,
        "$ai_output_tokens": output_tokens,
        "$ai_latency": latency_seconds,
        "$ai_trace_id": trace_id,
        "$ai_base_url": base_url,
        "$ai_http_status": http_status,
        "$ai_is_error": is_error,
    }

    if parent_trace_id:
        properties["$ai_parent_trace_id"] = parent_trace_id

    if span_name:
        properties["$ai_span_name"] = span_name

    if error_message:
        properties["$ai_error"] = error_message

    # Add any extra custom properties
    if extra_properties:
        properties.update(extra_properties)

    try:
        posthog.capture(
            distinct_id=distinct_id or trace_id,
            event="$ai_generation",
            properties=properties,
        )
    except Exception as e:
        logger.warning("posthog_ai_capture_failed", error=str(e), trace_id=trace_id)


@dataclass
class DeepgramTraceContext:
    """Context for hierarchical Deepgram tracing."""

    trace_id: str
    user_id: str | None
    model: str
    start_time: float
    total_audio_duration: float
    total_audio_size_bytes: int
    chunk_count: int
    # Aggregated metrics (updated as chunks complete)
    completed_chunks: int = 0
    total_word_count: int = 0
    total_latency_seconds: float = 0.0


def start_deepgram_trace(
    user_id: str | None,
    model: str,
    total_audio_duration: float,
    total_audio_size_bytes: int,
    chunk_count: int,
    project_id: str | None = None,
    job_id: str | None = None,
) -> DeepgramTraceContext:
    """
    Start a new Deepgram transcription trace (parent span).

    Call this at the beginning of transcribe_video() to create
    the parent trace context for multi-chunk transcription.

    Args:
        user_id: Clerk user ID for attribution
        model: Deepgram model (e.g., "nova-3")
        total_audio_duration: Total audio duration in seconds
        total_audio_size_bytes: Total audio file size in bytes
        chunk_count: Number of chunks (1 for short videos)
        project_id: Optional project ID for trace ID
        job_id: Optional job ID for trace ID

    Returns:
        DeepgramTraceContext to pass through transcription flow
    """
    # Generate trace ID
    if project_id and job_id:
        trace_id = f"transcription:{project_id}:{job_id}"
    else:
        trace_id = f"transcription:{uuid.uuid4().hex[:12]}"

    return DeepgramTraceContext(
        trace_id=trace_id,
        user_id=user_id,
        model=model,
        start_time=time.time(),
        total_audio_duration=total_audio_duration,
        total_audio_size_bytes=total_audio_size_bytes,
        chunk_count=chunk_count,
    )


def track_deepgram_chunk(
    ctx: DeepgramTraceContext,
    chunk_index: int,
    audio_duration_seconds: float,
    audio_size_bytes: int,
    transcript_snippet: str,
    word_count: int,
    latency_seconds: float,
    success: bool,
    error_message: str | None = None,
) -> None:
    """
    Update aggregated metrics for a Deepgram chunk (no individual event sent).

    Metrics are accumulated in the trace context and sent as a single
    aggregated event when complete_deepgram_trace() is called.

    Args:
        ctx: Parent trace context from start_deepgram_trace()
        chunk_index: Index of this chunk (0-based) - unused, kept for API compat
        audio_duration_seconds: Duration of this chunk in seconds - unused
        audio_size_bytes: Size of this chunk in bytes - unused
        transcript_snippet: First ~200 chars of transcript - unused
        word_count: Number of words in this chunk's transcript
        latency_seconds: API call latency in seconds
        success: Whether transcription succeeded - unused
        error_message: Error message if failed - unused
    """
    # Update aggregated metrics only - no individual PostHog events
    ctx.completed_chunks += 1
    ctx.total_word_count += word_count
    ctx.total_latency_seconds += latency_seconds


def complete_deepgram_trace(
    ctx: DeepgramTraceContext,
    success: bool,
    transcript_snippet: str | None = None,
    error_message: str | None = None,
) -> None:
    """
    Complete a Deepgram transcription trace (finalize parent span).

    Creates the parent $ai_generation event with aggregated metrics.

    Args:
        ctx: Trace context from start_deepgram_trace()
        success: Whether the full transcription succeeded
        transcript_snippet: First ~500 chars of full transcript
        error_message: Error message if failed
    """
    total_latency = time.time() - ctx.start_time

    # Calculate price per "token" (audio second) for PostHog cost calculation
    # PostHog calculates: totalCost = input_tokens * input_token_price + output_tokens * output_token_price
    price_per_minute = DEEPGRAM_PRICING_PER_MINUTE.get(ctx.model, 0.0043)
    price_per_second = price_per_minute / 60

    # Format input description
    size_mb = ctx.total_audio_size_bytes / (1024 * 1024)
    input_desc = (
        f"Audio: {ctx.total_audio_duration:.1f}s, {size_mb:.2f}MB, "
        f"{ctx.chunk_count} chunk{'s' if ctx.chunk_count != 1 else ''}"
    )

    capture_ai_generation(
        distinct_id=ctx.user_id,
        provider="deepgram",
        model=f"deepgram/{ctx.model}",
        input_data=input_desc,
        output_data=transcript_snippet[:500] if transcript_snippet else None,
        latency_seconds=total_latency,
        trace_id=ctx.trace_id,
        parent_trace_id=None,  # This is the root trace
        span_name="transcription",
        input_tokens=int(ctx.total_audio_duration),  # Audio seconds as proxy
        output_tokens=ctx.total_word_count,
        http_status=200 if success else 500,
        is_error=not success,
        error_message=error_message,
        extra_properties={
            "audio_duration_seconds": ctx.total_audio_duration,
            "audio_size_bytes": ctx.total_audio_size_bytes,
            "chunk_count": ctx.chunk_count,
            "completed_chunks": ctx.completed_chunks,
            "$ai_input_token_price": price_per_second,
            "$ai_output_token_price": 0,  # Deepgram has no output cost
        },
    )


def is_posthog_enabled() -> bool:
    """Check if PostHog is configured and enabled."""
    return _ensure_posthog_initialized()


def shutdown_posthog() -> None:
    """Flush pending events and shutdown PostHog client."""
    if _posthog_initialized:
        try:
            posthog.shutdown()
            logger.info("posthog_shutdown")
        except Exception as e:
            logger.warning("posthog_shutdown_failed", error=str(e))
