"""PostHog LLM Analytics integration for OpenAI and OpenRouter calls."""

from typing import Any

import posthog
import structlog
from openai import AsyncOpenAI

logger = structlog.get_logger()

# Module-level state for lazy initialization
_posthog_initialized = False


def _ensure_posthog_initialized() -> bool:
    """
    Lazily initialize PostHog client from config.

    Returns True if PostHog is configured and ready, False otherwise.
    """
    global _posthog_initialized

    if _posthog_initialized:
        return True

    # Import here to avoid circular imports
    from config import load_job_config

    try:
        config = load_job_config()
    except Exception as e:
        logger.warning("posthog_config_load_failed", error=str(e))
        return False

    if not config.POSTHOG_API_KEY:
        logger.debug("posthog_not_configured", reason="POSTHOG_API_KEY not set")
        return False

    # PostHog SDK requires api_key (not project_api_key) for capture() calls
    posthog.api_key = config.POSTHOG_API_KEY
    posthog.project_api_key = config.POSTHOG_API_KEY
    posthog.host = config.POSTHOG_HOST

    _posthog_initialized = True
    logger.info(
        "posthog_initialized",
        host=config.POSTHOG_HOST,
    )
    return True


def get_openai_client(
    api_key: str,
    timeout: float = 600.0,
    **kwargs: Any,
) -> AsyncOpenAI:
    """
    Get an OpenAI client, optionally wrapped with PostHog analytics.

    If PostHog is configured (POSTHOG_API_KEY set), returns a wrapped client
    that automatically captures LLM analytics. Otherwise, returns a standard
    AsyncOpenAI client.

    Args:
        api_key: OpenAI API key
        timeout: Request timeout in seconds (default: 600)
        **kwargs: Additional arguments passed to AsyncOpenAI

    Returns:
        AsyncOpenAI client (wrapped or standard)
    """
    if _ensure_posthog_initialized():
        try:
            from posthog.ai.openai import AsyncOpenAI as PostHogAsyncOpenAI

            return PostHogAsyncOpenAI(
                api_key=api_key,
                timeout=timeout,
                posthog_client=posthog,
                **kwargs,
            )
        except ImportError:
            logger.warning("posthog_ai_import_failed", fallback="standard_client")

    # Fallback to standard client
    return AsyncOpenAI(api_key=api_key, timeout=timeout, **kwargs)


def get_openrouter_client(
    api_key: str,
    timeout: float = 120.0,
    **kwargs: Any,
) -> AsyncOpenAI:
    """
    Get an OpenRouter client using OpenAI SDK, optionally wrapped with PostHog.

    OpenRouter is OpenAI-compatible, so we use the OpenAI SDK with a custom
    base_url. If PostHog is configured, the client is wrapped for analytics.

    Args:
        api_key: OpenRouter API key
        timeout: Request timeout in seconds (default: 120)
        **kwargs: Additional arguments passed to AsyncOpenAI

    Returns:
        AsyncOpenAI client configured for OpenRouter
    """
    default_headers = kwargs.pop("default_headers", {})
    default_headers["HTTP-Referer"] = "https://videditor.app"

    if _ensure_posthog_initialized():
        try:
            from posthog.ai.openai import AsyncOpenAI as PostHogAsyncOpenAI

            return PostHogAsyncOpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1",
                timeout=timeout,
                default_headers=default_headers,
                posthog_client=posthog,
                **kwargs,
            )
        except ImportError:
            logger.warning("posthog_ai_import_failed", fallback="standard_client")

    # Fallback to standard client
    return AsyncOpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        timeout=timeout,
        default_headers=default_headers,
        **kwargs,
    )


def shutdown_posthog() -> None:
    """Flush pending events and shutdown PostHog client."""
    if _posthog_initialized:
        try:
            posthog.shutdown()
            logger.info("posthog_shutdown")
        except Exception as e:
            logger.warning("posthog_shutdown_failed", error=str(e))
