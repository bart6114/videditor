"""Instagram API utilities for Reels uploads."""

import asyncio
import os
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

# Instagram API configuration
INSTAGRAM_GRAPH_API_BASE = "https://graph.instagram.com"

# OAuth configuration
INSTAGRAM_APP_ID = os.environ.get("INSTAGRAM_APP_ID", "")
INSTAGRAM_APP_SECRET = os.environ.get("INSTAGRAM_APP_SECRET", "")


async def refresh_access_token(current_token: str) -> dict[str, Any]:
    """
    Refresh Instagram long-lived token.

    Instagram tokens can be refreshed when they have more than 24 hours left.
    Long-lived tokens are valid for 60 days and can be refreshed.

    Args:
        current_token: Current access token

    Returns:
        Dictionary with access_token and expires_at

    Raises:
        Exception: If token refresh fails
    """
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
        response = await client.get(
            f"{INSTAGRAM_GRAPH_API_BASE}/refresh_access_token",
            params={
                "grant_type": "ig_refresh_token",
                "access_token": current_token,
            },
        )

        if response.status_code != 200:
            error_data = response.json() if "application/json" in response.headers.get("content-type", "") else {}
            error_msg = error_data.get("error", {}).get("message", response.text)
            raise Exception(f"Failed to refresh token: {error_msg}")

        data = response.json()
        expires_in = data.get("expires_in", 5184000)  # Default 60 days
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        return {
            "access_token": data["access_token"],
            "expires_at": expires_at,
        }


async def create_media_container(
    access_token: str,
    user_id: str,
    video_url: str,
    caption: str = "",
) -> str:
    """
    Create a media container for a Reel.

    Instagram Content Publishing API requires:
    1. Create container with video URL (must be publicly accessible)
    2. Wait for processing
    3. Publish container

    Args:
        access_token: Valid Instagram access token
        user_id: Instagram user ID (channel_id from social account)
        video_url: Publicly accessible URL to the video file
        caption: Post caption (max 2200 characters)

    Returns:
        Container ID (creation_id)

    Raises:
        Exception: If container creation fails
    """
    async with httpx.AsyncClient(timeout=httpx.Timeout(20.0)) as client:
        response = await client.post(
            f"{INSTAGRAM_GRAPH_API_BASE}/{user_id}/media",
            data={
                "video_url": video_url,
                "caption": caption[:2200] if len(caption) > 2200 else caption,
                "media_type": "REELS",
                "access_token": access_token,
            },
        )

        if response.status_code != 200:
            error_data = response.json()
            error_msg = error_data.get("error", {}).get("message", "Unknown error")
            raise Exception(f"Failed to create container: {error_msg}")

        data = response.json()
        return data["id"]


async def check_container_status(
    access_token: str,
    container_id: str,
) -> tuple[str, str | None]:
    """
    Check the status of a media container.

    Args:
        access_token: Valid Instagram access token
        container_id: Container ID from create_media_container

    Returns:
        Tuple of (status, error_message)
        Status can be: IN_PROGRESS, FINISHED, ERROR

    Raises:
        Exception: If status check fails
    """
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
        response = await client.get(
            f"{INSTAGRAM_GRAPH_API_BASE}/{container_id}",
            params={
                "fields": "status_code,status",
                "access_token": access_token,
            },
        )

        if response.status_code != 200:
            error_data = response.json()
            error_msg = error_data.get("error", {}).get("message", "Unknown error")
            raise Exception(f"Failed to check status: {error_msg}")

        data = response.json()
        status = data.get("status_code", "IN_PROGRESS")
        error = data.get("status") if status == "ERROR" else None

        return status, error


async def get_media_permalink(access_token: str, media_id: str) -> str:
    """
    Fetch the permalink for a published media.

    Instagram media IDs are numeric but URLs use shortcodes, so we need to
    fetch the actual permalink from the API after publishing.

    Args:
        access_token: Valid Instagram access token
        media_id: Media ID from publish response

    Returns:
        Permalink URL (e.g., https://www.instagram.com/reel/CzXyAbCdEfG/)
    """
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
        response = await client.get(
            f"{INSTAGRAM_GRAPH_API_BASE}/{media_id}",
            params={
                "fields": "permalink",
                "access_token": access_token,
            },
        )

        if response.status_code != 200:
            # Fall back to constructed URL if permalink fetch fails
            return f"https://www.instagram.com/reel/{media_id}/"

        data = response.json()
        return data.get("permalink", f"https://www.instagram.com/reel/{media_id}/")


async def publish_container(
    access_token: str,
    user_id: str,
    container_id: str,
) -> dict[str, str]:
    """
    Publish a processed media container.

    Args:
        access_token: Valid Instagram access token
        user_id: Instagram user ID
        container_id: Container ID from create_media_container

    Returns:
        Dictionary with media_id and url

    Raises:
        Exception: If publishing fails
    """
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
        response = await client.post(
            f"{INSTAGRAM_GRAPH_API_BASE}/{user_id}/media_publish",
            data={
                "creation_id": container_id,
                "access_token": access_token,
            },
        )

        if response.status_code != 200:
            error_data = response.json()
            error_msg = error_data.get("error", {}).get("message", "Unknown error")
            raise Exception(f"Failed to publish: {error_msg}")

        data = response.json()
        media_id = data["id"]

        # Wait briefly for Instagram to finalize, then fetch the actual permalink
        # Instagram URLs use shortcodes (e.g., CzXyAbCdEfG), not numeric IDs
        await asyncio.sleep(2)
        permalink = await get_media_permalink(access_token, media_id)

        return {
            "mediaId": media_id,
            "url": permalink,
        }


async def upload_reel(
    access_token: str,
    user_id: str,
    video_url: str,
    caption: str = "",
    poll_interval: int = 5,
    max_wait: int = 300,
) -> dict[str, str]:
    """
    Full upload flow for Instagram Reels.

    1. Create media container
    2. Poll for processing completion
    3. Publish when ready

    Args:
        access_token: Valid Instagram access token
        user_id: Instagram user ID
        video_url: Publicly accessible URL to the video
        caption: Post caption (max 2200 chars)
        poll_interval: Seconds between status checks (default: 5)
        max_wait: Maximum seconds to wait for processing (default: 300)

    Returns:
        Dictionary with mediaId and url

    Raises:
        Exception: If any step fails or times out
    """
    # Step 1: Create container
    container_id = await create_media_container(
        access_token=access_token,
        user_id=user_id,
        video_url=video_url,
        caption=caption,
    )

    # Step 2: Poll for processing
    start_time = datetime.now(timezone.utc)
    while True:
        status, error = await check_container_status(access_token, container_id)

        if status == "FINISHED":
            break
        elif status == "ERROR":
            raise Exception(f"Instagram processing failed: {error}")

        elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
        if elapsed > max_wait:
            raise Exception(f"Instagram processing timeout after {max_wait} seconds")

        await asyncio.sleep(poll_interval)

    # Step 3: Publish
    result = await publish_container(
        access_token=access_token,
        user_id=user_id,
        container_id=container_id,
    )

    return result
