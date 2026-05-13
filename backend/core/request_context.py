"""Request-scoped context helpers."""

import uuid
from contextvars import ContextVar


request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")


def new_request_id() -> str:
    """Create a new request id."""
    return uuid.uuid4().hex


def set_request_id(request_id: str) -> None:
    """Store request id in context var."""
    request_id_ctx.set(request_id)


def get_request_id() -> str:
    """Read request id from context var."""
    return request_id_ctx.get()
