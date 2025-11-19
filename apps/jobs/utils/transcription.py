"""Video transcription using faster-whisper."""

import asyncio
from functools import partial
from typing import Any

from faster_whisper import WhisperModel

from models import TranscriptionResult, WhisperSegment


async def transcribe_video(video_path: str, model_size: str = "small") -> TranscriptionResult:
    """
    Transcribe a video file using faster-whisper.

    Args:
        video_path: Path to the video file
        model_size: Whisper model size (tiny, base, small, medium, large-v2, large-v3)
                   Default is "small" (~460MB, balanced speed/accuracy)

    Returns:
        TranscriptionResult with text, segments, and detected language

    Note:
        This function runs the CPU-bound transcription in a thread pool
        to avoid blocking the async event loop.
    """
    # Run transcription in thread pool (CPU-bound operation)
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        partial(_transcribe_sync, video_path, model_size),
    )
    return result


def _transcribe_sync(video_path: str, model_size: str) -> TranscriptionResult:
    """
    Synchronous transcription worker.

    Args:
        video_path: Path to the video file
        model_size: Whisper model size

    Returns:
        TranscriptionResult with text, segments, and detected language
    """
    # Initialize faster-whisper model
    # Model will be auto-downloaded to ~/.cache/huggingface/hub/ if not present
    # Using CPU inference by default. For GPU, pass device="cuda"
    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    # Transcribe the video
    # beam_size controls accuracy vs speed tradeoff (5 is good balance)
    # word_timestamps=True provides word-level timing
    segments_iter, info = model.transcribe(
        video_path,
        beam_size=5,
        word_timestamps=True,
        language=None,  # Auto-detect language
    )

    # Collect all segments
    segments: list[WhisperSegment] = []
    full_text_parts: list[str] = []

    for segment in segments_iter:
        segments.append(
            WhisperSegment(
                start=segment.start,
                end=segment.end,
                text=segment.text.strip(),
            )
        )
        full_text_parts.append(segment.text.strip())

    # Combine all text
    full_text = " ".join(full_text_parts).strip()

    # Get detected language
    language = info.language if hasattr(info, "language") else "unknown"

    return TranscriptionResult(
        text=full_text,
        segments=segments,
        language=language,
    )
