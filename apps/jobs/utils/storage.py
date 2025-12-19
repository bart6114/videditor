"""Tigris (S3-compatible) storage utilities."""

import asyncio
from collections.abc import Awaitable, Callable

import aiofiles
import aioboto3
import structlog
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError as BotoClientError

from config import JobRunnerConfig

logger = structlog.get_logger()

# Exceptions that warrant a retry (transient network/service issues)
RETRYABLE_EXCEPTIONS = (
    BotoCoreError,
    BotoClientError,
    TimeoutError,
    ConnectionError,
    OSError,
)


def create_tigris_client(config: JobRunnerConfig) -> aioboto3.Session:
    """
    Create a Tigris S3 client session.

    Args:
        config: Job runner configuration

    Returns:
        aioboto3 Session configured for Tigris
    """
    return aioboto3.Session(
        aws_access_key_id=config.TIGRIS_ACCESS_KEY_ID,
        aws_secret_access_key=config.TIGRIS_SECRET_ACCESS_KEY,
        region_name=config.TIGRIS_REGION,
    )


def _create_s3_config(connect_timeout: float, read_timeout: float) -> Config:
    """Create botocore Config with timeouts for S3 operations."""
    return Config(
        s3={"addressing_style": "path"},
        connect_timeout=connect_timeout,
        read_timeout=read_timeout,
        retries={"max_attempts": 0},  # We handle retries ourselves
    )


async def _with_retry(
    operation: Callable[[], Awaitable[None]],
    operation_name: str,
    max_retries: int,
    base_delay: float,
    logger_ctx: dict,
) -> None:
    """
    Execute async operation with exponential backoff retry.

    Follows the pattern from transcription.py _transcribe_chunk_with_retry.
    """
    for attempt in range(max_retries):
        try:
            await operation()
            return
        except RETRYABLE_EXCEPTIONS as e:
            if attempt < max_retries - 1:
                delay = base_delay * (2**attempt)  # 1s, 2s, 4s
                logger.warning(
                    f"{operation_name}_retry",
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    delay_seconds=delay,
                    error=str(e),
                    error_type=type(e).__name__,
                    **logger_ctx,
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    f"{operation_name}_failed",
                    max_retries=max_retries,
                    error=str(e),
                    error_type=type(e).__name__,
                    **logger_ctx,
                )
                raise


async def download_from_tigris(
    config: JobRunnerConfig,
    bucket: str,
    object_key: str,
    destination_path: str,
) -> None:
    """
    Download a file from Tigris to local filesystem with streaming and retries.

    Uses chunked streaming to avoid loading entire file into memory.
    Implements exponential backoff retry for transient network failures.

    Args:
        config: Job runner configuration
        bucket: S3 bucket name
        object_key: S3 object key
        destination_path: Local file path to save to

    Raises:
        Exception: If download fails after all retries
    """
    chunk_size = config.TIGRIS_DOWNLOAD_CHUNK_SIZE
    logger_ctx = {
        "bucket": bucket,
        "object_key": object_key,
        "destination_path": destination_path,
    }

    async def _do_download() -> None:
        session = create_tigris_client(config)

        async with session.client(
            "s3",
            endpoint_url=str(config.TIGRIS_ENDPOINT),
            config=_create_s3_config(
                connect_timeout=config.TIGRIS_CONNECT_TIMEOUT,
                read_timeout=config.TIGRIS_READ_TIMEOUT,
            ),
        ) as s3:
            response = await s3.get_object(Bucket=bucket, Key=object_key)

            if "Body" not in response:
                raise RuntimeError("No response body from Tigris")

            content_length = response.get("ContentLength", 0)
            logger.info(
                "tigris_download_started",
                content_length_mb=round(content_length / (1024 * 1024), 2),
                chunk_size=chunk_size,
                **logger_ctx,
            )

            # Stream response body to file in chunks to avoid loading into memory
            bytes_written = 0
            async with response["Body"] as stream:
                async with aiofiles.open(destination_path, "wb") as f:
                    async for chunk in stream.content.iter_chunked(chunk_size):
                        await f.write(chunk)
                        bytes_written += len(chunk)

            logger.info(
                "tigris_download_completed",
                bytes_written_mb=round(bytes_written / (1024 * 1024), 2),
                **logger_ctx,
            )

    await _with_retry(
        operation=_do_download,
        operation_name="tigris_download",
        max_retries=config.TIGRIS_MAX_RETRIES,
        base_delay=config.TIGRIS_RETRY_BASE_DELAY,
        logger_ctx=logger_ctx,
    )


async def upload_to_tigris(
    config: JobRunnerConfig,
    bucket: str,
    object_key: str,
    source_path: str,
    content_type: str = "application/octet-stream",
) -> None:
    """
    Upload a file from local filesystem to Tigris with retries.

    Implements exponential backoff retry for transient network failures.

    Args:
        config: Job runner configuration
        bucket: S3 bucket name
        object_key: S3 object key
        source_path: Local file path to upload
        content_type: MIME type of the file

    Raises:
        Exception: If upload fails after all retries
    """
    logger_ctx = {
        "bucket": bucket,
        "object_key": object_key,
        "source_path": source_path,
        "content_type": content_type,
    }

    async def _do_upload() -> None:
        session = create_tigris_client(config)

        async with session.client(
            "s3",
            endpoint_url=str(config.TIGRIS_ENDPOINT),
            config=_create_s3_config(
                connect_timeout=config.TIGRIS_CONNECT_TIMEOUT,
                read_timeout=config.TIGRIS_READ_TIMEOUT,
            ),
        ) as s3:
            async with aiofiles.open(source_path, "rb") as f:
                file_data = await f.read()

            file_size = len(file_data)
            logger.info(
                "tigris_upload_started",
                file_size_mb=round(file_size / (1024 * 1024), 2),
                **logger_ctx,
            )

            await s3.put_object(
                Bucket=bucket,
                Key=object_key,
                Body=file_data,
                ContentType=content_type,
            )

            logger.info("tigris_upload_completed", **logger_ctx)

    await _with_retry(
        operation=_do_upload,
        operation_name="tigris_upload",
        max_retries=config.TIGRIS_MAX_RETRIES,
        base_delay=config.TIGRIS_RETRY_BASE_DELAY,
        logger_ctx=logger_ctx,
    )


async def generate_presigned_url(
    config: JobRunnerConfig,
    bucket: str,
    object_key: str,
    expires_in: int = 3600,
) -> str:
    """
    Generate a presigned URL for an S3 object.

    Used by Instagram publishing to provide a publicly accessible URL
    for the video file that Instagram can fetch.

    Args:
        config: Job runner configuration
        bucket: S3 bucket name
        object_key: S3 object key
        expires_in: URL expiration time in seconds (default: 1 hour)

    Returns:
        Presigned URL string

    Raises:
        Exception: If URL generation fails
    """
    session = create_tigris_client(config)

    async with session.client(
        "s3",
        endpoint_url=str(config.TIGRIS_ENDPOINT),
        config=Config(s3={"addressing_style": "path"}),
    ) as s3:
        url = await s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": object_key},
            ExpiresIn=expires_in,
        )
        return url
