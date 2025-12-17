"""FastAPI HTTP server for health checks and monitoring."""

from datetime import datetime, timezone
from typing import Any, Callable

from fastapi import FastAPI
from prometheus_client import Gauge, make_asgi_app
from pydantic import BaseModel

from config import JobRunnerConfig

# Prometheus gauge for active jobs (uses callback for dynamic value)
active_jobs_gauge = Gauge(
    "videditor_jobs_active",
    "Number of jobs currently being processed",
)


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str
    timestamp: str
    worker: dict[str, int]


def build_job_server(
    config: JobRunnerConfig,
    get_worker_stats: Callable[[], dict[str, int]] | None = None,
) -> FastAPI:
    """
    Build FastAPI application for job runner.

    Args:
        config: Job runner configuration
        get_worker_stats: Optional callback to get worker statistics

    Returns:
        Configured FastAPI application
    """
    app = FastAPI(
        title="VidEditor.ai Jobs Worker",
        description="Job processing worker for VidEditor.ai",
        version="1.0.0",
    )

    # Store config and worker stats getter
    app.state.config = config
    app.state.get_worker_stats = get_worker_stats

    # Set gauge callback for dynamic active job count
    if get_worker_stats:
        active_jobs_gauge.set_function(lambda: get_worker_stats().get("activeJobs", 0))

    # Mount Prometheus metrics endpoint
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

    @app.get("/healthz", response_model=HealthResponse)
    async def health_check() -> HealthResponse:
        """
        Health check endpoint.

        Returns:
            Health status with worker statistics
        """
        stats = {"activeJobs": 0}
        if app.state.get_worker_stats:
            stats = app.state.get_worker_stats()

        return HealthResponse(
            status="ok",
            timestamp=datetime.now(timezone.utc).isoformat(),
            worker={
                "concurrency": config.JOB_CONCURRENCY,
                "activeJobs": stats.get("activeJobs", 0),
            },
        )

    return app
