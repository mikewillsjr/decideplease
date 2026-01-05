"""Structured logging configuration for DecidePlease."""

import os
import sys
import logging
import structlog
from typing import Any


def configure_logging():
    """
    Configure structured logging for the application.

    In production (JSON format):
    - Outputs JSON logs for easy parsing by log aggregators
    - Includes timestamp, level, event, and any additional context

    In development (console format):
    - Pretty-printed, colored output
    - Easier to read for debugging
    """
    is_production = (
        os.getenv("RENDER") == "true" or
        os.getenv("PRODUCTION") == "true" or
        os.getenv("NODE_ENV") == "production" or
        os.getenv("ENVIRONMENT") == "production"
    )

    # Shared processors for both dev and prod
    shared_processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if is_production:
        # Production: JSON output for log aggregation
        structlog.configure(
            processors=shared_processors + [
                structlog.processors.format_exc_info,
                structlog.processors.JSONRenderer(),
            ],
            wrapper_class=structlog.stdlib.BoundLogger,
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )
    else:
        # Development: Pretty console output
        structlog.configure(
            processors=shared_processors + [
                structlog.processors.format_exc_info,
                structlog.dev.ConsoleRenderer(colors=True),
            ],
            wrapper_class=structlog.stdlib.BoundLogger,
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )

    # Configure standard library logging to work with structlog
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO if is_production else logging.DEBUG,
    )


def get_logger(name: str = None) -> structlog.stdlib.BoundLogger:
    """
    Get a configured logger instance.

    Args:
        name: Logger name (typically __name__ of the calling module)

    Returns:
        Configured structlog logger

    Usage:
        from .logging_config import get_logger
        logger = get_logger(__name__)

        logger.info("user_registered", user_id=user_id, email=email)
        logger.error("payment_failed", user_id=user_id, error=str(e))
    """
    return structlog.get_logger(name)


# Initialize logging on module import
configure_logging()

# Create default logger for quick access
logger = get_logger("decideplease")
