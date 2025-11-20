"""Main entry point for the VidEditor.ai jobs worker."""

import asyncio
import signal
import sys

import uvicorn
from dotenv import load_dotenv

from config import load_job_config
from database import close_db, init_db
from logger import create_logger
from processor import JobProcessor
from server import build_job_server
from worker import JobWorker


async def main() -> None:
    """Main application entry point."""
    # Load environment variables
    # .env.local takes precedence over .env
    load_dotenv("../../.env.local", override=True)
    load_dotenv("../../.env")

    # Load configuration
    config = load_job_config()

    # Initialize database
    init_db(config)

    # Create logger
    logger = create_logger(config)
    logger.info("Starting VidEditor.ai jobs worker")

    # Create job processor
    processor = JobProcessor(config, logger)

    # Create worker
    worker = JobWorker(config, logger, processor)

    # Build FastAPI app
    app = build_job_server(
        config,
        get_worker_stats=lambda: {"activeJobs": worker.get_active_job_count()},
    )

    # Create uvicorn config
    uvicorn_config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=config.PORT,
        log_config=None,  # Disable uvicorn's logging, use structlog
        access_log=False,
    )
    server = uvicorn.Server(uvicorn_config)

    # Setup graceful shutdown
    shutdown_event = asyncio.Event()

    def signal_handler(sig: int) -> None:
        """Handle shutdown signals."""
        signal_name = signal.Signals(sig).name
        logger.info(f"{signal_name} received, starting graceful shutdown")
        shutdown_event.set()

    # Register signal handlers
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda s=sig: signal_handler(s))

    try:
        # Start worker
        await worker.start()
        logger.info("Job worker started")

        # Start HTTP server in background
        server_task = asyncio.create_task(server.serve())
        logger.info(f"Job runner HTTP server listening on port {config.PORT}")

        # Wait for shutdown signal
        await shutdown_event.wait()

    except Exception as error:
        logger.error("Failed to start job runner", error=str(error), exc_info=True)
        sys.exit(1)

    finally:
        # Graceful shutdown
        logger.info("Starting graceful shutdown")

        try:
            # Stop worker first (waits for active jobs)
            await worker.stop()

            # Stop HTTP server
            server.should_exit = True
            await server_task

            # Close database connection
            await close_db()

            logger.info("Graceful shutdown complete")

        except Exception as error:
            logger.error("Error during shutdown", error=str(error), exc_info=True)
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
