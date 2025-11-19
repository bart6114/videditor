"""Job queue worker with polling and concurrency management."""

import asyncio
import time
from typing import Any

from sqlalchemy import select

from config import JobRunnerConfig
from database import get_session_factory
from models import JobStatus, ProcessingJob
from processor import JobProcessor


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
        self.active_jobs: set[str] = set()
        self.concurrency = config.JOB_CONCURRENCY
        self.poll_interval_ms = config.POLL_INTERVAL_MS

    async def poll_for_jobs(self) -> None:
        """Poll the database for queued jobs and process them."""
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
                # Use FOR UPDATE SKIP LOCKED to safely claim jobs
                stmt = (
                    select(ProcessingJob)
                    .where(ProcessingJob.status == JobStatus.QUEUED.value)
                    .order_by(ProcessingJob.created_at.asc())
                    .limit(jobs_to_fetch)
                    .with_for_update(skip_locked=True)
                )

                result = await session.execute(stmt)
                jobs = result.scalars().all()

                if not jobs:
                    self.logger.debug("No queued jobs found")
                    return

                job_ids = [job.id for job in jobs]
                self.logger.info("Claimed jobs from queue", count=len(jobs), job_ids=job_ids)

                # Process each job concurrently
                for job in jobs:
                    if job.id in self.active_jobs:
                        continue

                    self.active_jobs.add(job.id)

                    # Create background task (fire-and-forget)
                    asyncio.create_task(self._process_job_wrapper(job.id))

        except Exception as error:
            self.logger.error("Failed to poll for jobs", error=str(error), exc_info=True)

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
                "Job processing failed",
                job_id=job_id,
                error=str(error),
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

        # Wait for active jobs to complete (with timeout)
        max_wait_s = 30
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
