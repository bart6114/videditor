"""YouTube API utilities for video uploads."""

import asyncio
import os
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# YouTube API configuration
YOUTUBE_API_SERVICE_NAME = "youtube"
YOUTUBE_API_VERSION = "v3"
YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload"

# OAuth configuration - must match frontend
YOUTUBE_CLIENT_ID = os.environ.get("YOUTUBE_CLIENT_ID", "")
YOUTUBE_CLIENT_SECRET = os.environ.get("YOUTUBE_CLIENT_SECRET", "")
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


async def refresh_access_token(refresh_token: str) -> dict[str, Any]:
    """
    Refresh an expired YouTube access token.

    Args:
        refresh_token: The refresh token from OAuth

    Returns:
        Dictionary with:
            - access_token: New access token
            - expires_at: Datetime when token expires

    Raises:
        Exception: If token refresh fails
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": YOUTUBE_CLIENT_ID,
                "client_secret": YOUTUBE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )

        if response.status_code != 200:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            error_msg = error_data.get("error_description", error_data.get("error", response.text))
            raise Exception(f"Failed to refresh token: {error_msg}")

        data = response.json()
        access_token = data["access_token"]
        expires_in = data.get("expires_in", 3600)  # Default 1 hour

        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        return {
            "access_token": access_token,
            "expires_at": expires_at,
        }


async def upload_to_youtube(
    access_token: str,
    video_path: str,
    title: str,
    description: str = "",
    privacy_status: str = "public",
    category_id: str = "22",  # People & Blogs category
    tags: list[str] | None = None,
) -> dict[str, str]:
    """
    Upload a video to YouTube.

    Args:
        access_token: Valid YouTube access token
        video_path: Path to the video file
        title: Video title (max 100 chars)
        description: Video description (max 5000 chars)
        privacy_status: "public", "private", or "unlisted"
        category_id: YouTube category ID (default: "22" for People & Blogs)
        tags: Optional list of video tags

    Returns:
        Dictionary with:
            - videoId: YouTube video ID
            - url: Full YouTube URL

    Raises:
        Exception: If upload fails
    """
    # YouTube API calls are blocking, run in executor
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        _upload_video_sync,
        access_token,
        video_path,
        title,
        description,
        privacy_status,
        category_id,
        tags or [],
    )
    return result


def _upload_video_sync(
    access_token: str,
    video_path: str,
    title: str,
    description: str,
    privacy_status: str,
    category_id: str,
    tags: list[str],
) -> dict[str, str]:
    """
    Synchronous video upload implementation.

    This runs in a thread executor since googleapiclient is synchronous.
    """
    # Create credentials from access token
    credentials = Credentials(token=access_token)

    # Build the YouTube API client
    youtube = build(
        YOUTUBE_API_SERVICE_NAME,
        YOUTUBE_API_VERSION,
        credentials=credentials,
        cache_discovery=False,
    )

    # Truncate title/description to YouTube limits
    title = title[:100] if len(title) > 100 else title
    description = description[:5000] if len(description) > 5000 else description

    # Prepare video metadata
    body = {
        "snippet": {
            "title": title,
            "description": description,
            "categoryId": category_id,
        },
        "status": {
            "privacyStatus": privacy_status,
            "selfDeclaredMadeForKids": False,
        },
    }

    if tags:
        body["snippet"]["tags"] = tags[:500]  # YouTube limits to 500 tags

    # Prepare video file for upload
    media = MediaFileUpload(
        video_path,
        chunksize=1024 * 1024,  # 1MB chunks
        resumable=True,
        mimetype="video/mp4",
    )

    # Execute the upload
    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    response = None
    while response is None:
        status, response = request.next_chunk()

    video_id = response["id"]
    video_url = f"https://youtube.com/shorts/{video_id}"

    return {
        "videoId": video_id,
        "url": video_url,
    }
