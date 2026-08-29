"""Every error response follows the `Error` schema published in
docs/sprint1/executable-architecture/openapi.yaml:

    { "code": <string>, "message": <string>, "fieldErrors"?: {..}, "requestId": <string> }
"""
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# Codes from the openapi.yaml Error.code enum.
VALIDATION_ERROR = "VALIDATION_ERROR"
AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED"
INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
FORBIDDEN = "FORBIDDEN"
NOT_FOUND = "NOT_FOUND"


class ApiError(Exception):
    """Raise anywhere in a request to return a contract-shaped error."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        field_errors: dict[str, str] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field_errors = field_errors
        super().__init__(message)


def _body(code: str, message: str, request: Request, field_errors: dict | None = None) -> dict:
    body: dict = {
        "code": code,
        "message": message,
        "requestId": getattr(request.state, "request_id", str(uuid.uuid4())),
    }
    if field_errors:
        body["fieldErrors"] = field_errors
    return body


def register_error_handlers(app: FastAPI) -> None:
    @app.middleware("http")
    async def _attach_request_id(
        request: Request, call_next: Callable[[Request], Awaitable]
    ):
        request.state.request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-Id"] = request.state.request_id
        return response

    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError):
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(exc.code, exc.message, request, exc.field_errors),
        )

    @app.exception_handler(RequestValidationError)
    async def _request_validation(request: Request, exc: RequestValidationError):
        field_errors: dict[str, str] = {}
        for err in exc.errors():
            path = [p for p in err["loc"] if p not in ("body", "query", "path")]
            field_errors[".".join(str(p) for p in path) or "_"] = err["msg"]
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_body(
                VALIDATION_ERROR,
                "The request could not be validated.",
                request,
                field_errors,
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception(request: Request, exc: StarletteHTTPException):
        code = {
            status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_REQUIRED,
            status.HTTP_403_FORBIDDEN: FORBIDDEN,
            status.HTTP_404_NOT_FOUND: NOT_FOUND,
        }.get(exc.status_code, VALIDATION_ERROR)
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(code, str(exc.detail), request),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        # 500s are outside the documented enum; keep the shape, hide internals.
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_body("INTERNAL_ERROR", "Something went wrong.", request),
        )
