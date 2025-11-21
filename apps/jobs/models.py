"""Database models and type definitions."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel
from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
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
    CUTTING = "cutting"
    DELIVERY = "delivery"


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
    RENDERING = "rendering"
    DELIVERING = "delivering"
    COMPLETED = "completed"
    ERROR = "error"


class ShortStatus(str, Enum):
    """Short status enumeration."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"


# SQLAlchemy ORM Models
class ProcessingJob(Base):
    """Processing job database model."""

    __tablename__ = "processing_jobs"

    id = Column(String(255), primary_key=True)
    project_id = Column(String(255), nullable=True, index=True)
    short_id = Column(String(255), nullable=True)
    type = Column(ENUM('thumbnail', 'transcription', 'analysis', 'cutting', 'delivery', name='job_type', create_type=False), nullable=False, index=True)
    status = Column(ENUM('queued', 'running', 'succeeded', 'failed', 'canceled', name='job_status', create_type=False), nullable=False, default="queued", index=True)
    payload = Column(JSONB, nullable=True)
    result = Column(JSONB, nullable=True)
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
    user_id = Column(String(255), nullable=False, index=True)
    title = Column(Text, nullable=False)
    source_object_key = Column(Text, nullable=False)
    source_bucket = Column(Text, nullable=False)
    thumbnail_url = Column(Text, nullable=True)
    duration_seconds = Column(Double, nullable=True)
    file_size_bytes = Column(BigInteger, nullable=True)
    status = Column(ENUM('uploading', 'ready', 'queued', 'processing', 'transcribing', 'analyzing', 'rendering', 'delivering', 'completed', 'error', name='project_status', create_type=False), nullable=False, default="uploading")
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
    transcription_slice = Column(Text, nullable=False)
    start_time = Column(Double, nullable=False)
    end_time = Column(Double, nullable=False)
    output_object_key = Column(Text, nullable=True)
    thumbnail_url = Column(Text, nullable=True)
    status = Column(ENUM('pending', 'processing', 'completed', 'error', name='short_status', create_type=False), nullable=False, default="pending")
    error_message = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


# Pydantic Models for validation and serialization
class WhisperSegment(BaseModel):
    """Whisper transcription segment."""

    start: float
    end: float
    text: str


class TranscriptionResult(BaseModel):
    """Result from transcription processing."""

    text: str
    segments: list[WhisperSegment]
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
