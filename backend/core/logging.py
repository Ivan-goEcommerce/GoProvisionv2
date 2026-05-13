"""Logging setup for the API."""

import logging
import sys

from pythonjsonlogger import jsonlogger

from backend.core.config import settings
from backend.core.request_context import get_request_id


class RequestIdFilter(logging.Filter):
    """Inject request id into all log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


def setup_logging() -> None:
    """Configure root logger once at app startup."""
    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s"
    )
    handler.setFormatter(formatter)
    handler.addFilter(RequestIdFilter())

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(settings.log_level.upper())
