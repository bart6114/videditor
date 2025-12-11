"""Video transcription using Deepgram API."""

import asyncio
import os
import tempfile
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import structlog
from deepgram import DeepgramClient

from models import TranscriptionResult, TranscriptWord
from utils.analytics import track_deepgram_transcription
from utils.ffmpeg import extract_audio, split_audio_chunk

logger = structlog.get_logger()

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
    model: str = "nova-3",
) -> TranscriptionResult:
    """
    Transcribe a video file using Deepgram API with diarization and word-level timestamps.

    Args:
        video_path: Path to the video file
        api_key: Deepgram API key
        chunk_duration_seconds: Max duration per chunk in seconds (default 360 = 6 min)
        audio_bitrate: Audio bitrate for extraction (e.g., "64k")
        max_concurrent: Max concurrent API calls (default 5)
        progress_callback: Optional async callback(current, total) for progress updates
        trace_id: Optional trace ID for analytics
        model: Deepgram model to use (default "nova-3")

    Returns:
        TranscriptionResult with text, words (with timestamps + speakers), and detected language

    Note:
        Videos longer than chunk_duration_seconds are split into chunks that
        are transcribed concurrently, then merged with proper timestamp offsets.
    """
    with tempfile.TemporaryDirectory(prefix="deepgram-") as temp_dir:
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

        # 3. Initialize Deepgram client
        client = DeepgramClient(api_key=api_key)

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
            text, words, language = await _transcribe_chunk_with_retry(
                client, audio_path, None, model=model, trace_id=trace_id
            )
            if progress_callback:
                await progress_callback(1, 1)
            return TranscriptionResult(
                text=text,
                words=[TranscriptWord(**word) for word in words],
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
                client, chunks, max_concurrent, progress_callback, model=model, trace_id=trace_id
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
    client: DeepgramClient,
    audio_path: str,
    chunk_info: AudioChunk | None = None,
    model: str = "nova-3",
    trace_id: str | None = None,
) -> tuple[str, list[dict], str]:
    """
    Transcribe a single audio chunk via Deepgram API with diarization.

    Args:
        client: Deepgram client
        audio_path: Path to audio chunk
        chunk_info: Optional chunk metadata for timestamp offset
        model: Deepgram model to use
        trace_id: Optional trace ID for analytics

    Returns:
        Tuple of (text, words, language)
    """
    start_time = time.time()

    with open(audio_path, "rb") as audio_file:
        buffer = audio_file.read()

    # Deepgram SDK v5 uses keyword arguments directly
    # Run in executor since SDK v5 is sync
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.listen.rest.v("1").transcribe_file(
            source={"buffer": buffer},
            model=model,
            diarize=True,  # Speaker detection
            punctuate=True,  # Add punctuation
            smart_format=True,  # Smart formatting
        ),
    )

    latency_ms = (time.time() - start_time) * 1000

    # Extract transcript and words from response
    channel = response.results.channels[0]
    alternative = channel.alternatives[0]
    transcript = alternative.transcript
    language = getattr(channel, "detected_language", None) or "unknown"

    # Extract and offset timestamps if this is a chunk
    words: list[dict] = []
    offset = chunk_info.start_time if chunk_info else 0.0

    for word in alternative.words:
        words.append(
            {
                "start": word.start + offset,
                "end": word.end + offset,
                "text": word.word,
                "speaker": str(word.speaker) if getattr(word, "speaker", None) is not None else None,
                "confidence": getattr(word, "confidence", None),
            }
        )

    # Track in PostHog
    chunk_duration = chunk_info.duration if chunk_info else 0.0
    track_deepgram_transcription(
        trace_id=trace_id or "unknown",
        model=model,
        duration_seconds=chunk_duration,
        word_count=len(words),
        latency_ms=latency_ms,
        success=True,
    )

    return transcript, words, language


async def _transcribe_chunk_with_retry(
    client: DeepgramClient,
    audio_path: str,
    chunk_info: AudioChunk | None,
    model: str = "nova-3",
    max_retries: int = 3,
    retry_base_delay: float = 1.0,
    trace_id: str | None = None,
) -> tuple[str, list[dict], str]:
    """
    Transcribe chunk with exponential backoff retry.

    Handles:
    - Rate limits - exponential backoff
    - Server errors (5xx) - retry
    - Network errors - retry

    Args:
        client: Deepgram client
        audio_path: Path to audio chunk
        chunk_info: Optional chunk metadata
        model: Deepgram model to use
        max_retries: Maximum number of retries
        retry_base_delay: Base delay for exponential backoff
        trace_id: Optional trace ID for analytics

    Returns:
        Tuple of (text, words, language)
    """
    last_error: Exception | None = None

    for attempt in range(max_retries):
        try:
            return await _transcribe_chunk(client, audio_path, chunk_info, model, trace_id)
        except Exception as e:
            last_error = e
            error_msg = str(e).lower()

            # Check for rate limit or server errors
            is_rate_limit = "rate" in error_msg or "429" in error_msg
            is_server_error = "500" in error_msg or "502" in error_msg or "503" in error_msg

            if is_rate_limit or is_server_error or attempt < max_retries - 1:
                delay = retry_base_delay * (2**attempt)
                logger.warning(
                    "transcription_error_retry",
                    attempt=attempt + 1,
                    delay_seconds=delay,
                    chunk_index=chunk_info.index if chunk_info else 0,
                    error=str(e),
                    is_rate_limit=is_rate_limit,
                    is_server_error=is_server_error,
                )

                # Track failed attempt
                track_deepgram_transcription(
                    trace_id=trace_id or "unknown",
                    model=model,
                    duration_seconds=chunk_info.duration if chunk_info else 0.0,
                    word_count=0,
                    latency_ms=0,
                    success=False,
                    error=str(e),
                )

                await asyncio.sleep(delay)
            else:
                raise

    if last_error:
        raise last_error
    raise RuntimeError("Transcription failed after retries")


async def _transcribe_all_chunks(
    client: DeepgramClient,
    chunks: list[AudioChunk],
    max_concurrent: int = 5,
    progress_callback: Callable[[int, int], Awaitable[None]] | None = None,
    model: str = "nova-3",
    trace_id: str | None = None,
) -> list[tuple[str, list[dict], str]]:
    """
    Transcribe multiple chunks with controlled concurrency.

    Args:
        client: Deepgram client
        chunks: List of audio chunks to transcribe
        max_concurrent: Maximum concurrent API calls
        progress_callback: Optional async callback(current, total) for progress updates
        model: Deepgram model to use
        trace_id: Optional trace ID for analytics

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
            result = await _transcribe_chunk_with_retry(
                client, chunk.path, chunk, model=model, trace_id=trace_id
            )
            logger.info(
                "chunk_transcribed",
                chunk_index=chunk.index,
                text_length=len(result[0]),
                word_count=len(result[1]),
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
        chunk_results: List of (text, words, language) tuples

    Returns:
        Unified TranscriptionResult
    """
    all_text_parts: list[str] = []
    all_words: list[TranscriptWord] = []
    language = "unknown"

    for text, words, lang in chunk_results:
        if text:
            all_text_parts.append(text.strip())
        for word in words:
            all_words.append(TranscriptWord(**word))
        if language == "unknown" and lang and lang != "unknown":
            language = lang

    merged_text = " ".join(all_text_parts)

    logger.info(
        "transcription_merged",
        num_chunks=len(chunk_results),
        total_text_length=len(merged_text),
        total_words=len(all_words),
        language=language,
    )

    return TranscriptionResult(
        text=merged_text,
        words=all_words,
        language=language,
    )
