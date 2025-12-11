"""Job processor with handlers for all job types."""

import os
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import select, update, text, bindparam
from sqlalchemy.ext.asyncio import AsyncSession

from config import JobRunnerConfig
from database import get_session_factory
from models import (
    JobStatus,
    JobType,
    ProcessingJob,
    Project,
    ProjectStatus,
    ScheduledPost,
    ScheduledPostStatus,
    Short,
    ShortStatus,
    ShortTaskStatus,
    SocialAccount,
    Transcription,
    YouTubePublishPayload,
    InstagramPublishPayload,
)
from utils.storage import download_from_tigris, upload_to_tigris
from utils.transcription import transcribe_video
from utils.ffmpeg import extract_clip, extract_thumbnail, get_video_duration
from utils.ai import analyze_transcript_for_shorts, extract_context_window, generate_social_content
from utils.cache import get_video_cache


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
                    JobType.SHORT_PROCESSING.value: "✂️",
                    JobType.YOUTUBE_PUBLISH.value: "📺",
                    JobType.INSTAGRAM_PUBLISH.value: "📸",
                }.get(job.type, "⚙️")

                self.logger.info(f"{job_emoji} Processing {job.type} job", job_id=job_id, type=job.type)

                # Process based on type
                if job.type == JobType.THUMBNAIL.value:
                    result_data = await self._handle_thumbnail(job, session)
                elif job.type == JobType.TRANSCRIPTION.value:
                    result_data = await self._handle_transcription(job, session)
                elif job.type == JobType.ANALYSIS.value:
                    result_data = await self._handle_analysis(job, session)
                elif job.type == JobType.SHORT_PROCESSING.value:
                    result_data = await self._handle_short_processing(job, session)
                elif job.type == JobType.YOUTUBE_PUBLISH.value:
                    result_data = await self._handle_youtube_publish(job, session)
                elif job.type == JobType.INSTAGRAM_PUBLISH.value:
                    result_data = await self._handle_instagram_publish(job, session)
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
        organization_id = payload.get("organizationId")

        if not source_object_key or not source_bucket or not organization_id:
            raise ValueError("Thumbnail job requires sourceObjectKey, sourceBucket, and organizationId in payload")

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
            # Pattern: {organizationId}/projects/{projectId}/{timestamp}-thumbnail.jpg
            thumbnail_object_key = f"{organization_id}/projects/{job.project_id}/{int(datetime.now(timezone.utc).timestamp() * 1000)}-thumbnail.jpg"

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

            # Run transcription with Deepgram API
            self.logger.info(
                "Running Deepgram transcription",
                job_id=job.id,
                temp_file_path=temp_file_path,
                chunk_duration_seconds=self.config.DEEPGRAM_CHUNK_DURATION_SECONDS,
                max_concurrent=self.config.DEEPGRAM_MAX_CONCURRENT,
                model=self.config.DEEPGRAM_MODEL,
            )

            # Create progress callback to update job progress
            async def update_transcription_progress(current: int, total: int) -> None:
                await self._update_job_progress(
                    session, job.id, phase="transcribing", current=current, total=total
                )

            transcription_result = await transcribe_video(
                video_path=temp_file_path,
                api_key=self.config.DEEPGRAM_API_KEY,
                chunk_duration_seconds=self.config.DEEPGRAM_CHUNK_DURATION_SECONDS,
                audio_bitrate=self.config.DEEPGRAM_AUDIO_BITRATE,
                max_concurrent=self.config.DEEPGRAM_MAX_CONCURRENT,
                progress_callback=update_transcription_progress,
                trace_id=f"{job.project_id}_transcription_{job.id}",
                model=self.config.DEEPGRAM_MODEL,
            )

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
                segments=[word.model_dump() for word in transcription_result.words],
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

            return {
                "message": "Transcription completed",
                "textLength": len(transcription_result.text),
                "wordCount": len(transcription_result.words),
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
        Handle analysis job - AI-powered short suggestion and container creation.

        This job analyzes the transcript with AI to get short suggestions,
        creates "short containers" with pending status, and queues individual
        short_processing jobs for each container.

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
        preferred_length = payload.get("preferredLength", 45)
        max_length = payload.get("maxLength", 60)
        custom_prompt = payload.get("customPrompt")
        custom_social_prompt = payload.get("customSocialPrompt")
        avoid_existing_overlap = payload.get("avoidExistingOverlap", False)
        social_platforms = payload.get("socialPlatforms", [])

        self.logger.info(
            "🤖 Starting AI analysis for short generation",
            job_id=job.id,
            project_id=job.project_id,
            shorts_count=shorts_count,
            preferred_length=preferred_length,
            max_length=max_length,
        )

        # Update project status and set initial progress
        await session.execute(
            update(Project)
            .where(Project.id == job.project_id)
            .values(
                status=ProjectStatus.ANALYZING.value,
                updated_at=datetime.now(timezone.utc),
            )
        )
        await session.commit()

        # Set progress to analyzing phase
        await self._update_job_progress(session, job.id, phase="analyzing", current=0, total=0)

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

        # Fetch existing shorts if avoidExistingOverlap is enabled
        existing_shorts = None
        if avoid_existing_overlap:
            existing_shorts_stmt = select(Short).where(Short.project_id == job.project_id)
            existing_shorts_result = await session.execute(existing_shorts_stmt)
            existing_shorts_rows = existing_shorts_result.scalars().all()
            if existing_shorts_rows:
                existing_shorts = [
                    {"transcription": s.transcription_slice}
                    for s in existing_shorts_rows
                ]
                self.logger.info(
                    "Fetched existing shorts to avoid overlap",
                    job_id=job.id,
                    num_existing_shorts=len(existing_shorts),
                )

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
            preferred_length=preferred_length,
            max_length=max_length,
            custom_prompt=custom_prompt,
            existing_shorts=existing_shorts,
            model=self.config.OPENROUTER_ANALYSIS_MODEL,
            trace_id=f"{job.project_id}_analysis_{job.id}",
        )

        self.logger.info(
            "Received short suggestions from AI, creating containers",
            job_id=job.id,
            num_suggestions=len(suggestions),
        )

        # Update progress to generating phase (now means "creating containers")
        await self._update_job_progress(session, job.id, phase="generating", current=0, total=len(suggestions))

        shorts_created = []
        jobs_queued = []

        # Create short containers and queue processing jobs
        for idx, suggestion in enumerate(suggestions):
            short_id = str(uuid.uuid4())

            # Determine initial task statuses
            initial_tasks = {
                "clip_extraction": ShortTaskStatus.PENDING.value,
                "thumbnail_extraction": ShortTaskStatus.PENDING.value,
                "social_content": ShortTaskStatus.SKIPPED.value if not social_platforms else ShortTaskStatus.PENDING.value,
            }

            # Create short container with pending status
            short = Short(
                id=short_id,
                project_id=job.project_id,
                analysis_job_id=job.id,
                transcription_slice=suggestion.transcription,
                start_time=suggestion.start_time,
                end_time=suggestion.end_time,
                status=ShortStatus.PENDING.value,
                tasks=initial_tasks,
            )
            session.add(short)
            await session.flush()  # Get short ID before creating job

            # Extract context for social content generation
            context_before, context_after = "", ""
            if social_platforms and transcription.segments:
                context_before, context_after = extract_context_window(
                    words=transcription.segments,
                    start_time=suggestion.start_time,
                    end_time=suggestion.end_time,
                )

            # Queue short_processing job
            processing_job = await self._enqueue_job(
                session,
                project_id=job.project_id,
                short_id=short_id,
                job_type=JobType.SHORT_PROCESSING,
                payload={
                    "shortId": short_id,
                    "projectId": job.project_id,
                    "sourceObjectKey": project.source_object_key,
                    "sourceBucket": project.source_bucket,
                    "organizationId": project.organization_id,
                    "startTime": suggestion.start_time,
                    "endTime": suggestion.end_time,
                    "transcriptionSlice": suggestion.transcription,
                    "socialPlatforms": social_platforms if social_platforms else None,
                    "customSocialPrompt": custom_social_prompt if custom_social_prompt else None,
                    "contextBefore": context_before if context_before else None,
                    "contextAfter": context_after if context_after else None,
                },
            )

            shorts_created.append(short_id)
            jobs_queued.append(processing_job.id)

            self.logger.info(
                f"📦 Created short container {idx + 1}/{len(suggestions)}",
                short_id=short_id,
                processing_job_id=processing_job.id,
            )

        await session.commit()

        # Update project status to completed (shorts will process individually)
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
            "message": "Analysis completed, short processing jobs queued",
            "shortsCreated": len(shorts_created),
            "jobsQueued": len(jobs_queued),
            "shortIds": shorts_created,
        }

    async def _update_job_progress(
        self,
        session: AsyncSession,
        job_id: str,
        phase: str,
        current: int = 0,
        total: int = 0,
    ) -> None:
        """
        Update job progress in database.

        Args:
            session: Database session
            job_id: Job ID
            phase: Current phase ('analyzing' or 'generating')
            current: Current item number (0-indexed becomes 1-indexed for display)
            total: Total number of items
        """
        import json
        progress_data = {"phase": phase, "current": current, "total": total}
        await session.execute(
            update(ProcessingJob)
            .where(ProcessingJob.id == job_id)
            .values(
                progress=progress_data,
                updated_at=datetime.now(timezone.utc),
            )
        )
        await session.commit()

    async def _update_short_task(
        self,
        session: AsyncSession,
        short_id: str,
        task_name: str,
        status: str,
    ) -> None:
        """
        Update a specific task status within the short's tasks JSONB.

        Args:
            session: Database session
            short_id: Short ID
            task_name: Task name ('clip_extraction', 'thumbnail_extraction', 'social_content')
            status: Task status ('pending', 'processing', 'done', 'error', 'skipped')
        """
        await session.execute(
            text(f"""
                UPDATE shorts
                SET tasks = jsonb_set(
                    COALESCE(tasks, CAST('{{}}' AS jsonb)),
                    '{{{task_name}}}',
                    CAST(:value AS jsonb)
                ),
                updated_at = NOW()
                WHERE id = :short_id
            """),
            {
                "value": f'"{status}"',
                "short_id": short_id,
            }
        )
        await session.commit()

    async def _handle_short_processing(
        self, job: ProcessingJob, session: AsyncSession
    ) -> dict[str, Any]:
        """
        Handle short processing job - extract clip, thumbnail, and generate social content.

        This job processes a single short that was created as a "container" by the analysis job.

        Args:
            job: Processing job
            session: Database session

        Returns:
            Job result dictionary
        """
        if not job.short_id:
            raise ValueError("Short processing job requires shortId")

        payload = job.payload or {}
        short_id = payload.get("shortId")
        project_id = payload.get("projectId")
        source_object_key = payload.get("sourceObjectKey")
        source_bucket = payload.get("sourceBucket")
        organization_id = payload.get("organizationId")
        start_time = payload.get("startTime")
        end_time = payload.get("endTime")
        transcription_slice = payload.get("transcriptionSlice")
        social_platforms = payload.get("socialPlatforms", [])
        custom_social_prompt = payload.get("customSocialPrompt")
        context_before = payload.get("contextBefore")
        context_after = payload.get("contextAfter")

        if not all([short_id, project_id, source_object_key, source_bucket, organization_id]):
            raise ValueError("Missing required payload fields for short processing")

        self.logger.info(
            "✂️ Processing short",
            job_id=job.id,
            short_id=short_id,
            start_time=start_time,
            end_time=end_time,
        )

        # Update short status to processing
        await session.execute(
            update(Short)
            .where(Short.id == short_id)
            .values(
                status=ShortStatus.PROCESSING.value,
                updated_at=datetime.now(timezone.utc),
            )
        )
        await session.commit()

        # Create temp files for clip and thumbnail (these are always fresh)
        temp_clip_fd, temp_clip_path = tempfile.mkstemp(
            suffix=".mp4", prefix=f"clip-{short_id}-"
        )
        os.close(temp_clip_fd)
        temp_thumb_fd, temp_thumb_path = tempfile.mkstemp(
            suffix=".jpg", prefix=f"thumb-{short_id}-"
        )
        os.close(temp_thumb_fd)

        # Source video: use cache if enabled, otherwise temp file
        video_cache = get_video_cache()
        using_cache = video_cache is not None and self.config.VIDEO_CACHE_ENABLED
        temp_video_path: str | None = None

        result_data = {}

        try:
            # 1. Download source video (with optional caching)
            if using_cache:
                self.logger.info(
                    "Getting source video from cache",
                    short_id=short_id,
                    project_id=project_id,
                )
                cache_path = await video_cache.get_or_download(
                    project_id=str(project_id),
                    video_key=source_object_key,
                    download_fn=lambda dest: download_from_tigris(
                        self.config, source_bucket, source_object_key, dest
                    ),
                )
                temp_video_path = str(cache_path)
            else:
                # Fallback: download to temp file (will be cleaned up in finally)
                temp_video_fd, temp_video_path = tempfile.mkstemp(
                    suffix=".mp4", prefix=f"source-{short_id}-"
                )
                os.close(temp_video_fd)
                self.logger.info("Downloading source video", short_id=short_id)
                await download_from_tigris(
                    self.config,
                    source_bucket,
                    source_object_key,
                    temp_video_path,
                )

            # 2. Extract clip
            await self._update_short_task(session, short_id, "clip_extraction", ShortTaskStatus.PROCESSING.value)
            try:
                await extract_clip(
                    video_path=temp_video_path,
                    output_path=temp_clip_path,
                    start_time=start_time,
                    end_time=end_time,
                )

                clip_object_key = f"{organization_id}/projects/{project_id}/shorts/{short_id}.mp4"
                await upload_to_tigris(
                    self.config,
                    self.config.TIGRIS_BUCKET,
                    clip_object_key,
                    temp_clip_path,
                    content_type="video/mp4",
                )

                await self._update_short_task(session, short_id, "clip_extraction", ShortTaskStatus.DONE.value)
                result_data["clipObjectKey"] = clip_object_key
                self.logger.info("✓ Clip extracted and uploaded", short_id=short_id)

            except Exception as e:
                await self._update_short_task(session, short_id, "clip_extraction", ShortTaskStatus.ERROR.value)
                raise

            # 3. Extract thumbnail
            await self._update_short_task(session, short_id, "thumbnail_extraction", ShortTaskStatus.PROCESSING.value)
            try:
                clip_duration = end_time - start_time
                clip_midpoint = clip_duration / 2

                await extract_thumbnail(
                    video_path=temp_clip_path,
                    output_path=temp_thumb_path,
                    timestamp=clip_midpoint,
                    width=640,
                    height=360,
                )

                thumb_object_key = f"{organization_id}/projects/{project_id}/shorts/{short_id}-thumb.jpg"
                await upload_to_tigris(
                    self.config,
                    self.config.TIGRIS_BUCKET,
                    thumb_object_key,
                    temp_thumb_path,
                    content_type="image/jpeg",
                )

                await self._update_short_task(session, short_id, "thumbnail_extraction", ShortTaskStatus.DONE.value)
                result_data["thumbnailObjectKey"] = thumb_object_key
                self.logger.info("✓ Thumbnail extracted and uploaded", short_id=short_id)

            except Exception as e:
                await self._update_short_task(session, short_id, "thumbnail_extraction", ShortTaskStatus.ERROR.value)
                raise

            # 4. Generate social content (if platforms specified)
            social_content_data = None
            if social_platforms:
                await self._update_short_task(session, short_id, "social_content", ShortTaskStatus.PROCESSING.value)
                try:
                    social_content_data = await generate_social_content(
                        api_key=self.config.OPENROUTER_API_KEY,
                        transcription=transcription_slice,
                        platforms=social_platforms,
                        model=self.config.OPENROUTER_SOCIAL_MODEL,
                        context_before=context_before,
                        context_after=context_after,
                        custom_prompt=custom_social_prompt,
                        trace_id=f"{project_id}_social_{short_id}",
                    )
                    await self._update_short_task(session, short_id, "social_content", ShortTaskStatus.DONE.value)
                    result_data["socialContent"] = social_content_data
                    self.logger.info("✓ Social content generated", short_id=short_id, platforms=list(social_content_data.keys()) if social_content_data else [])

                except Exception as e:
                    self.logger.warning(
                        "Social content generation failed (continuing)",
                        short_id=short_id,
                        error=str(e),
                    )
                    await self._update_short_task(session, short_id, "social_content", ShortTaskStatus.ERROR.value)
                    # Don't raise - social content failure is non-fatal

            # 5. Update short to completed
            await session.execute(
                update(Short)
                .where(Short.id == short_id)
                .values(
                    status=ShortStatus.COMPLETED.value,
                    output_object_key=result_data.get("clipObjectKey"),
                    thumbnail_url=result_data.get("thumbnailObjectKey"),
                    social_content=social_content_data,
                    updated_at=datetime.now(timezone.utc),
                )
            )
            await session.commit()

            self.logger.info("✅ Short processing completed", short_id=short_id)

            return {
                "message": "Short processed successfully",
                "shortId": short_id,
                **result_data,
            }

        except Exception as e:
            await session.execute(
                update(Short)
                .where(Short.id == short_id)
                .values(
                    status=ShortStatus.ERROR.value,
                    error_message=str(e),
                    updated_at=datetime.now(timezone.utc),
                )
            )
            await session.commit()
            raise

        finally:
            # Clean up temp files (but NOT cached source video)
            temp_files_to_clean = [temp_clip_path, temp_thumb_path]
            if not using_cache and temp_video_path:
                # Only clean up source video if we're not using cache
                temp_files_to_clean.append(temp_video_path)

            for temp_path in temp_files_to_clean:
                try:
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)
                except Exception:
                    pass

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

    async def _handle_youtube_publish(
        self, job: ProcessingJob, session: AsyncSession
    ) -> dict[str, Any]:
        """
        Handle YouTube publish job.

        Downloads the short video and uploads it to YouTube.

        Args:
            job: Processing job
            session: Database session

        Returns:
            Job result dictionary
        """
        # Import here to avoid circular import and lazy load
        from utils.youtube import refresh_access_token, upload_to_youtube

        payload_data = job.payload or {}
        try:
            payload = YouTubePublishPayload(**payload_data)
        except Exception as e:
            raise ValueError(f"Invalid YouTube publish payload: {e}")

        scheduled_post_id = payload.scheduledPostId
        short_id = payload.shortId
        social_account_id = payload.socialAccountId
        title = payload.title
        description = payload.description or ""

        self.logger.info(
            "Starting YouTube publish",
            job_id=job.id,
            scheduled_post_id=scheduled_post_id,
            short_id=short_id,
        )

        # Max retry count
        MAX_RETRIES = 3

        # Get scheduled post
        stmt = select(ScheduledPost).where(ScheduledPost.id == scheduled_post_id).limit(1)
        result = await session.execute(stmt)
        scheduled_post = result.scalar_one_or_none()

        if not scheduled_post:
            raise ValueError(f"Scheduled post not found: {scheduled_post_id}")

        current_retry = scheduled_post.retry_count or 0

        try:
            # Get social account
            stmt = select(SocialAccount).where(SocialAccount.id == social_account_id).limit(1)
            result = await session.execute(stmt)
            social_account = result.scalar_one_or_none()

            if not social_account:
                raise ValueError(f"Social account not found: {social_account_id}")

            # Get short
            stmt = select(Short).where(Short.id == short_id).limit(1)
            result = await session.execute(stmt)
            short = result.scalar_one_or_none()

            if not short or not short.output_object_key:
                raise ValueError(f"Short not found or not ready: {short_id}")

            # Check/refresh access token if expired
            access_token = social_account.access_token
            now = datetime.now(timezone.utc)
            buffer_seconds = 300  # 5 minute buffer

            if social_account.token_expires_at <= now + __import__('datetime').timedelta(seconds=buffer_seconds):
                self.logger.info("Refreshing expired access token", job_id=job.id)
                new_tokens = await refresh_access_token(social_account.refresh_token)
                access_token = new_tokens["access_token"]

                await session.execute(
                    update(SocialAccount)
                    .where(SocialAccount.id == social_account_id)
                    .values(
                        access_token=new_tokens["access_token"],
                        token_expires_at=new_tokens["expires_at"],
                        updated_at=now,
                    )
                )
                await session.commit()

            # Download short video from Tigris
            temp_fd, temp_video_path = tempfile.mkstemp(suffix=".mp4", prefix=f"publish-{short_id}-")
            os.close(temp_fd)

            try:
                await download_from_tigris(
                    self.config,
                    self.config.TIGRIS_BUCKET,
                    short.output_object_key,
                    temp_video_path,
                )

                # Upload to YouTube
                result = await upload_to_youtube(
                    access_token=access_token,
                    video_path=temp_video_path,
                    title=title,
                    description=description,
                )

                video_id = result["videoId"]
                video_url = result["url"]

                # Update scheduled_post to published
                await session.execute(
                    update(ScheduledPost)
                    .where(ScheduledPost.id == scheduled_post_id)
                    .values(
                        status=ScheduledPostStatus.PUBLISHED.value,
                        platform_post_id=video_id,
                        platform_url=video_url,
                        published_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                )
                await session.commit()

                self.logger.info(
                    "✅ YouTube publish completed",
                    job_id=job.id,
                    video_id=video_id,
                    url=video_url,
                )

                return {
                    "message": "Video published successfully",
                    "videoId": video_id,
                    "url": video_url,
                    "scheduledPostId": scheduled_post_id,
                }

            finally:
                # Clean up temp file
                if os.path.exists(temp_video_path):
                    os.unlink(temp_video_path)

        except Exception as e:
            error_message = str(e)
            self.logger.error(
                "YouTube publish failed",
                job_id=job.id,
                scheduled_post_id=scheduled_post_id,
                error=error_message,
                retry_count=current_retry,
            )

            # Check if we should retry
            if current_retry < MAX_RETRIES - 1:
                # Increment retry count and keep as publishing for scheduler to retry
                await session.execute(
                    update(ScheduledPost)
                    .where(ScheduledPost.id == scheduled_post_id)
                    .values(
                        retry_count=current_retry + 1,
                        error_message=error_message,
                        status=ScheduledPostStatus.SCHEDULED.value,  # Back to scheduled for retry
                        # Set next retry time with exponential backoff
                        scheduled_for=datetime.now(timezone.utc) + __import__('datetime').timedelta(
                            seconds=[30, 120, 600][current_retry]  # 30s, 2min, 10min
                        ),
                        updated_at=datetime.now(timezone.utc),
                    )
                )
                await session.commit()
                self.logger.info(
                    f"Scheduled retry {current_retry + 1}/{MAX_RETRIES}",
                    job_id=job.id,
                    scheduled_post_id=scheduled_post_id,
                )
                # Don't re-raise - let the job succeed so scheduler can retry
                return {
                    "message": f"Publish failed, retry {current_retry + 1}/{MAX_RETRIES} scheduled",
                    "scheduledPostId": scheduled_post_id,
                    "error": error_message,
                }
            else:
                # Max retries exceeded, mark as failed
                await session.execute(
                    update(ScheduledPost)
                    .where(ScheduledPost.id == scheduled_post_id)
                    .values(
                        status=ScheduledPostStatus.FAILED.value,
                        error_message=error_message,
                        updated_at=datetime.now(timezone.utc),
                    )
                )
                await session.commit()
                raise

    async def _handle_instagram_publish(
        self, job: ProcessingJob, session: AsyncSession
    ) -> dict[str, Any]:
        """
        Handle Instagram Reels publish job.

        Generates a presigned URL for the short video and uploads it to Instagram as a Reel.

        Args:
            job: Processing job
            session: Database session

        Returns:
            Job result dictionary
        """
        # Import here to avoid circular import and lazy load
        from utils.instagram import refresh_access_token as refresh_instagram_token, upload_reel
        from utils.storage import generate_presigned_url

        payload_data = job.payload or {}
        try:
            payload = InstagramPublishPayload(**payload_data)
        except Exception as e:
            raise ValueError(f"Invalid Instagram publish payload: {e}")

        scheduled_post_id = payload.scheduledPostId
        short_id = payload.shortId
        social_account_id = payload.socialAccountId
        caption = payload.caption

        self.logger.info(
            "Starting Instagram publish",
            job_id=job.id,
            scheduled_post_id=scheduled_post_id,
            short_id=short_id,
        )

        # Max retry count
        MAX_RETRIES = 3

        # Get scheduled post
        stmt = select(ScheduledPost).where(ScheduledPost.id == scheduled_post_id).limit(1)
        result = await session.execute(stmt)
        scheduled_post = result.scalar_one_or_none()

        if not scheduled_post:
            raise ValueError(f"Scheduled post not found: {scheduled_post_id}")

        current_retry = scheduled_post.retry_count or 0

        try:
            # Get social account
            stmt = select(SocialAccount).where(SocialAccount.id == social_account_id).limit(1)
            result = await session.execute(stmt)
            social_account = result.scalar_one_or_none()

            if not social_account:
                raise ValueError(f"Social account not found: {social_account_id}")

            # Get short
            stmt = select(Short).where(Short.id == short_id).limit(1)
            result = await session.execute(stmt)
            short = result.scalar_one_or_none()

            if not short or not short.output_object_key:
                raise ValueError(f"Short not found or not ready: {short_id}")

            # Check/refresh access token if expiring within 7 days
            access_token = social_account.access_token
            now = datetime.now(timezone.utc)
            buffer_days = 7  # Instagram tokens last 60 days, refresh when 7 days left

            if social_account.token_expires_at <= now + __import__('datetime').timedelta(days=buffer_days):
                self.logger.info("Refreshing Instagram access token", job_id=job.id)
                new_tokens = await refresh_instagram_token(access_token)
                access_token = new_tokens["access_token"]

                await session.execute(
                    update(SocialAccount)
                    .where(SocialAccount.id == social_account_id)
                    .values(
                        access_token=new_tokens["access_token"],
                        refresh_token=new_tokens["access_token"],  # Instagram uses same token
                        token_expires_at=new_tokens["expires_at"],
                        updated_at=now,
                    )
                )
                await session.commit()

            # Generate presigned URL for Instagram to fetch the video
            # Instagram requires a publicly accessible URL
            video_url = await generate_presigned_url(
                self.config,
                self.config.TIGRIS_BUCKET,
                short.output_object_key,
                expires_in=3600,  # 1 hour
            )

            # Upload to Instagram as Reel
            result = await upload_reel(
                access_token=access_token,
                user_id=social_account.channel_id,  # Instagram user ID
                video_url=video_url,
                caption=caption,
            )

            media_id = result["mediaId"]
            media_url = result["url"]

            # Update scheduled_post to published
            await session.execute(
                update(ScheduledPost)
                .where(ScheduledPost.id == scheduled_post_id)
                .values(
                    status=ScheduledPostStatus.PUBLISHED.value,
                    platform_post_id=media_id,
                    platform_url=media_url,
                    published_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
            )
            await session.commit()

            self.logger.info(
                "✅ Instagram publish completed",
                job_id=job.id,
                media_id=media_id,
                url=media_url,
            )

            return {
                "message": "Reel published successfully",
                "mediaId": media_id,
                "url": media_url,
                "scheduledPostId": scheduled_post_id,
            }

        except Exception as e:
            error_message = str(e)
            self.logger.error(
                "Instagram publish failed",
                job_id=job.id,
                scheduled_post_id=scheduled_post_id,
                error=error_message,
                retry_count=current_retry,
            )

            # Check if we should retry
            if current_retry < MAX_RETRIES - 1:
                # Increment retry count and set to scheduled for retry
                await session.execute(
                    update(ScheduledPost)
                    .where(ScheduledPost.id == scheduled_post_id)
                    .values(
                        retry_count=current_retry + 1,
                        error_message=error_message,
                        status=ScheduledPostStatus.SCHEDULED.value,  # Back to scheduled for retry
                        # Set next retry time with exponential backoff
                        scheduled_for=datetime.now(timezone.utc) + __import__('datetime').timedelta(
                            seconds=[30, 120, 600][current_retry]  # 30s, 2min, 10min
                        ),
                        updated_at=datetime.now(timezone.utc),
                    )
                )
                await session.commit()
                self.logger.info(
                    f"Scheduled retry {current_retry + 1}/{MAX_RETRIES}",
                    job_id=job.id,
                    scheduled_post_id=scheduled_post_id,
                )
                # Don't re-raise - let the job succeed so scheduler can retry
                return {
                    "message": f"Publish failed, retry {current_retry + 1}/{MAX_RETRIES} scheduled",
                    "scheduledPostId": scheduled_post_id,
                    "error": error_message,
                }
            else:
                # Max retries exceeded, mark as failed
                await session.execute(
                    update(ScheduledPost)
                    .where(ScheduledPost.id == scheduled_post_id)
                    .values(
                        status=ScheduledPostStatus.FAILED.value,
                        error_message=error_message,
                        updated_at=datetime.now(timezone.utc),
                    )
                )
                await session.commit()
                raise
