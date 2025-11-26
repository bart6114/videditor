"""Video file cache for short processing jobs.

Caches source videos locally to avoid redundant downloads when
processing multiple shorts from the same project.
"""

import asyncio
import fcntl
import os
import shutil
import time
from pathlib import Path
from typing import Awaitable, Callable

import structlog

logger = structlog.get_logger(__name__)


class VideoCache:
    """
    Local file cache for source videos.

    Uses file locking to prevent concurrent downloads of the same file.
    Files are cached at: {cache_dir}/{project_id}/{sanitized_video_key}
    """

    def __init__(self, cache_dir: str, ttl_seconds: int):
        """
        Initialize the video cache.

        Args:
            cache_dir: Directory to store cached files
            ttl_seconds: Time-to-live in seconds before files expire
        """
        self.cache_dir = Path(cache_dir)
        self.ttl_seconds = ttl_seconds

    def _get_cache_path(self, project_id: str, video_key: str) -> Path:
        """
        Get cache path for a video.

        Args:
            project_id: Project ID
            video_key: S3 object key for the video

        Returns:
            Path where the cached file should be stored
        """
        # Sanitize video_key (replace / with _ to flatten path)
        safe_key = video_key.replace("/", "_")
        return self.cache_dir / project_id / safe_key

    async def get_or_download(
        self,
        project_id: str,
        video_key: str,
        download_fn: Callable[[str], Awaitable[None]],
    ) -> Path:
        """
        Get cached video path, downloading if not cached.

        Uses file locking to prevent concurrent downloads of the same file.
        If multiple jobs request the same video simultaneously, one will
        download while others wait, then all use the cached file.

        Args:
            project_id: Project ID
            video_key: S3 object key for the video
            download_fn: Async function that downloads to a given path

        Returns:
            Path to the cached video file
        """
        cache_path = self._get_cache_path(project_id, video_key)
        lock_path = cache_path.with_suffix(cache_path.suffix + ".lock")

        # Ensure directory exists
        cache_path.parent.mkdir(parents=True, exist_ok=True)

        # Acquire exclusive lock (blocks if another job is downloading)
        lock_fd = os.open(str(lock_path), os.O_CREAT | os.O_RDWR)
        try:
            logger.debug(
                "Acquiring cache lock",
                project_id=project_id,
                video_key=video_key,
            )
            # Run blocking flock in thread pool to avoid blocking the event loop
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, fcntl.flock, lock_fd, fcntl.LOCK_EX)

            # Check if file exists and is fresh
            # (another job may have downloaded while we waited for lock)
            if cache_path.exists():
                age = time.time() - cache_path.stat().st_mtime
                if age < self.ttl_seconds:
                    logger.info(
                        "Cache hit",
                        project_id=project_id,
                        video_key=video_key,
                        age_seconds=int(age),
                    )
                    return cache_path
                else:
                    logger.debug(
                        "Cache expired",
                        project_id=project_id,
                        video_key=video_key,
                        age_seconds=int(age),
                    )

            # Download to temp file, then rename (atomic on same filesystem)
            temp_path = cache_path.with_suffix(cache_path.suffix + ".tmp")
            logger.info(
                "Cache miss, downloading",
                project_id=project_id,
                video_key=video_key,
            )

            try:
                await download_fn(str(temp_path))
                # Atomic rename
                temp_path.rename(cache_path)
                logger.info(
                    "Downloaded and cached",
                    project_id=project_id,
                    video_key=video_key,
                    size_mb=round(cache_path.stat().st_size / (1024 * 1024), 2),
                )
            except Exception:
                # Clean up partial download
                if temp_path.exists():
                    temp_path.unlink(missing_ok=True)
                raise

            return cache_path
        finally:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            os.close(lock_fd)

    async def cleanup_expired(self) -> int:
        """
        Delete files older than TTL.

        Also cleans up stale lock and temp files.

        Returns:
            Number of files deleted
        """
        deleted = 0
        if not self.cache_dir.exists():
            return 0

        cutoff = time.time() - self.ttl_seconds

        try:
            for project_dir in self.cache_dir.iterdir():
                if not project_dir.is_dir():
                    continue

                for file_path in project_dir.iterdir():
                    try:
                        mtime = file_path.stat().st_mtime
                        if file_path.suffix in (".lock", ".tmp"):
                            # Clean up stale lock/temp files
                            if mtime < cutoff:
                                file_path.unlink(missing_ok=True)
                                deleted += 1
                        elif mtime < cutoff:
                            file_path.unlink(missing_ok=True)
                            deleted += 1
                            logger.debug(
                                "Cleaned up expired cache file",
                                path=str(file_path),
                            )
                    except OSError:
                        # File may have been deleted by another process
                        pass

                # Remove empty project directories
                try:
                    if project_dir.exists() and not any(project_dir.iterdir()):
                        project_dir.rmdir()
                except OSError:
                    pass
        except OSError as e:
            logger.warning("Error during cache cleanup", error=str(e))

        if deleted > 0:
            logger.info("Cache cleanup completed", deleted_count=deleted)

        return deleted

    def clear_all(self) -> None:
        """
        Clear entire cache.

        Used on worker startup to ensure clean slate.
        """
        if self.cache_dir.exists():
            shutil.rmtree(self.cache_dir, ignore_errors=True)
            logger.info("Cleared video cache", cache_dir=str(self.cache_dir))

        self.cache_dir.mkdir(parents=True, exist_ok=True)


# Global cache instance, initialized by worker
_video_cache: VideoCache | None = None


def init_video_cache(cache_dir: str, ttl_seconds: int) -> VideoCache:
    """
    Initialize the global video cache instance.

    Args:
        cache_dir: Directory to store cached files
        ttl_seconds: Time-to-live in seconds

    Returns:
        The initialized VideoCache instance
    """
    global _video_cache
    _video_cache = VideoCache(cache_dir, ttl_seconds)
    return _video_cache


def get_video_cache() -> VideoCache | None:
    """Get the global video cache instance."""
    return _video_cache


async def run_cleanup_loop(cache: VideoCache, interval_seconds: int = 300) -> None:
    """
    Background task that runs cleanup periodically.

    Args:
        cache: VideoCache instance to clean
        interval_seconds: Interval between cleanup runs (default 5 min)
    """
    logger.info(
        "Starting cache cleanup loop",
        interval_seconds=interval_seconds,
        ttl_seconds=cache.ttl_seconds,
    )

    while True:
        await asyncio.sleep(interval_seconds)
        try:
            await cache.cleanup_expired()
        except Exception as e:
            logger.warning("Cache cleanup error", error=str(e))
