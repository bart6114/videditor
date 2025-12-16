"""FFmpeg utilities for video processing."""

import asyncio
import json
import structlog
from pathlib import Path
from typing import Optional

logger = structlog.get_logger()


async def get_video_duration(video_path: str) -> float:
    """
    Get the duration of a video file in seconds.

    Args:
        video_path: Path to the video file

    Returns:
        Duration in seconds

    Raises:
        RuntimeError: If ffprobe command fails
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "json",
            video_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            raise RuntimeError(f"ffprobe failed: {error_msg}")

        result = json.loads(stdout.decode())
        duration = float(result["format"]["duration"])

        logger.info("got_video_duration", duration=duration, path=video_path)
        return duration

    except Exception as e:
        logger.error("failed_to_get_duration", error=str(e), path=video_path)
        raise


async def extract_thumbnail(
    video_path: str,
    output_path: str,
    timestamp: Optional[float] = None,
    width: int = 640,
    height: int = 360,
    quality: int = 5,
) -> None:
    """
    Extract a thumbnail frame from a video.

    Args:
        video_path: Path to the input video file
        output_path: Path where the thumbnail should be saved
        timestamp: Time in seconds to extract the frame (default: 25% into video)
        width: Thumbnail width in pixels (default: 640)
        height: Thumbnail height in pixels (default: 360)
        quality: JPEG quality (2-31, lower is better quality, default: 5)

    Raises:
        RuntimeError: If ffmpeg command fails
    """
    try:
        # If no timestamp provided, extract at 25% into the video
        if timestamp is None:
            duration = await get_video_duration(video_path)
            timestamp = duration * 0.25

        # Ensure output directory exists
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        # Build ffmpeg command
        # -ss: seek to timestamp
        # -i: input file
        # -vframes 1: extract one frame
        # -vf scale: resize to target dimensions
        # -q:v: JPEG quality (2-31, lower is better)
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-ss", str(timestamp),
            "-i", video_path,
            "-vframes", "1",
            "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,format=yuvj420p",
            "-q:v", str(quality),
            "-y",  # Overwrite output file
            output_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            raise RuntimeError(f"ffmpeg failed: {error_msg}")

        logger.info(
            "extracted_thumbnail",
            video_path=video_path,
            output_path=output_path,
            timestamp=timestamp,
            width=width,
            height=height,
        )

    except Exception as e:
        logger.error(
            "failed_to_extract_thumbnail",
            error=str(e),
            video_path=video_path,
            output_path=output_path,
        )
        raise


async def extract_audio(
    video_path: str,
    output_path: str,
    bitrate: str = "64k",
    sample_rate: int = 16000,
    channels: int = 1,
) -> float:
    """
    Extract audio from video file, optimized for transcription.

    Args:
        video_path: Path to input video
        output_path: Path for output audio file (should be .mp3)
        bitrate: Audio bitrate (default: 64k for speech)
        sample_rate: Sample rate in Hz (default: 16000, Whisper's native rate)
        channels: Number of audio channels (default: 1 for mono)

    Returns:
        Duration of the audio in seconds

    Raises:
        RuntimeError: If ffmpeg command fails
    """
    try:
        # Ensure output directory exists
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        # Build ffmpeg command
        # -vn: disable video
        # -ar: sample rate
        # -ac: audio channels
        # -b:a: audio bitrate
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-i", video_path,
            "-vn",  # No video
            "-ar", str(sample_rate),
            "-ac", str(channels),
            "-b:a", bitrate,
            "-y",  # Overwrite output file
            output_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            raise RuntimeError(f"ffmpeg audio extraction failed: {error_msg}")

        # Get duration of extracted audio
        duration = await get_video_duration(output_path)

        logger.info(
            "extracted_audio",
            video_path=video_path,
            output_path=output_path,
            duration=duration,
            bitrate=bitrate,
            sample_rate=sample_rate,
        )

        return duration

    except Exception as e:
        logger.error(
            "failed_to_extract_audio",
            error=str(e),
            video_path=video_path,
            output_path=output_path,
        )
        raise


async def split_audio_chunk(
    audio_path: str,
    output_path: str,
    start_time: float,
    duration: float,
) -> None:
    """
    Extract a chunk from an audio file using stream copy (no re-encoding).

    Args:
        audio_path: Path to input audio file
        output_path: Path for output chunk file
        start_time: Start time in seconds
        duration: Duration in seconds

    Raises:
        RuntimeError: If ffmpeg command fails
    """
    try:
        # Ensure output directory exists
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        # Build ffmpeg command
        # -ss: seek to start time
        # -t: duration
        # -c copy: stream copy (no re-encoding, fast)
        # -reset_timestamps 1: required for OpenAI API to read duration correctly from chunks
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-ss", str(start_time),
            "-t", str(duration),
            "-i", audio_path,
            "-c", "copy",
            "-reset_timestamps", "1",
            "-y",  # Overwrite output file
            output_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            raise RuntimeError(f"ffmpeg audio split failed: {error_msg}")

        logger.info(
            "split_audio_chunk",
            audio_path=audio_path,
            output_path=output_path,
            start_time=start_time,
            duration=duration,
        )

    except Exception as e:
        logger.error(
            "failed_to_split_audio_chunk",
            error=str(e),
            audio_path=audio_path,
            output_path=output_path,
        )
        raise


async def extract_clip(
    video_path: str,
    output_path: str,
    start_time: float,
    end_time: float,
) -> None:
    """
    Extract a clip from a video with frame-accurate cutting via re-encoding.

    Args:
        video_path: Path to the input video file
        output_path: Path where the clip should be saved
        start_time: Start time in seconds
        end_time: End time in seconds

    Raises:
        RuntimeError: If ffmpeg command fails
    """
    try:
        # Ensure output directory exists
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        # Calculate duration for frame-accurate cutting
        duration = end_time - start_time

        # Build ffmpeg command with re-encoding for frame-accurate cuts
        # -ss: seek to start time (before -i for fast input seeking)
        # -i: input file
        # -t: duration (ensures exact clip length)
        # -c:v libx264: re-encode video for frame-accurate cutting
        # -preset fast: good speed/compression balance
        # -crf 23: visually lossless quality
        # -c:a aac: re-encode audio
        # -b:a 128k: standard web audio quality
        # -movflags +faststart: optimize for web streaming
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-ss", str(start_time),
            "-i", video_path,
            "-t", str(duration),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            "-y",  # Overwrite output file
            output_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            raise RuntimeError(f"ffmpeg failed: {error_msg}")

        logger.info(
            "extracted_clip",
            video_path=video_path,
            output_path=output_path,
            start_time=start_time,
            end_time=end_time,
            duration=end_time - start_time,
        )

    except Exception as e:
        logger.error(
            "failed_to_extract_clip",
            error=str(e),
            video_path=video_path,
            output_path=output_path,
            start_time=start_time,
            end_time=end_time,
        )
        raise
