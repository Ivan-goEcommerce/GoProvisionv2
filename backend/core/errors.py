"""Custom application errors and handlers."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError as PostgrestApiError

from backend.core.request_context import get_request_id

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Controlled business error."""

    def __init__(self, error: str, message: str, status_code: int) -> None:
        self.error = error
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def register_exception_handlers(app: FastAPI) -> None:
    """Bind global exception handlers to app."""

    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.error,
                "message": exc.message,
                "request_id": get_request_id(),
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": "validation_error",
                "message": "Invalid request payload.",
                "request_id": get_request_id(),
                "details": exc.errors(),
            },
        )

    @app.exception_handler(PostgrestApiError)
    async def postgrest_error_handler(
        _: Request, exc: PostgrestApiError
    ) -> JSONResponse:
        logger.exception("Supabase request failed: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": "supabase_error",
                "message": "Database request failed.",
                "request_id": get_request_id(),
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled server error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_server_error",
                "message": "Internal server error.",
                "request_id": get_request_id(),
            },
        )
