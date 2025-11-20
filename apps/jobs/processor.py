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
from models import (
    JobStatus,
    JobType,
    ProcessingJob,
    Project,
    ProjectStatus,
    Short,
    ShortStatus,
    Transcription,
)
from utils.storage import download_from_tigris, upload_to_tigris
from utils.transcription import transcribe_video
from utils.ffmpeg import extract_clip, extract_thumbnail, get_video_duration
from utils.ai import analyze_transcript_for_shorts


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
                # Fetch job (already set to "running" by worker)
                stmt = select(ProcessingJob).where(ProcessingJob.id == job_id).limit(1)
                result = await session.execute(stmt)
                job = result.scalar_one_or_none()

                if not job:
                    self.logger.warning("Job not found", job_id=job_id)
                    return

                if job.status != JobStatus.RUNNING.value:
                    self.logger.info(
                        "Job is not running, ignoring trigger",
                        job_id=job_id,
                        status=job.status,
                    )
                    return

                # Log with emoji based on job type
                job_emoji = {
                    JobType.THUMBNAIL.value: "🖼️",
                    JobType.TRANSCRIPTION.value: "📝",
                    JobType.ANALYSIS.value: "🤖",
                    JobType.CUTTING.value: "✂️",
                    JobType.DELIVERY.value: "📦",
                }.get(job.type, "⚙️")

                self.logger.info(f"{job_emoji} Processing {job.type} job", job_id=job_id, type=job.type)

                # Process based on type
                if job.type == JobType.THUMBNAIL.value:
                    result_data = await self._handle_thumbnail(job, session)
                elif job.type == JobType.TRANSCRIPTION.value:
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

                self.logger.info(f"✅ {job.type} job completed successfully", job_id=job_id, type=job.type)

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

    async def _handle_thumbnail(
        self, job: ProcessingJob, session: AsyncSession
    ) -> dict[str, Any]:
        """
        Handle thumbnail generation job.

        Args:
            job: Processing job
            session: Database session

        Returns:
            Job result dictionary
        """
        if not job.project_id:
            raise ValueError("Thumbnail job requires projectId")

        payload = job.payload or {}
        source_object_key = payload.get("sourceObjectKey")
        source_bucket = payload.get("sourceBucket")
        user_id = payload.get("userId")

        if not source_object_key or not source_bucket or not user_id:
            raise ValueError("Thumbnail job requires sourceObjectKey, sourceBucket, and userId in payload")

        self.logger.info(
            "🖼️  Starting thumbnail generation",
            job_id=job.id,
            project_id=job.project_id,
        )

        # Update project status
        await session.execute(
            update(Project)
            .where(Project.id == job.project_id)
            .values(
                status=ProjectStatus.PROCESSING.value,
                updated_at=datetime.now(timezone.utc),
            )
        )
        await session.commit()

        # Create temporary files for video and thumbnail
        video_fd, video_temp_path = tempfile.mkstemp(
            suffix=".mp4",
            prefix=f"video-{job.id}-{uuid.uuid4()}-",
        )
        os.close(video_fd)

        thumbnail_fd, thumbnail_temp_path = tempfile.mkstemp(
            suffix=".jpg",
            prefix=f"thumbnail-{job.id}-{uuid.uuid4()}-",
        )
        os.close(thumbnail_fd)

        try:
            # Download video from Tigris
            self.logger.info(
                "Downloading video for thumbnail extraction",
                job_id=job.id,
                source_object_key=source_object_key,
            )
            await download_from_tigris(
                self.config,
                source_bucket,
                source_object_key,
                video_temp_path,
            )

            # Extract video duration
            self.logger.info(
                "Extracting video duration",
                job_id=job.id,
                video_path=video_temp_path,
            )
            duration = await get_video_duration(video_temp_path)
            self.logger.info(
                "Video duration extracted",
                job_id=job.id,
                duration_seconds=duration,
            )

            # Extract thumbnail
            self.logger.info(
                "Extracting thumbnail",
                job_id=job.id,
                video_path=video_temp_path,
            )
            await extract_thumbnail(
                video_path=video_temp_path,
                output_path=thumbnail_temp_path,
                timestamp=None,  # Will extract at 25% into video
                width=640,
                height=360,
                quality=5,
            )

            # Generate thumbnail object key
            # Pattern: {userId}/projects/{projectId}/{timestamp}-thumbnail.jpg
            thumbnail_object_key = f"{user_id}/projects/{job.project_id}/{int(datetime.now(timezone.utc).timestamp() * 1000)}-thumbnail.jpg"

            # Upload thumbnail to Tigris
            self.logger.info(
                "Uploading thumbnail to Tigris",
                job_id=job.id,
                thumbnail_object_key=thumbnail_object_key,
            )
            await upload_to_tigris(
                self.config,
                source_bucket,
                thumbnail_object_key,
                thumbnail_temp_path,
                content_type="image/jpeg",
            )

            # Update project with thumbnail URL and duration
            await session.execute(
                update(Project)
                .where(Project.id == job.project_id)
                .values(
                    thumbnail_url=thumbnail_object_key,
                    duration_seconds=duration,
                    status=ProjectStatus.READY.value,
                    updated_at=datetime.now(timezone.utc),
                )
            )
            await session.commit()

            # Enqueue transcription job
            self.logger.info(
                "Enqueueing transcription job",
                job_id=job.id,
                project_id=job.project_id,
            )
            await self._enqueue_job(
                session,
                project_id=job.project_id,
                job_type=JobType.TRANSCRIPTION,
                payload={
                    "projectId": job.project_id,
                    "sourceObjectKey": source_object_key,
                    "sourceBucket": source_bucket,
                },
            )
            await session.commit()

            return {
                "message": "Thumbnail generated successfully",
                "thumbnailObjectKey": thumbnail_object_key,
            }

        finally:
            # Clean up temporary files
            for temp_path in [video_temp_path, thumbnail_temp_path]:
                try:
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)
                        self.logger.debug(
                            "Cleaned up temporary file",
                            job_id=job.id,
                            temp_path=temp_path,
                        )
                except Exception as error:
                    self.logger.warning(
                        "Failed to clean up temporary file",
                        job_id=job.id,
                        temp_path=temp_path,
                        error=str(error),
                    )

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
            "📝 Starting transcription",
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
        Handle analysis job - AI-powered short generation.

        Args:
            job: Processing job
            session: Database session

        Returns:
            Job result dictionary
        """
        if not job.project_id:
            raise ValueError("Analysis job requires projectId")

        payload = job.payload or {}
        shorts_count = payload.get("shortsCount", 3)
        custom_prompt = payload.get("customPrompt")

        self.logger.info(
            "🤖 Starting AI analysis for short generation",
            job_id=job.id,
            project_id=job.project_id,
            shorts_count=shorts_count,
        )

        # Update project status
        await session.execute(
            update(Project)
            .where(Project.id == job.project_id)
            .values(
                status=ProjectStatus.ANALYZING.value,
                updated_at=datetime.now(timezone.utc),
            )
        )
        await session.commit()

        # Fetch project to get source video info
        project_stmt = select(Project).where(Project.id == job.project_id).limit(1)
        project_result = await session.execute(project_stmt)
        project = project_result.scalar_one_or_none()

        if not project:
            raise ValueError(f"Project not found: {job.project_id}")

        # Fetch transcription
        transcription_stmt = (
            select(Transcription).where(Transcription.project_id == job.project_id).limit(1)
        )
        transcription_result = await session.execute(transcription_stmt)
        transcription = transcription_result.scalar_one_or_none()

        if not transcription:
            raise ValueError(f"No transcription found for project: {job.project_id}")

        if not transcription.segments:
            raise ValueError("Transcription has no segments")

        # Call AI to analyze transcript and suggest shorts
        self.logger.info(
            "Calling OpenRouter AI for short suggestions",
            job_id=job.id,
            num_segments=len(transcription.segments),
        )

        suggestions = await analyze_transcript_for_shorts(
            api_key=self.config.OPENROUTER_API_KEY,
            transcript_segments=transcription.segments,
            num_shorts=shorts_count,
            custom_prompt=custom_prompt,
        )

        self.logger.info(
            "Received short suggestions from AI",
            job_id=job.id,
            num_suggestions=len(suggestions),
        )

        # Download source video once for all clips
        temp_fd, temp_video_path = tempfile.mkstemp(
            suffix=".mp4",
            prefix=f"source-{job.id}-{uuid.uuid4()}-",
        )
        os.close(temp_fd)

        shorts_created = []

        try:
            # Download source video
            self.logger.info(
                "Downloading source video",
                job_id=job.id,
                source_object_key=project.source_object_key,
            )
            await download_from_tigris(
                self.config,
                project.source_bucket,
                project.source_object_key,
                temp_video_path,
            )

            # Process each suggested short
            for idx, suggestion in enumerate(suggestions):
                short_id = str(uuid.uuid4())

                self.logger.info(
                    f"✂️ Processing short {idx + 1}/{len(suggestions)}",
                    job_id=job.id,
                    short_id=short_id,
                    start=suggestion.start_time,
                    end=suggestion.end_time,
                    duration=suggestion.duration,
                )

                # Create temp paths for clip and thumbnail
                temp_clip_fd, temp_clip_path = tempfile.mkstemp(
                    suffix=".mp4",
                    prefix=f"clip-{short_id}-",
                )
                os.close(temp_clip_fd)

                temp_thumb_fd, temp_thumb_path = tempfile.mkstemp(
                    suffix=".jpg",
                    prefix=f"thumb-{short_id}-",
                )
                os.close(temp_thumb_fd)

                try:
                    # Extract clip using FFmpeg (with stream copy)
                    await extract_clip(
                        video_path=temp_video_path,
                        output_path=temp_clip_path,
                        start_time=suggestion.start_time,
                        end_time=suggestion.end_time,
                    )

                    # Extract thumbnail from clip (at midpoint)
                    clip_midpoint = suggestion.duration / 2
                    await extract_thumbnail(
                        video_path=temp_clip_path,
                        output_path=temp_thumb_path,
                        timestamp=clip_midpoint,
                        width=640,
                        height=360,
                    )

                    # Upload clip to Tigris
                    clip_object_key = f"{project.user_id}/projects/{job.project_id}/shorts/{short_id}.mp4"
                    self.logger.info(
                        "Uploading clip to Tigris",
                        short_id=short_id,
                        object_key=clip_object_key,
                    )
                    await upload_to_tigris(
                        self.config,
                        self.config.TIGRIS_BUCKET,
                        clip_object_key,
                        temp_clip_path,
                        content_type="video/mp4",
                    )

                    # Upload thumbnail to Tigris
                    thumb_object_key = f"{project.user_id}/projects/{job.project_id}/shorts/{short_id}-thumb.jpg"
                    await upload_to_tigris(
                        self.config,
                        self.config.TIGRIS_BUCKET,
                        thumb_object_key,
                        temp_thumb_path,
                        content_type="image/jpeg",
                    )

                    # Store object key (will be presigned by API)
                    thumbnail_url = thumb_object_key

                    # Generate title from transcription (first 50 chars)
                    title = suggestion.transcription[:50].strip()
                    if len(suggestion.transcription) > 50:
                        title += "..."

                    # Create short record in database
                    short = Short(
                        id=short_id,
                        project_id=job.project_id,
                        title=title,
                        description=suggestion.transcription,
                        start_time=suggestion.start_time,
                        end_time=suggestion.end_time,
                        output_object_key=clip_object_key,
                        thumbnail_url=thumbnail_url,
                        status=ShortStatus.COMPLETED.value,
                    )
                    session.add(short)
                    await session.commit()

                    shorts_created.append(
                        {
                            "id": short_id,
                            "title": title,
                            "duration": suggestion.duration,
                        }
                    )

                    self.logger.info(
                        "✅ Short created successfully",
                        short_id=short_id,
                        title=title,
                    )

                except Exception as error:
                    self.logger.error(
                        "Failed to process short",
                        short_id=short_id,
                        error=str(error),
                    )
                    # Create short record with error status
                    short = Short(
                        id=short_id,
                        project_id=job.project_id,
                        title=f"Short {idx + 1} (failed)",
                        description=suggestion.transcription,
                        start_time=suggestion.start_time,
                        end_time=suggestion.end_time,
                        status=ShortStatus.ERROR.value,
                        error_message=str(error),
                    )
                    session.add(short)
                    await session.commit()

                finally:
                    # Clean up temp files for this short
                    for temp_path in [temp_clip_path, temp_thumb_path]:
                        try:
                            if os.path.exists(temp_path):
                                os.unlink(temp_path)
                        except Exception as cleanup_error:
                            self.logger.warning(
                                "Failed to clean up temp file",
                                path=temp_path,
                                error=str(cleanup_error),
                            )

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

            return {
                "message": "Analysis and short generation completed",
                "shortsCreated": len(shorts_created),
                "shorts": shorts_created,
            }

        finally:
            # Clean up source video
            try:
                if os.path.exists(temp_video_path):
                    os.unlink(temp_video_path)
                    self.logger.debug(
                        "Cleaned up temporary source video",
                        job_id=job.id,
                        temp_video_path=temp_video_path,
                    )
            except Exception as error:
                self.logger.warning(
                    "Failed to clean up temporary source video",
                    job_id=job.id,
                    temp_video_path=temp_video_path,
                    error=str(error),
                )

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
