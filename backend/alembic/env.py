from logging.config import fileConfig
import time

from sqlalchemy import engine_from_config, create_engine
from sqlalchemy import pool

from alembic import context

# Import your application's database configuration
from app.database import Base
from app.config import settings

# Important: import models so SQLAlchemy registers all tables
from app import models


# Alembic Config object
config = context.config


# Use the same database URL as your FastAPI application
config.set_main_option(
    "sqlalchemy.url",
    settings.sqlalchemy_database_url
)


# Configure logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# Tell Alembic about all SQLAlchemy models
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Build the engine directly so we can pass connect_args for Neon SSL
    connectable = create_engine(
        settings.sqlalchemy_database_url,
        poolclass=pool.NullPool,
        connect_args={
            "sslmode": "require",
            "connect_timeout": 30,
        },
    )

    # Retry loop for Neon serverless cold-start transient failures
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            with connectable.connect() as connection:
                context.configure(
                    connection=connection,
                    target_metadata=target_metadata,
                    compare_type=True,
                )

                with context.begin_transaction():
                    context.run_migrations()
            break  # success
        except Exception as exc:
            if attempt < max_retries:
                print(f"Connection attempt {attempt}/{max_retries} failed: {exc}")
                print(f"Retrying in 5 seconds...")
                time.sleep(5)
            else:
                raise


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()