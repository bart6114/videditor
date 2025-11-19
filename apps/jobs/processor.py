"""Job processor with handlers for all job types."""

import os
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from config import JobRunnerConfig
from database import get_session_factory
from models import JobStatus, JobType, ProcessingJob, Project, ProjectStatus, Transcription
from utils.storage import download_from_tigris
from utils.transcription import transcribe_video


class JobProcessor:
    """Job processor that handles execution of different job types."""

    def __init__(self, config: JobRunnerConfig, logger: Any):
        """
        Initialize job processor.

        Args:
            config: Job runner configuration
            logger: Structured logger
        """
        self.config = config
        self.logger = logger
        self.active_jobs: set[str] = set()

    async def process_job(self, job_id: str) -> None:
        """
        Process a single job by ID.

        Args:
            job_id: Job ID to process
        """
        if job_id in self.active_jobs:
            self.logger.debug("Job already processing, skipping duplicate trigger", job_id=job_id)
            return

        self.active_jobs.add(job_id)
        session_factory = get_session_factory()

        try:
            async with session_factory() as session:
                # Fetch job
                stmt = select(ProcessingJob).where(ProcessingJob.id == job_id).limit(1)
                result = await session.execute(stmt)
                job = result.scalar_one_or_none()

                if not job:
                    self.logger.warning("Job not found", job_id=job_id)
                    return

                if job.status != JobStatus.QUEUED.value:
                    self.logger.info(
                        "Job is not queued, ignoring trigger",
                        job_id=job_id,
                        status=job.status,
                    )
                    return

                # Update to running
                await session.execute(
                    update(ProcessingJob)
                    .where(ProcessingJob.id == job_id)
                    .values(
                        status=JobStatus.RUNNING.value,
                        started_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                )
                await session.commit()

                self.logger.info("Started job execution", job_id=job_id, type=job.type)

                # Process based on type
                if job.type == JobType.TRANSCRIPTION.value:
                    result_data = await self._handle_transcription(job, session)
                elif job.type == JobType.ANALYSIS.value:
                    result_data = await self._handle_analysis(job, session)
                elif job.type == JobType.CUTTING.value:
                    result_data = await self._handle_cutting(job, session)
                elif job.type == JobType.DELIVERY.value:
                    result_data = await self._handle_delivery(job, session)
                else:
                    raise ValueError(f"Unknown job type: {job.type}")

                # Update to succeeded
                await session.execute(
                    update(ProcessingJob)
                    .where(ProcessingJob.id == job_id)
                    .values(
                        status=JobStatus.SUCCEEDED.value,
                        completed_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                        result=result_data,
                    )
                )
                await session.commit()

                self.logger.info("Job completed successfully", job_id=job_id)

        except Exception as error:
            self.logger.error("Job failed", job_id=job_id, error=str(error), exc_info=True)
            async with session_factory() as session:
                await session.execute(
                    update(ProcessingJob)
                    .where(ProcessingJob.id == job_id)
                    .values(
                        status=JobStatus.FAILED.value,
                        error_message=str(error),
                        updated_at=datetime.now(timezone.utc),
                    )
                )
                await session.commit()
        finally:
            self.active_jobs.discard(job_id)

    async def _handle_transcription(
        self, job: ProcessingJob, session: AsyncSession
    ) -> dict[str, Any]:
        """
        Handle transcription job.

        Args:
            job: Processing job
            session: Database session

        Returns:
            Job result dictionary
        """
        if not job.project_id:
            raise ValueError("Transcription job requires projectId")

        payload = job.payload or {}
        source_object_key = payload.get("sourceObjectKey")
        source_bucket = payload.get("sourceBucket")

        if not source_object_key or not source_bucket:
            raise ValueError("Transcription job requires sourceObjectKey and sourceBucket in payload")

        self.logger.info(
            "Starting transcription",
            job_id=job.id,
            project_id=job.project_id,
        )

        # Update project status
        await session.execute(
            update(Project)
            .where(Project.id == job.project_id)
            .values(
                status=ProjectStatus.TRANSCRIBING.value,
                updated_at=datetime.now(timezone.utc),
            )
        )
        await session.commit()

        # Create temporary file for video
        temp_fd, temp_file_path = tempfile.mkstemp(
            suffix=".mp4",
            prefix=f"video-{job.id}-{uuid.uuid4()}-",
        )
        os.close(temp_fd)  # Close file descriptor, we just need the path

        try:
            # Download video from Tigris
            self.logger.info(
                "Downloading video from Tigris",
                job_id=job.id,
                source_object_key=source_object_key,
            )
            await download_from_tigris(
                self.config,
                source_bucket,
                source_object_key,
                temp_file_path,
            )

            # Run transcription with faster-whisper
            self.logger.info(
                "Running faster-whisper transcription",
                job_id=job.id,
                temp_file_path=temp_file_path,
            )
            transcription_result = await transcribe_video(temp_file_path)

            # Save transcription to database
            self.logger.info(
                "Saving transcription to database",
                job_id=job.id,
                text_length=len(transcription_result.text),
            )

            transcription = Transcription(
                id=str(uuid.uuid4()),
                project_id=job.project_id,
                text=transcription_result.text,
                segments=[seg.model_dump() for seg in transcription_result.segments],
                language=transcription_result.language,
                duration_seconds=None,
            )
            session.add(transcription)

            # Update project status to completed
            await session.execute(
                update(Project)
                .where(Project.id == job.project_id)
                .values(
                    status=ProjectStatus.COMPLETED.value,
                    updated_at=datetime.now(timezone.utc),
                )
            )
            await session.commit()

            # Enqueue analysis job
            self.logger.info(
                "Enqueueing analysis job",
                job_id=job.id,
                project_id=job.project_id,
            )
            await self._enqueue_job(
                session,
                project_id=job.project_id,
                job_type=JobType.ANALYSIS,
                payload={"projectId": job.project_id},
            )
            await session.commit()

            return {
                "message": "Transcription completed",
                "textLength": len(transcription_result.text),
                "segmentCount": len(transcription_result.segments),
                "language": transcription_result.language,
                "transcriptionId": transcription.id,
            }

        finally:
            # Clean up temporary file
            try:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    self.logger.debug(
                        "Cleaned up temporary video file",
                        job_id=job.id,
                        temp_file_path=temp_file_path,
                    )
            except Exception as error:
                self.logger.warning(
                    "Failed to clean up temporary file",
                    job_id=job.id,
                    temp_file_path=temp_file_path,
                    error=str(error),
                )

    async def _handle_analysis(
        self, job: ProcessingJob, session: AsyncSession
    ) -> dict[str, Any]:
        """
        Handle analysis job (stub).

        Args:
            job: Processing job
            session: Database session

        Returns:
            Job result dictionary
        """
        if not job.project_id:
            raise ValueError("Analysis job requires projectId")

        self.logger.info(
            "Analysis job (stub implementation)",
            job_id=job.id,
            project_id=job.project_id,
        )

        # TODO: Implement AI analysis of transcription to identify viral moments

        # Enqueue cutting job
        self.logger.info(
            "Enqueueing cutting job",
            job_id=job.id,
            project_id=job.project_id,
        )
        await self._enqueue_job(
            session,
            project_id=job.project_id,
            job_type=JobType.CUTTING,
            payload={"projectId": job.project_id},
        )
        await session.commit()

        return {"message": "Analysis completed (stub)"}

    async def _handle_cutting(
        self, job: ProcessingJob, session: AsyncSession
    ) -> dict[str, Any]:
        """
        Handle cutting job (stub).

        Args:
            job: Processing job
            session: Database session

        Returns:
            Job result dictionary
        """
        if not job.project_id:
            raise ValueError("Cutting job requires projectId")

        self.logger.info(
            "Cutting job (stub implementation)",
            job_id=job.id,
            project_id=job.project_id,
        )

        # TODO: Implement FFmpeg video cutting based on analysis results

        return {"message": "Cutting completed (stub)"}

    async def _handle_delivery(
        self, job: ProcessingJob, session: AsyncSession
    ) -> dict[str, Any]:
        """
        Handle delivery job (stub).

        Args:
            job: Processing job
            session: Database session

        Returns:
            Job result dictionary
        """
        self.logger.info(
            "Delivery job (stub implementation)",
            job_id=job.id,
        )

        # TODO: Implement delivery logic (upload to CDN, notify user, etc.)

        return {"message": "Delivery completed (stub)"}

    async def _enqueue_job(
        self,
        session: AsyncSession,
        project_id: str | None = None,
        short_id: str | None = None,
        job_type: JobType = JobType.TRANSCRIPTION,
        payload: dict[str, Any] | None = None,
    ) -> ProcessingJob:
        """
        Enqueue a new job.

        Args:
            session: Database session
            project_id: Project ID
            short_id: Short ID
            job_type: Job type
            payload: Job payload

        Returns:
            Created job
        """
        new_job = ProcessingJob(
            id=str(uuid.uuid4()),
            project_id=project_id,
            short_id=short_id,
            type=job_type.value,
            status=JobStatus.QUEUED.value,
            payload=payload,
        )
        session.add(new_job)
        return new_job
