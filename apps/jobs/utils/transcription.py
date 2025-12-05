"""Video transcription using OpenAI Whisper API."""

import asyncio
import os
import tempfile
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import structlog
from openai import AsyncOpenAI, RateLimitError, APIError, APITimeoutError

from models import TranscriptionResult, WhisperSegment
from utils.analytics import get_openai_client
from utils.ffmpeg import extract_audio, split_audio_chunk, get_video_duration

logger = structlog.get_logger()

# OpenAI Whisper API has a 25MB file size limit (kept for reference)
MAX_FILE_SIZE_MB = 25.0

# Default chunk duration for time-based splitting
DEFAULT_CHUNK_DURATION_SECONDS = 360.0  # 6 minutes


@dataclass
class AudioChunk:
    """Metadata for an audio chunk."""

    path: str
    start_time: float
    duration: float
    index: int


async def transcribe_video(
    video_path: str,
    api_key: str,
    chunk_duration_seconds: float = DEFAULT_CHUNK_DURATION_SECONDS,
    audio_bitrate: str = "64k",
    max_concurrent: int = 5,
    progress_callback: Callable[[int, int], Awaitable[None]] | None = None,
    trace_id: str | None = None,
) -> TranscriptionResult:
    """
    Transcribe a video file using OpenAI Whisper API.

    Args:
        video_path: Path to the video file
        api_key: OpenAI API key
        chunk_duration_seconds: Max duration per chunk in seconds (default 360 = 6 min)
        audio_bitrate: Audio bitrate for extraction (e.g., "64k")
        max_concurrent: Max concurrent API calls (default 5)
        progress_callback: Optional async callback(current, total) for progress updates

    Returns:
        TranscriptionResult with text, segments, and detected language

    Note:
        Videos longer than chunk_duration_seconds are split into chunks that
        are transcribed concurrently, then merged with proper timestamp offsets.
    """
    with tempfile.TemporaryDirectory(prefix="whisper-") as temp_dir:
        # 1. Extract audio from video
        audio_path = os.path.join(temp_dir, "audio.mp3")
        logger.info(
            "extracting_audio",
            video_path=video_path,
            output_path=audio_path,
            bitrate=audio_bitrate,
        )
        duration = await extract_audio(
            video_path=video_path,
            output_path=audio_path,
            bitrate=audio_bitrate,
        )

        # 2. Log audio info
        file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
        logger.info(
            "audio_extracted",
            duration_seconds=round(duration, 2),
            size_mb=round(file_size_mb, 2),
        )

        # 3. Initialize OpenAI client with extended timeout for transcription
        # Uses PostHog-wrapped client if POSTHOG_API_KEY is configured
        client = get_openai_client(api_key=api_key, timeout=600.0)

        # 4. Process based on duration (time-based chunking)
        if duration <= chunk_duration_seconds:
            # Short video, no chunking needed
            logger.info(
                "transcribing_single_file",
                duration_seconds=round(duration, 2),
                size_mb=round(file_size_mb, 2),
            )
            # Report progress for single file (0/1 -> 1/1)
            if progress_callback:
                await progress_callback(0, 1)
            text, segments, language = await _transcribe_chunk_with_retry(
                client, audio_path, None, trace_id=trace_id
            )
            if progress_callback:
                await progress_callback(1, 1)
            return TranscriptionResult(
                text=text,
                segments=[WhisperSegment(**seg) for seg in segments],
                language=language,
            )
        else:
            # Split into time-based chunks
            chunks = await _split_audio_into_chunks_by_time(
                audio_path=audio_path,
                output_dir=temp_dir,
                chunk_duration_seconds=chunk_duration_seconds,
                total_duration=duration,
            )

            logger.info(
                "audio_chunked",
                num_chunks=len(chunks),
                chunk_duration_seconds=chunk_duration_seconds,
                total_duration=round(duration, 2),
            )

            # Report initial progress
            if progress_callback:
                await progress_callback(0, len(chunks))

            # Transcribe all chunks concurrently with progress tracking
            results = await _transcribe_all_chunks(
                client, chunks, max_concurrent, progress_callback, trace_id=trace_id
            )

            # Merge results
            return _merge_transcription_results(results)


async def _split_audio_into_chunks_by_time(
    audio_path: str,
    output_dir: str,
    chunk_duration_seconds: float,
    total_duration: float,
) -> list[AudioChunk]:
    """
    Split audio file into fixed-duration chunks.

    Args:
        audio_path: Path to input audio file
        output_dir: Directory for chunk files
        chunk_duration_seconds: Maximum duration per chunk in seconds
        total_duration: Total duration of audio in seconds

    Returns:
        List of AudioChunk objects with paths and timing info
    """
    chunks: list[AudioChunk] = []
    current_time = 0.0
    chunk_index = 0

    while current_time < total_duration:
        # Calculate chunk duration (don't exceed remaining time)
        remaining = total_duration - current_time
        chunk_duration = min(chunk_duration_seconds, remaining)

        # Create chunk path
        chunk_path = os.path.join(output_dir, f"chunk_{chunk_index:03d}.mp3")

        # Split chunk using ffmpeg
        await split_audio_chunk(
            audio_path=audio_path,
            output_path=chunk_path,
            start_time=current_time,
            duration=chunk_duration,
        )

        # Verify chunk file size as sanity check
        chunk_size_mb = os.path.getsize(chunk_path) / (1024 * 1024)
        if chunk_size_mb > 20.0:
            logger.warning(
                "chunk_larger_than_expected",
                chunk_index=chunk_index,
                size_mb=round(chunk_size_mb, 2),
                duration_seconds=round(chunk_duration, 2),
            )

        chunks.append(
            AudioChunk(
                path=chunk_path,
                start_time=current_time,
                duration=chunk_duration,
                index=chunk_index,
            )
        )

        current_time += chunk_duration
        chunk_index += 1

    logger.info(
        "split_audio_by_time_complete",
        num_chunks=len(chunks),
        chunk_duration_seconds=chunk_duration_seconds,
        total_duration=round(total_duration, 2),
    )

    return chunks


async def _transcribe_chunk(
    client: AsyncOpenAI,
    audio_path: str,
    chunk_info: AudioChunk | None = None,
    trace_id: str | None = None,
) -> tuple[str, list[dict], str]:
    """
    Transcribe a single audio chunk via OpenAI API with speaker diarization.

    Args:
        client: OpenAI async client
        audio_path: Path to audio chunk
        chunk_info: Optional chunk metadata for timestamp offset
        trace_id: Optional trace ID for PostHog analytics

    Returns:
        Tuple of (text, segments, language)
    """
    with open(audio_path, "rb") as audio_file:
        response = await client.audio.transcriptions.create(
            model="gpt-4o-transcribe-diarize",
            file=audio_file,
            response_format="diarized_json",
            chunking_strategy="auto",  # Required for diarization models
            posthog_trace_id=trace_id,
        )

    # Extract and offset timestamps if this is a chunk
    segments: list[dict] = []
    offset = chunk_info.start_time if chunk_info else 0.0

    # response.segments may be None for very short/silent audio
    if response.segments:
        for seg in response.segments:
            segments.append(
                {
                    "start": seg.start + offset,
                    "end": seg.end + offset,
                    "text": seg.text.strip(),
                    "speaker": getattr(seg, "speaker", None),
                }
            )

    return response.text, segments, getattr(response, "language", None) or "unknown"


async def _transcribe_chunk_with_retry(
    client: AsyncOpenAI,
    audio_path: str,
    chunk_info: AudioChunk | None,
    max_retries: int = 3,
    retry_base_delay: float = 1.0,
    trace_id: str | None = None,
) -> tuple[str, list[dict], str]:
    """
    Transcribe chunk with exponential backoff retry.

    Handles:
    - Rate limits (429) - exponential backoff
    - Server errors (5xx) - retry
    - Network errors - retry

    Args:
        client: OpenAI async client
        audio_path: Path to audio chunk
        chunk_info: Optional chunk metadata
        max_retries: Maximum number of retries
        retry_base_delay: Base delay for exponential backoff
        trace_id: Optional trace ID for PostHog analytics

    Returns:
        Tuple of (text, segments, language)
    """
    last_error: Exception | None = None

    for attempt in range(max_retries):
        try:
            return await _transcribe_chunk(client, audio_path, chunk_info, trace_id)
        except RateLimitError as e:
            last_error = e
            delay = retry_base_delay * (2**attempt)
            logger.warning(
                "rate_limit_hit",
                attempt=attempt + 1,
                delay_seconds=delay,
                chunk_index=chunk_info.index if chunk_info else 0,
            )
            await asyncio.sleep(delay)
        except APITimeoutError as e:
            last_error = e
            delay = retry_base_delay * (2**attempt)
            logger.warning(
                "api_timeout",
                attempt=attempt + 1,
                delay_seconds=delay,
                chunk_index=chunk_info.index if chunk_info else 0,
            )
            await asyncio.sleep(delay)
        except APIError as e:
            last_error = e
            if hasattr(e, "status_code") and e.status_code and e.status_code >= 500:
                delay = retry_base_delay * (2**attempt)
                logger.warning(
                    "api_server_error",
                    attempt=attempt + 1,
                    delay_seconds=delay,
                    status_code=e.status_code,
                )
                await asyncio.sleep(delay)
            else:
                raise
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                delay = retry_base_delay * (2**attempt)
                logger.warning(
                    "transcription_error_retry",
                    attempt=attempt + 1,
                    delay_seconds=delay,
                    error=str(e),
                )
                await asyncio.sleep(delay)
            else:
                raise

    if last_error:
        raise last_error
    raise RuntimeError("Transcription failed after retries")


async def _transcribe_all_chunks(
    client: AsyncOpenAI,
    chunks: list[AudioChunk],
    max_concurrent: int = 5,
    progress_callback: Callable[[int, int], Awaitable[None]] | None = None,
    trace_id: str | None = None,
) -> list[tuple[str, list[dict], str]]:
    """
    Transcribe multiple chunks with controlled concurrency.

    Args:
        client: OpenAI async client
        chunks: List of audio chunks to transcribe
        max_concurrent: Maximum concurrent API calls
        progress_callback: Optional async callback(current, total) for progress updates
        trace_id: Optional trace ID for PostHog analytics

    Returns:
        List of results in chunk order
    """
    semaphore = asyncio.Semaphore(max_concurrent)
    completed_count = 0
    total_chunks = len(chunks)
    lock = asyncio.Lock()

    async def process_chunk(chunk: AudioChunk) -> tuple[str, list[dict], str]:
        nonlocal completed_count
        async with semaphore:
            logger.info(
                "transcribing_chunk",
                chunk_index=chunk.index,
                start_time=round(chunk.start_time, 2),
                duration=round(chunk.duration, 2),
            )
            result = await _transcribe_chunk_with_retry(client, chunk.path, chunk, trace_id=trace_id)
            logger.info(
                "chunk_transcribed",
                chunk_index=chunk.index,
                text_length=len(result[0]),
                segment_count=len(result[1]),
            )
            # Update progress after successful transcription
            if progress_callback:
                async with lock:
                    completed_count += 1
                    await progress_callback(completed_count, total_chunks)
            return result

    # Process in order but allow concurrency
    tasks = [process_chunk(chunk) for chunk in chunks]
    results = await asyncio.gather(*tasks)

    return list(results)


def _merge_transcription_results(
    chunk_results: list[tuple[str, list[dict], str]],
) -> TranscriptionResult:
    """
    Merge results from multiple chunks into single result.

    Args:
        chunk_results: List of (text, segments, language) tuples

    Returns:
        Unified TranscriptionResult
    """
    all_text_parts: list[str] = []
    all_segments: list[WhisperSegment] = []
    language = "unknown"

    for text, segments, lang in chunk_results:
        if text:
            all_text_parts.append(text.strip())
        for seg in segments:
            all_segments.append(WhisperSegment(**seg))
        if language == "unknown" and lang and lang != "unknown":
            language = lang

    merged_text = " ".join(all_text_parts)

    logger.info(
        "transcription_merged",
        num_chunks=len(chunk_results),
        total_text_length=len(merged_text),
        total_segments=len(all_segments),
        language=language,
    )

    return TranscriptionResult(
        text=merged_text,
        segments=all_segments,
        language=language,
    )
