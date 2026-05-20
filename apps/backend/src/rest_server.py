"""FastAPI REST server for greeter service."""

from collections.abc import Mapping
from contextlib import asynccontextmanager
from typing import Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .api.routes.ai_routes import router as ai_router
from .api.routes.stock_routes import router as stock_router
from .api.routes.portfolio_routes import router as portfolio_router
from .firebase_auth import verify_firebase_id_token
from .services import GreeterService


class HelloRequest(BaseModel):
    """Request model for hello endpoint."""

    name: str


class HelloResponse(BaseModel):
    """Response model for hello endpoint."""

    message: str


class HelloPatchRequest(BaseModel):
    """Patch request model for hello endpoint."""

    suffix: str = "!"


class HelloBatchRequest(BaseModel):
    """Request model for batch hello endpoint."""

    names: list[str]


class AuthenticatedUserResponse(BaseModel):
    """Response model for authenticated user endpoint."""

    uid: str
    email: str | None = None


def get_current_user(
    authorization: str | None = Header(default=None),
) -> Mapping[str, Any]:
    """Extract and verify Firebase ID token from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    try:
        return verify_firebase_id_token(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc


@asynccontextmanager
async def _rest_lifespan(app: FastAPI):
    """Shared HTTP client for OpenRouter (keep-alive)."""
    app.state.http_openrouter = httpx.AsyncClient(
        timeout=httpx.Timeout(90.0, connect=20.0),
        limits=httpx.Limits(max_keepalive_connections=8, max_connections=16),
    )
    try:
        yield
    finally:
        await app.state.http_openrouter.aclose()


def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application.

    Returns:
        Configured FastAPI application.
    """
    app = FastAPI(
        title="OptiTrade API",
        description="RESTful API for OptiTrade services",
        version="0.1.0",
        lifespan=_rest_lifespan,
    )

    # Allow frontend dev servers to call REST endpoints from the browser.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:4200",
            "http://127.0.0.1:4200",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(stock_router, prefix="/api/stock", tags=["stock"])
    app.include_router(ai_router, prefix="/api/ai", tags=["ai"])
    app.include_router(portfolio_router, prefix="/api/portfolio", tags=["portfolio"])


    service = GreeterService()

    @app.get("/health")
    async def health_check() -> dict:
        """Health check endpoint."""
        return {"status": "healthy"}

    @app.post("/api/v1/hello")
    async def say_hello(request: HelloRequest) -> HelloResponse:
        """
        Say hello to a name.

        Args:
            request: The hello request with a name.

        Returns:
            A hello response with the greeting message.
        """
        message = service.say_hello(request.name)
        return HelloResponse(message=message)

    @app.get("/api/v1/hello/{name}")
    async def say_hello_path(name: str) -> HelloResponse:
        """
        Say hello to a name using path parameter.

        Args:
            name: The name to greet.

        Returns:
            A hello response with the greeting message.
        """
        message = service.say_hello(name)
        return HelloResponse(message=message)

    @app.put("/api/v1/hello/{name}")
    async def say_hello_put(name: str) -> HelloResponse:
        """Say hello using PUT to validate idempotent update-style semantics."""
        message = service.say_hello_with_prefix(name, prefix="Hello (PUT)")
        return HelloResponse(message=message)

    @app.patch("/api/v1/hello/{name}")
    async def say_hello_patch(name: str, request: HelloPatchRequest) -> HelloResponse:
        """Partially customize hello output via PATCH."""
        message = service.say_hello_with_suffix(name, suffix=request.suffix)
        return HelloResponse(message=message)

    @app.delete("/api/v1/hello/{name}")
    async def say_hello_delete(name: str) -> HelloResponse:
        """Return goodbye message via DELETE."""
        message = service.say_goodbye(name)
        return HelloResponse(message=message)

    @app.post("/api/v1/hello/batch")
    async def say_hello_batch(request: HelloBatchRequest) -> HelloResponse:
        """Create a single response from multiple names."""
        message = service.aggregate_hellos(request.names)
        return HelloResponse(message=message)

    @app.get("/api/v1/auth/me")
    async def get_authenticated_user(
        user: Mapping[str, Any] = Depends(get_current_user),
    ) -> AuthenticatedUserResponse:
        """Return basic profile data for a verified Firebase-authenticated user."""
        uid = str(user.get("uid", ""))
        if not uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        email_value = user.get("email")
        email = str(email_value) if email_value is not None else None
        return AuthenticatedUserResponse(uid=uid, email=email)


    @app.post("/api/paper-portfolio", status_code=201, tags=["portfolio"])
    def paper_portfolio_compat(payload: dict) -> dict:
        controller = PortfolioController(get_portfolio_service())
        return controller.create_paper_portfolio(payload)

    return app


if __name__ == "__main__":
    import uvicorn

    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=8000)
