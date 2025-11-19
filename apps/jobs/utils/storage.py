"""Tigris (S3-compatible) storage utilities."""

from typing import Any

import aiofiles
import aioboto3
from botocore.config import Config

from config import JobRunnerConfig


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


async def download_from_tigris(
    config: JobRunnerConfig,
    bucket: str,
    object_key: str,
    destination_path: str,
) -> None:
    """
    Download a file from Tigris to local filesystem.

    Args:
        config: Job runner configuration
        bucket: S3 bucket name
        object_key: S3 object key
        destination_path: Local file path to save to

    Raises:
        Exception: If download fails or no response body
    """
    session = create_tigris_client(config)

    async with session.client(
        "s3",
        endpoint_url=str(config.TIGRIS_ENDPOINT),
        config=Config(s3={"addressing_style": "path"}),
    ) as s3:
        response = await s3.get_object(Bucket=bucket, Key=object_key)

        if "Body" not in response:
            raise RuntimeError("No response body from Tigris")

        # Stream the response body to file
        # Note: aioboto3's StreamingBody.read() doesn't accept size parameter
        async with response["Body"] as stream:
            async with aiofiles.open(destination_path, "wb") as f:
                data = await stream.read()
                await f.write(data)


async def upload_to_tigris(
    config: JobRunnerConfig,
    bucket: str,
    object_key: str,
    source_path: str,
    content_type: str = "application/octet-stream",
) -> None:
    """
    Upload a file from local filesystem to Tigris.

    Args:
        config: Job runner configuration
        bucket: S3 bucket name
        object_key: S3 object key
        source_path: Local file path to upload
        content_type: MIME type of the file

    Raises:
        Exception: If upload fails
    """
    session = create_tigris_client(config)

    async with session.client(
        "s3",
        endpoint_url=str(config.TIGRIS_ENDPOINT),
        config=Config(s3={"addressing_style": "path"}),
    ) as s3:
        async with aiofiles.open(source_path, "rb") as f:
            file_data = await f.read()

        await s3.put_object(
            Bucket=bucket,
            Key=object_key,
            Body=file_data,
            ContentType=content_type,
        )
