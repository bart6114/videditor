"""Job queue worker with polling and concurrency management."""

import asyncio
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from config import JobRunnerConfig
from database import get_session_factory
from models import JobStatus, ProcessingJob
from processor import JobProcessor
from utils.cache import init_video_cache, run_cleanup_loop


class JobWorker:
    """Job worker that polls the queue and processes jobs concurrently."""

    def __init__(
        self,
        config: JobRunnerConfig,
        logger: Any,
        processor: JobProcessor,
    ):
        """
        Initialize job worker.

        Args:
            config: Job runner configuration
            logger: Structured logger
            processor: Job processor
        """
        self.config = config
        self.logger = logger
        self.processor = processor
        self.running = False
        self.poll_task: asyncio.Task[None] | None = None
        self.cleanup_task: asyncio.Task[None] | None = None
        self.affinity_cleanup_task: asyncio.Task[None] | None = None
        self.active_jobs: set[str] = set()
        self.concurrency = config.JOB_CONCURRENCY
        self.poll_interval_ms = config.POLL_INTERVAL_MS
        # Machine ID for job affinity (Fly.io sets FLY_MACHINE_ID, fallback for local dev)
        self.machine_id = config.FLY_MACHINE_ID or os.environ.get(
            "FLY_MACHINE_ID", f"local-{os.getpid()}"
        )

    async def poll_for_jobs(self) -> None:
        """Poll the database for queued jobs and process them.

        When job affinity is enabled, uses three-phase claiming:
        1. Jobs with preferred_machine_id matching this machine (cache hits)
        2. Jobs with no preferred_machine_id (new projects)
        3. Any remaining queued jobs (graceful degradation)
        """
        if len(self.active_jobs) >= self.concurrency:
            self.logger.debug(
                "At max concurrency, skipping poll",
                active_jobs=len(self.active_jobs),
                concurrency=self.concurrency,
            )
            return

        jobs_to_fetch = self.concurrency - len(self.active_jobs)
        session_factory = get_session_factory()

        try:
            async with session_factory() as session:
                claimed_jobs: list[ProcessingJob] = []

                if self.config.JOB_AFFINITY_ENABLED:
                    # Phase 1: Claim jobs with affinity to this machine
                    affinity_jobs = await self._claim_jobs_with_condition(
                        session,
                        ProcessingJob.preferred_machine_id == self.machine_id,
                        jobs_to_fetch,
                    )
                    claimed_jobs.extend(affinity_jobs)
                    jobs_to_fetch -= len(affinity_jobs)

                    # Phase 2: Claim jobs without affinity (new projects)
                    if jobs_to_fetch > 0:
                        no_affinity_jobs = await self._claim_jobs_with_condition(
                            session,
                            ProcessingJob.preferred_machine_id.is_(None),
                            jobs_to_fetch,
                        )
                        claimed_jobs.extend(no_affinity_jobs)
                        jobs_to_fetch -= len(no_affinity_jobs)

                    # Phase 3: Claim any remaining jobs (graceful degradation)
                    if jobs_to_fetch > 0:
                        exclude_ids = [j.id for j in claimed_jobs]
                        any_jobs = await self._claim_any_jobs(
                            session, jobs_to_fetch, exclude_ids
                        )
                        claimed_jobs.extend(any_jobs)
                else:
                    # Affinity disabled: use original FIFO logic
                    claimed_jobs = await self._claim_jobs_with_condition(
                        session, True, jobs_to_fetch  # No filter, just FIFO
                    )

                if not claimed_jobs:
                    self.logger.debug(
                        "No queued jobs found",
                        running_jobs=len(self.active_jobs),
                    )
                    return

                # Update all claimed jobs to "running" status
                job_ids = [job.id for job in claimed_jobs]
                now = datetime.now(timezone.utc)
                await session.execute(
                    update(ProcessingJob)
                    .where(ProcessingJob.id.in_(job_ids))
                    .values(
                        status=JobStatus.RUNNING.value,
                        started_at=now,
                        updated_at=now,
                        claimed_by_machine_id=self.machine_id,
                    )
                )
                await session.commit()

                # Log with affinity info
                affinity_hits = sum(
                    1 for j in claimed_jobs if j.preferred_machine_id == self.machine_id
                )
                job_info = [{"id": job.id, "type": job.type} for job in claimed_jobs]
                self.logger.info(
                    "🔄 Claimed jobs from queue",
                    count=len(claimed_jobs),
                    affinity_hits=affinity_hits if self.config.JOB_AFFINITY_ENABLED else None,
                    machine_id=self.machine_id if self.config.JOB_AFFINITY_ENABLED else None,
                    jobs=job_info,
                )

                # Process each job concurrently
                for job in claimed_jobs:
                    if job.id in self.active_jobs:
                        continue

                    self.active_jobs.add(job.id)
                    asyncio.create_task(self._process_job_wrapper(job.id))

        except Exception as error:
            self.logger.error("Failed to poll for jobs", error=str(error), exc_info=True)

    async def _claim_jobs_with_condition(
        self,
        session: AsyncSession,
        condition: Any,
        limit: int,
    ) -> list[ProcessingJob]:
        """Claim queued jobs matching a condition using FOR UPDATE SKIP LOCKED."""
        stmt = (
            select(ProcessingJob)
            .where(ProcessingJob.status == JobStatus.QUEUED.value)
            .where(condition)
            .order_by(ProcessingJob.created_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def _claim_any_jobs(
        self,
        session: AsyncSession,
        limit: int,
        exclude_ids: list[str],
    ) -> list[ProcessingJob]:
        """Claim any queued jobs, excluding already claimed ones."""
        stmt = (
            select(ProcessingJob)
            .where(ProcessingJob.status == JobStatus.QUEUED.value)
            .order_by(ProcessingJob.created_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        if exclude_ids:
            stmt = stmt.where(ProcessingJob.id.notin_(exclude_ids))
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def _process_job_wrapper(self, job_id: str) -> None:
        """
        Wrapper for processing a job with error handling and cleanup.

        Args:
            job_id: Job ID to process
        """
        try:
            await self.processor.process_job(job_id)
        except Exception as error:
            self.logger.error(
                "Job processing failed catastrophically",
                job_id=job_id,
                error=str(error),
                exc_info=True,
            )
            # Ensure job is marked as failed if processor didn't handle it
            try:
                session_factory = get_session_factory()
                async with session_factory() as session:
                    await session.execute(
                        update(ProcessingJob)
                        .where(ProcessingJob.id == job_id)
                        .values(
                            status=JobStatus.FAILED.value,
                            error_message=f"Catastrophic failure: {str(error)}",
                            updated_at=datetime.now(timezone.utc),
                        )
                    )
                    await session.commit()
            except Exception as cleanup_error:
                self.logger.error(
                    "Failed to mark job as failed",
                    job_id=job_id,
                    cleanup_error=str(cleanup_error),
                    exc_info=True,
                )
        finally:
            self.active_jobs.discard(job_id)

    async def _poll_loop(self) -> None:
        """Main polling loop that runs continuously."""
        self.logger.info(
            "Starting job worker",
            concurrency=self.concurrency,
            poll_interval_ms=self.poll_interval_ms,
        )

        # Run first poll immediately
        await self.poll_for_jobs()

        # Continue polling while running
        while self.running:
            await asyncio.sleep(self.poll_interval_ms / 1000.0)
            if self.running:
                try:
                    await self.poll_for_jobs()
                except Exception as error:
                    self.logger.error("Poll loop error", error=str(error), exc_info=True)

    async def start(self) -> None:
        """Start the job worker."""
        if self.running:
            self.logger.warning("Worker already running")
            return

        # Initialize video cache if enabled
        if self.config.VIDEO_CACHE_ENABLED:
            video_cache = init_video_cache(
                cache_dir=self.config.VIDEO_CACHE_DIR,
                ttl_seconds=self.config.VIDEO_CACHE_TTL_SECONDS,
            )
            # Clear cache on startup for clean slate
            video_cache.clear_all()
            self.logger.info(
                "Video cache initialized",
                cache_dir=self.config.VIDEO_CACHE_DIR,
                ttl_seconds=self.config.VIDEO_CACHE_TTL_SECONDS,
            )
            # Start background cleanup task
            self.cleanup_task = asyncio.create_task(
                run_cleanup_loop(video_cache, interval_seconds=300)
            )

        # Start affinity cleanup task if enabled
        if self.config.JOB_AFFINITY_ENABLED:
            self.affinity_cleanup_task = asyncio.create_task(
                self._run_affinity_cleanup_loop()
            )
            self.logger.info(
                "Job affinity enabled",
                machine_id=self.machine_id,
                ttl_hours=self.config.JOB_AFFINITY_TTL_HOURS,
                cleanup_interval_hours=self.config.JOB_AFFINITY_CLEANUP_INTERVAL_HOURS,
            )

        self.running = True
        self.poll_task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        """Stop the job worker and wait for active jobs to complete."""
        if not self.running:
            return

        self.logger.info("Stopping job worker")
        self.running = False

        # Cancel poll task
        if self.poll_task:
            self.poll_task.cancel()
            try:
                await self.poll_task
            except asyncio.CancelledError:
                pass
            self.poll_task = None

        # Cancel cleanup task
        if self.cleanup_task:
            self.cleanup_task.cancel()
            try:
                await self.cleanup_task
            except asyncio.CancelledError:
                pass
            self.cleanup_task = None

        # Cancel affinity cleanup task
        if self.affinity_cleanup_task:
            self.affinity_cleanup_task.cancel()
            try:
                await self.affinity_cleanup_task
            except asyncio.CancelledError:
                pass
            self.affinity_cleanup_task = None

        # Wait for active jobs to complete (with timeout)
        max_wait_s = 300  # 5 minutes to allow long-running jobs to finish
        start_time = time.time()

        while len(self.active_jobs) > 0 and (time.time() - start_time) < max_wait_s:
            self.logger.info(
                "Waiting for active jobs to complete",
                active_jobs=len(self.active_jobs),
            )
            await asyncio.sleep(1)

        if len(self.active_jobs) > 0:
            self.logger.warning(
                "Stopping worker with active jobs still running",
                active_jobs=len(self.active_jobs),
            )
        else:
            self.logger.info("All jobs completed, worker stopped")

    def get_active_job_count(self) -> int:
        """
        Get the number of active jobs.

        Returns:
            Number of active jobs
        """
        return len(self.active_jobs)

    async def _run_affinity_cleanup_loop(self) -> None:
        """Periodically clean up stale affinity records."""
        interval_seconds = self.config.JOB_AFFINITY_CLEANUP_INTERVAL_HOURS * 3600

        while self.running:
            await asyncio.sleep(interval_seconds)
            if self.running:
                try:
                    await self._cleanup_stale_affinity()
                except Exception as error:
                    self.logger.warning(
                        "Affinity cleanup error", error=str(error), exc_info=True
                    )

    async def _cleanup_stale_affinity(self) -> None:
        """Delete affinity records older than TTL."""
        session_factory = get_session_factory()
        ttl_hours = self.config.JOB_AFFINITY_TTL_HOURS
        cutoff = datetime.now(timezone.utc) - timedelta(hours=ttl_hours)

        async with session_factory() as session:
            result = await session.execute(
                text("""
                    DELETE FROM project_machine_affinity
                    WHERE last_processed_at < :cutoff
                """),
                {"cutoff": cutoff},
            )
            deleted = result.rowcount
            await session.commit()

            if deleted and deleted > 0:
                self.logger.info(
                    "Cleaned up stale affinity records",
                    deleted_count=deleted,
                    ttl_hours=ttl_hours,
                )
