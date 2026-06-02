"""FastAPI REST server for greeter service."""

import json
import os
import threading
from collections.abc import Mapping
from contextlib import asynccontextmanager
from typing import Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from news_fetcher import OUTPUT_FILE
from news_fetcher.run_news_pipeline import start_analysis

from .api.controllers.portfolio_controller import PortfolioController
from .api.deps import get_portfolio_service
from .api.routes.ai_routes import router as ai_router
from .api.routes.portfolio_routes import router as portfolio_router
from .api.routes.stock_routes import router as stock_router
from .firebase_auth import verify_firebase_id_token
from .firestore_store import get_authenticated_user as load_authenticated_user_profile
from .firestore_store import upsert_authenticated_user
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
    display_name: str | None = None
    photo_url: str | None = None
    provider_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    last_login_at: str | None = None


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
    """Lifespan context manager for FastAPI"""

    def run_pipeline_safely():
        import time
        time.sleep(2.0)
        try:
            start_analysis()
        except Exception as e:
            print(f"❌ Background pipeline crash: {e}")

    pipeline_thread = threading.Thread(target=run_pipeline_safely, daemon=True)
    pipeline_thread.start()

    app.state.http_openrouter = httpx.AsyncClient(
        timeout=httpx.Timeout(90.0, connect=20.0),
        limits=httpx.Limits(max_keepalive_connections=8, max_connections=16),
    )
    try:
        yield
    finally:
        await app.state.http_openrouter.aclose()

def _user_response_from_claims_or_profile(
    user: Mapping[str, Any],
    profile: Mapping[str, Any] | None,
) -> AuthenticatedUserResponse:
    uid = str(user.get("uid", ""))
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    payload = {
        "uid": uid,
        "email": user.get("email"),
        "display_name": user.get("name"),
        "photo_url": user.get("picture"),
        "provider_id": None,
        "created_at": None,
        "updated_at": None,
        "last_login_at": None,
    }

    firebase_claims = user.get("firebase")
    if isinstance(firebase_claims, Mapping):
        provider_id = firebase_claims.get("sign_in_provider")
        if provider_id is not None:
            payload["provider_id"] = str(provider_id)

    if profile is not None:
        payload.update(
            {
                "email": profile.get("email", payload["email"]),
                "display_name": profile.get("display_name", payload["display_name"]),
                "photo_url": profile.get("photo_url", payload["photo_url"]),
                "provider_id": profile.get("provider_id", payload["provider_id"]),
                "created_at": profile.get("created_at"),
                "updated_at": profile.get("updated_at"),
                "last_login_at": profile.get("last_login_at"),
            }
        )

    return AuthenticatedUserResponse(**payload)


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

    @app.get("/api/news")
    async def get_news_data():
        if os.path.exists(OUTPUT_FILE):
            with open(OUTPUT_FILE, encoding="utf-8") as f:
                data = json.load(f)
            return JSONResponse(content=data)
        else:
            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "message": (
                        "AI News Pipeline is running for the first time. "
                        "Please refresh in a few seconds."
                    )
                },
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
        """Return the Firestore-backed profile for a verified Firebase user."""
        uid = str(user.get("uid", ""))
        profile = load_authenticated_user_profile(uid)
        if profile is None:
            profile = upsert_authenticated_user(user)
        return _user_response_from_claims_or_profile(user, profile)

    @app.post("/api/v1/auth/session")
    async def create_auth_session(
        user: Mapping[str, Any] = Depends(get_current_user),
    ) -> AuthenticatedUserResponse:
        """Create or refresh the Firestore-backed profile for a signed-in user."""
        profile = upsert_authenticated_user(user)
        return _user_response_from_claims_or_profile(user, profile)

    @app.post("/api/paper-portfolio", status_code=201, tags=["portfolio"])
    def paper_portfolio_compat(payload: dict) -> dict:
        controller = PortfolioController(get_portfolio_service())
        return controller.create_paper_portfolio(payload)

    return app


if __name__ == "__main__":
    import uvicorn

    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=8000)
