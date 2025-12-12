"""Database models and type definitions."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel
from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Boolean,
    Column,
    Double,
    Float,
    Index,
    MetaData,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import declarative_base

# SQLAlchemy metadata
metadata = MetaData()
Base = declarative_base(metadata=metadata)


# Enums
class JobType(str, Enum):
    """Job type enumeration."""

    THUMBNAIL = "thumbnail"
    TRANSCRIPTION = "transcription"
    ANALYSIS = "analysis"
    SHORT_PROCESSING = "short_processing"
    YOUTUBE_PUBLISH = "youtube_publish"
    INSTAGRAM_PUBLISH = "instagram_publish"


class JobStatus(str, Enum):
    """Job status enumeration."""

    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"


class ProjectStatus(str, Enum):
    """Project status enumeration."""

    UPLOADING = "uploading"
    READY = "ready"
    QUEUED = "queued"
    PROCESSING = "processing"
    TRANSCRIBING = "transcribing"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    ERROR = "error"


class ShortStatus(str, Enum):
    """Short status enumeration."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"


class ShortTaskStatus(str, Enum):
    """Short task status enumeration."""

    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"
    SKIPPED = "skipped"


class SocialPlatform(str, Enum):
    """Social platform enumeration."""

    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    INSTAGRAM = "instagram"


class ScheduledPostStatus(str, Enum):
    """Scheduled post status enumeration."""

    SCHEDULED = "scheduled"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED = "failed"
    CANCELED = "canceled"


class InboxMessageType(str, Enum):
    """Inbox message type enumeration."""

    ERROR = "error"
    INFO = "info"
    ANNOUNCEMENT = "announcement"


# SQLAlchemy ORM Models
class Organization(Base):
    """Organization database model."""

    __tablename__ = "organizations"

    id = Column(String(255), primary_key=True)
    name = Column(Text, nullable=False)
    slug = Column(String(255), nullable=False, unique=True, index=True)
    credits = Column(BigInteger, nullable=False, default=0)
    stripe_customer_id = Column(String(255), nullable=True)
    auto_top_up_enabled = Column(Boolean, nullable=False, default=False)
    auto_top_up_threshold = Column(BigInteger, nullable=False, default=5)
    auto_top_up_amount = Column(BigInteger, nullable=False, default=10)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ProcessingJob(Base):
    """Processing job database model."""

    __tablename__ = "processing_jobs"

    id = Column(String(255), primary_key=True)
    project_id = Column(String(255), nullable=True, index=True)
    short_id = Column(String(255), nullable=True)
    type = Column(ENUM('thumbnail', 'transcription', 'analysis', 'short_processing', 'youtube_publish', 'instagram_publish', name='job_type', create_type=False), nullable=False, index=True)
    status = Column(ENUM('queued', 'running', 'succeeded', 'failed', 'canceled', name='job_status', create_type=False), nullable=False, default="queued", index=True)
    payload = Column(JSONB, nullable=True)
    result = Column(JSONB, nullable=True)
    progress = Column(JSONB, nullable=True)  # {phase: 'analyzing'|'generating', current: N, total: M}
    error_message = Column(Text, nullable=True)
    started_at = Column(TIMESTAMP(timezone=True), nullable=True)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Indexes are defined in the table definition via Column(index=True)
    # Additional composite indexes would go here
    __table_args__ = (
        Index("idx_processing_jobs_project_id", "project_id"),
        Index("idx_processing_jobs_status", "status"),
        Index("idx_processing_jobs_type", "type"),
    )


class Project(Base):
    """Project database model."""

    __tablename__ = "projects"

    id = Column(String(255), primary_key=True)
    organization_id = Column(String(255), nullable=False, index=True)
    created_by_id = Column(String(255), nullable=True)  # User who created the project
    title = Column(Text, nullable=False)
    source_object_key = Column(Text, nullable=False)
    source_bucket = Column(Text, nullable=False)
    thumbnail_url = Column(Text, nullable=True)
    duration_seconds = Column(Double, nullable=True)
    file_size_bytes = Column(BigInteger, nullable=True)
    status = Column(ENUM('uploading', 'ready', 'queued', 'processing', 'transcribing', 'analyzing', 'completed', 'error', name='project_status', create_type=False), nullable=False, default="uploading")
    priority = Column(Float, nullable=True, default=0)
    error_message = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)


class Transcription(Base):
    """Transcription database model."""

    __tablename__ = "transcriptions"

    id = Column(String(255), primary_key=True)
    project_id = Column(String(255), nullable=False, index=True)
    text = Column(Text, nullable=False)
    segments = Column(JSONB, nullable=False, default=[])
    language = Column(String(16), nullable=True)
    duration_seconds = Column(Double, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class Short(Base):
    """Short clip database model."""

    __tablename__ = "shorts"

    id = Column(String(255), primary_key=True)
    project_id = Column(String(255), nullable=False, index=True)
    analysis_job_id = Column(String(255), nullable=True)  # FK to processing_jobs
    transcription_slice = Column(Text, nullable=False)
    start_time = Column(Double, nullable=False)
    end_time = Column(Double, nullable=False)
    output_object_key = Column(Text, nullable=True)
    thumbnail_url = Column(Text, nullable=True)
    status = Column(ENUM('pending', 'processing', 'completed', 'error', name='short_status', create_type=False), nullable=False, default="pending")
    error_message = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    social_content = Column(JSONB, nullable=True)  # Generated social media content per platform
    tasks = Column(JSONB, nullable=True)  # {clip_extraction, thumbnail_extraction, social_content} task statuses
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class SocialAccount(Base):
    """Social account database model for connected platforms."""

    __tablename__ = "social_accounts"

    id = Column(String(255), primary_key=True)
    organization_id = Column(String(255), nullable=False, index=True)
    platform = Column(ENUM('youtube', 'tiktok', 'instagram', name='social_platform', create_type=False), nullable=False)
    channel_id = Column(String(255), nullable=True)
    channel_title = Column(String(255), nullable=True)
    channel_thumbnail = Column(Text, nullable=True)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=False)
    token_expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    scopes = Column(JSONB, nullable=True, default=[])
    connected_by_id = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ScheduledPost(Base):
    """Scheduled post database model for social media publishing."""

    __tablename__ = "scheduled_posts"

    id = Column(String(255), primary_key=True)
    organization_id = Column(String(255), nullable=False, index=True)
    short_id = Column(String(255), nullable=False, index=True)
    social_account_id = Column(String(255), nullable=False)
    scheduled_for = Column(TIMESTAMP(timezone=True), nullable=False, index=True)
    status = Column(ENUM('scheduled', 'publishing', 'published', 'failed', name='scheduled_post_status', create_type=False), nullable=False, default="scheduled")
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    platform_post_id = Column(String(255), nullable=True)  # YouTube video ID
    platform_url = Column(Text, nullable=True)  # YouTube URL after publish
    error_message = Column(Text, nullable=True)
    retry_count = Column(BigInteger, nullable=False, default=0)
    scheduled_by_id = Column(String(255), nullable=True)
    published_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_scheduled_posts_status_scheduled", "status", "scheduled_for"),
    )


class InboxMessage(Base):
    """Inbox message database model for user notifications."""

    __tablename__ = "inbox_messages"

    id = Column(String(255), primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    type = Column(ENUM('error', 'info', 'announcement', name='inbox_message_type', create_type=False), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    action_url = Column(String(2048), nullable=True)
    action_label = Column(String(100), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    read_at = Column(TIMESTAMP(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_inbox_messages_user_id", "user_id"),
        Index("idx_inbox_messages_user_unread", "user_id", "is_read"),
        Index("idx_inbox_messages_created_at", "created_at"),
    )


# Pydantic Models for validation and serialization
class TranscriptWord(BaseModel):
    """Single word from transcription with timing and speaker info."""

    start: float
    end: float
    text: str
    speaker: str | None = None  # Speaker ID from diarization (e.g., "0", "1")
    confidence: float | None = None  # Confidence score from Deepgram


class TranscriptionResult(BaseModel):
    """Result from transcription processing."""

    text: str
    words: list[TranscriptWord]
    language: str


class JobPayload(BaseModel):
    """Generic job payload."""

    projectId: Optional[str] = None
    shortId: Optional[str] = None
    sourceObjectKey: Optional[str] = None
    sourceBucket: Optional[str] = None


class JobResult(BaseModel):
    """Generic job result."""

    success: bool
    data: Optional[dict[str, Any]] = None
    error: Optional[str] = None


class TranscriptionJobResult(BaseModel):
    """Result from transcription job."""

    textLength: int
    segmentCount: int
    language: str
    transcriptionId: str


class YouTubePublishPayload(BaseModel):
    """Payload for YouTube publish job."""

    scheduledPostId: str
    shortId: str
    socialAccountId: str
    title: str
    description: Optional[str] = None


class YouTubePublishResult(BaseModel):
    """Result from YouTube publish job."""

    videoId: str
    url: str
    scheduledPostId: str


class InstagramPublishPayload(BaseModel):
    """Payload for Instagram publish job."""

    scheduledPostId: str
    shortId: str
    socialAccountId: str
    caption: str


class InstagramPublishResult(BaseModel):
    """Result from Instagram publish job."""

    mediaId: str
    url: str
    scheduledPostId: str


# Social Content Models for Structured Outputs
class YouTubeSocialContent(BaseModel):
    """YouTube social content with title and description."""

    title: str
    description: str


class InstagramSocialContent(BaseModel):
    """Instagram social content with caption."""

    caption: str


class TikTokSocialContent(BaseModel):
    """TikTok social content with caption."""

    caption: str


class LinkedInSocialContent(BaseModel):
    """LinkedIn social content with caption."""

    caption: str
