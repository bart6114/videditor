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
            "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
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
