"""FastAPI entrypoint."""

import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes.admin import router as admin_router
from backend.api.routes.health import router as health_router
from backend.api.routes.webhooks import router as webhook_router
from backend.core.config import get_cors_origins, settings
from backend.core.errors import register_exception_handlers
from backend.core.logging import setup_logging
from backend.core.request_context import new_request_id, set_request_id

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    """Attach request id and emit structured access logs."""
    request_id = request.headers.get("x-request-id") or new_request_id()
    set_request_id(request_id)
    start_time = time.perf_counter()

    response = await call_next(request)

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
    response.headers["x-request-id"] = request_id
    logger.info(
        "request_completed",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "elapsed_ms": elapsed_ms,
        },
    )
    return response


register_exception_handlers(app)
app.include_router(health_router, prefix="/api")
app.include_router(webhook_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
