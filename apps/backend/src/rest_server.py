"""FastAPI REST server for greeter service."""

from fastapi import FastAPI
from pydantic import BaseModel

from .services import GreeterService


class HelloRequest(BaseModel):
    """Request model for hello endpoint."""

    name: str


class HelloResponse(BaseModel):
    """Response model for hello endpoint."""

    message: str


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
    )

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

    return app


if __name__ == "__main__":
    import uvicorn

    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=8000)
