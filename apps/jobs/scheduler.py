"""Scheduler service that polls for due scheduled posts and enqueues publish jobs."""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update

from config import JobRunnerConfig
from database import get_session_factory
from models import (
    JobStatus,
    JobType,
    ProcessingJob,
    ScheduledPost,
    ScheduledPostStatus,
)


class Scheduler:
    """
    Scheduler that polls scheduled_posts and enqueues publish jobs when due.

    Uses the existing processing_jobs queue - does NOT have its own queue.
    """

    def __init__(self, config: JobRunnerConfig, logger: Any):
        """
        Initialize scheduler.

        Args:
            config: Job runner configuration
            logger: Structured logger
        """
        self.config = config
        self.logger = logger
        self.running = False
        self.poll_task: asyncio.Task[None] | None = None
        self.poll_interval_seconds = 60  # Check every minute

    async def poll_for_due_posts(self) -> None:
        """Find scheduled posts that are due and enqueue publish jobs."""
        session_factory = get_session_factory()

        try:
            async with session_factory() as session:
                now = datetime.now(timezone.utc)

                # Find due posts with FOR UPDATE SKIP LOCKED
                stmt = (
                    select(ScheduledPost)
                    .where(ScheduledPost.status == ScheduledPostStatus.SCHEDULED.value)
                    .where(ScheduledPost.scheduled_for <= now)
                    .order_by(ScheduledPost.scheduled_for.asc())
                    .limit(10)  # Process up to 10 at a time
                    .with_for_update(skip_locked=True)
                )

                result = await session.execute(stmt)
                due_posts = result.scalars().all()

                if not due_posts:
                    self.logger.debug("No due scheduled posts found")
                    return

                self.logger.info(
                    "📅 Found due scheduled posts",
                    count=len(due_posts),
                )

                for post in due_posts:
                    # Update status to publishing
                    await session.execute(
                        update(ScheduledPost)
                        .where(ScheduledPost.id == post.id)
                        .values(
                            status=ScheduledPostStatus.PUBLISHING.value,
                            updated_at=now,
                        )
                    )

                    # Create youtube_publish job
                    job_id = str(uuid.uuid4())
                    job = ProcessingJob(
                        id=job_id,
                        type=JobType.YOUTUBE_PUBLISH.value,
                        status=JobStatus.QUEUED.value,
                        payload={
                            "scheduledPostId": post.id,
                            "shortId": post.short_id,
                            "socialAccountId": post.social_account_id,
                            "title": post.title,
                            "description": post.description,
                        },
                    )
                    session.add(job)

                    self.logger.info(
                        "🚀 Enqueued publish job",
                        scheduled_post_id=post.id,
                        job_id=job_id,
                        title=post.title[:50] if post.title else None,
                    )

                await session.commit()

        except Exception as error:
            self.logger.error(
                "Scheduler poll error",
                error=str(error),
                exc_info=True,
            )

    async def _poll_loop(self) -> None:
        """Main polling loop that runs continuously."""
        self.logger.info(
            "Starting scheduler",
            poll_interval_seconds=self.poll_interval_seconds,
        )

        # Run first poll immediately
        await self.poll_for_due_posts()

        # Continue polling while running
        while self.running:
            await asyncio.sleep(self.poll_interval_seconds)
            if self.running:
                try:
                    await self.poll_for_due_posts()
                except Exception as error:
                    self.logger.error(
                        "Scheduler poll loop error",
                        error=str(error),
                        exc_info=True,
                    )

    async def start(self) -> None:
        """Start the scheduler."""
        if self.running:
            self.logger.warning("Scheduler already running")
            return

        self.running = True
        self.poll_task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        """Stop the scheduler."""
        if not self.running:
            return

        self.logger.info("Stopping scheduler")
        self.running = False

        if self.poll_task:
            self.poll_task.cancel()
            try:
                await self.poll_task
            except asyncio.CancelledError:
                pass
            self.poll_task = None

        self.logger.info("Scheduler stopped")
