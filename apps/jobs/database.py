"""Database connection and session management."""

import ssl
from typing import AsyncGenerator
from urllib.parse import urlparse, urlunparse

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from config import JobRunnerConfig

# Global engine and session factory
_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def init_db(config: JobRunnerConfig) -> AsyncEngine:
    """
    Initialize the database engine and session factory.

    Args:
        config: Job runner configuration

    Returns:
        Async SQLAlchemy engine
    """
    global _engine, _session_factory

    # Convert postgres:// to postgresql+asyncpg://
    database_url = config.DATABASE_URL
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    # Parse URL and strip query parameters that asyncpg doesn't support
    # Neon provides: ?sslmode=require&channel_binding=require
    # asyncpg doesn't support these as connection kwargs (only in DSN format)
    parsed = urlparse(database_url)

    # Remove query string entirely and handle SSL via connect_args
    clean_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        "",  # Empty query string
        parsed.fragment,
    ))

    # Create SSL context for secure connections to Neon
    # Neon requires SSL but typically doesn't require certificate verification
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    _engine = create_async_engine(
        clean_url,
        connect_args={"ssl": ssl_context},
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=config.NODE_ENV == "development",
    )

    _session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """
    Get the session factory.

    Returns:
        Async session factory

    Raises:
        RuntimeError: If database is not initialized
    """
    if _session_factory is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Get a database session.

    Yields:
        Async database session
    """
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def close_db() -> None:
    """Close the database engine."""
    global _engine
    if _engine:
        await _engine.dispose()
        _engine = None
