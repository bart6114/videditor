"""Database connection and session management."""

from typing import AsyncGenerator
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

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

    # Convert postgres:// to postgresql+asyncpg:// and fix SSL params
    database_url = config.DATABASE_URL
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    # Parse URL and convert sslmode to ssl for asyncpg
    parsed = urlparse(database_url)
    query_params = parse_qs(parsed.query)

    # Convert sslmode to ssl (asyncpg uses 'ssl' not 'sslmode')
    if "sslmode" in query_params:
        sslmode = query_params["sslmode"][0]
        del query_params["sslmode"]
        # Map common sslmode values to asyncpg's ssl parameter
        if sslmode in ("require", "verify-ca", "verify-full"):
            query_params["ssl"] = ["true"]

    # Rebuild query string
    new_query = urlencode(query_params, doseq=True)
    database_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment,
    ))

    _engine = create_async_engine(
        database_url,
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
