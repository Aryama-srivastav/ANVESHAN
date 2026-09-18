from __future__ import annotations

import os
import sys
import logging
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Make the backend app importable from this script regardless of working dir.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models import Base  # noqa: E402

logger = logging.getLogger('alembic')

config = context.config

# Override the SQLAlchemy URL from the environment when available.
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL:
    config.set_main_option('sqlalchemy.url', DATABASE_URL)
    logger.info('alembic.env: DATABASE_URL set from environment')

# Log the dialect so we can confirm which DB we're connecting to.
dialect = (DATABASE_URL or config.get_main_option('sqlalchemy.url') or 'unknown').split(':')[0]
logger.info('alembic.env: target dialect = %s', dialect)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def run_migrations_offline() -> None:
    url = config.get_main_option('sqlalchemy.url')
    logger.info('alembic.env: running OFFLINE migrations (no DB connection)')
    context.configure(
        url=url,
        target_metadata=Base.metadata,
        literal_binds=True,
        dialect_opts={'paramstyle': 'named'},
        compare_type=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    logger.info('alembic.env: running ONLINE migrations')
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=Base.metadata,
            compare_type=True,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    logger.info('alembic.env: ONLINE migrations completed')


if context.is_offline_mode():
    logger.info('alembic.env: offline mode detected')
    run_migrations_offline()
else:
    logger.info('alembic.env: online mode detected')
    run_migrations_online()
