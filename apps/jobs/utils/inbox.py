"""Inbox notification utilities for creating user messages."""

import uuid
from typing import Optional

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from models import InboxMessage, InboxMessageType

logger = structlog.get_logger()


async def create_inbox_message(
    session: AsyncSession,
    user_id: str,
    message_type: InboxMessageType,
    title: str,
    body: str,
    action_url: Optional[str] = None,
    action_label: Optional[str] = None,
) -> InboxMessage:
    """
    Create an inbox message for a user.

    Args:
        session: Database session
        user_id: Clerk user ID to send message to
        message_type: Type of message (error, info, announcement)
        title: Short title shown in inbox dropdown
        body: Full message body shown in dialog
        action_url: Optional URL for action button
        action_label: Optional label for action button

    Returns:
        Created InboxMessage instance
    """
    message_id = f"msg_{uuid.uuid4()}"

    message = InboxMessage(
        id=message_id,
        user_id=user_id,
        type=message_type.value,
        title=title,
        body=body,
        action_url=action_url,
        action_label=action_label,
        is_read=False,
    )

    session.add(message)
    await session.flush()  # Flush to get any defaults applied

    logger.info(
        "Created inbox message",
        message_id=message_id,
        user_id=user_id,
        type=message_type.value,
        title=title,
    )

    return message


# Pre-built notification helpers
class Notifications:
    """Pre-built notification helpers for common events."""

    @staticmethod
    async def video_published_to_youtube(
        session: AsyncSession,
        user_id: str,
        project_title: str,
        youtube_url: str,
    ) -> InboxMessage:
        """Notify user when a video has been published to YouTube."""
        return await create_inbox_message(
            session=session,
            user_id=user_id,
            message_type=InboxMessageType.INFO,
            title="Video published to YouTube",
            body=f'Your video "{project_title}" has been successfully published to YouTube.',
            action_url=youtube_url,
            action_label="View on YouTube",
        )

    @staticmethod
    async def video_published_to_instagram(
        session: AsyncSession,
        user_id: str,
        project_title: str,
        instagram_url: str,
    ) -> InboxMessage:
        """Notify user when a video has been published to Instagram."""
        return await create_inbox_message(
            session=session,
            user_id=user_id,
            message_type=InboxMessageType.INFO,
            title="Reel published to Instagram",
            body=f'Your video "{project_title}" has been successfully published to Instagram.',
            action_url=instagram_url,
            action_label="View on Instagram",
        )

    @staticmethod
    async def transcription_complete(
        session: AsyncSession,
        user_id: str,
        project_id: str,
        project_title: str,
    ) -> InboxMessage:
        """Notify user when transcription is complete."""
        return await create_inbox_message(
            session=session,
            user_id=user_id,
            message_type=InboxMessageType.INFO,
            title="Transcription ready",
            body=f'The transcription for "{project_title}" is now complete and ready for review.',
            action_url=f"/projects/{project_id}",
            action_label="View Project",
        )

    @staticmethod
    async def job_failed(
        session: AsyncSession,
        user_id: str,
        project_id: str,
        project_title: str,
        error_message: str,
    ) -> InboxMessage:
        """Notify user when a job has failed."""
        # Truncate error message if too long
        if len(error_message) > 200:
            error_message = error_message[:200] + "..."

        return await create_inbox_message(
            session=session,
            user_id=user_id,
            message_type=InboxMessageType.ERROR,
            title="Processing failed",
            body=f'There was an error processing "{project_title}": {error_message}',
            action_url=f"/projects/{project_id}",
            action_label="View Project",
        )

    @staticmethod
    async def shorts_ready(
        session: AsyncSession,
        user_id: str,
        project_id: str,
        project_title: str,
        shorts_count: int,
    ) -> InboxMessage:
        """Notify user when shorts analysis is complete."""
        return await create_inbox_message(
            session=session,
            user_id=user_id,
            message_type=InboxMessageType.INFO,
            title="Shorts ready",
            body=f'Found {shorts_count} potential short{"s" if shorts_count != 1 else ""} in "{project_title}". Ready to export!',
            action_url=f"/projects/{project_id}",
            action_label="View Shorts",
        )


# Singleton instance
notifications = Notifications()
