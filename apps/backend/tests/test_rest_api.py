import pytest
from fastapi.testclient import TestClient

from src import rest_server
from src.rest_server import create_app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    app = create_app()
    return TestClient(app)


def test_health_check(client):
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_say_hello_with_json_payload(client):
    """Test the hello endpoint with JSON payload."""
    response = client.post("/api/v1/hello", json={"name": "World"})
    assert response.status_code == 200
    assert response.json() == {"message": "Hello, World!"}


def test_say_hello_with_path_parameter(client):
    """Test the hello endpoint with path parameter."""
    response = client.get("/api/v1/hello/Alice")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello, Alice!"}


def test_say_hello_returns_expected_format(client):
    """Test that the hello endpoint returns the expected format."""
    response = client.post("/api/v1/hello", json={"name": "pytest"})
    data = response.json()
    assert "message" in data
    assert data["message"] == "Hello, pytest!"


def test_openapi_docs_available(client):
    """Test that OpenAPI documentation is available."""
    response = client.get("/docs")
    assert response.status_code == 200


def test_invalid_request_returns_validation_error(client):
    """Test that invalid requests return validation errors."""
    response = client.post("/api/v1/hello", json={})
    assert response.status_code == 422  # Unprocessable Entity


def test_say_hello_with_put(client):
    """Test the hello endpoint with PUT."""
    response = client.put("/api/v1/hello/Alice")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello (PUT), Alice!"}


def test_say_hello_with_patch(client):
    """Test the hello endpoint with PATCH."""
    response = client.patch("/api/v1/hello/Alice", json={"suffix": "!!!"})
    assert response.status_code == 200
    assert response.json() == {"message": "Hello, Alice!!!"}


def test_say_hello_with_delete(client):
    """Test the hello endpoint with DELETE."""
    response = client.delete("/api/v1/hello/Alice")
    assert response.status_code == 200
    assert response.json() == {"message": "Goodbye, Alice!"}


def test_say_hello_batch(client):
    """Test the batch hello endpoint."""
    response = client.post("/api/v1/hello/batch", json={"names": ["Alice", "Bob"]})
    assert response.status_code == 200
    assert response.json() == {"message": "Hello, Alice! | Hello, Bob!"}


def test_auth_me_requires_bearer_token(client):
    """Test the auth endpoint returns 401 when no bearer token is provided."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json() == {"detail": "Missing bearer token"}


def test_auth_me_with_valid_firebase_token(client, monkeypatch):
    """Test the auth endpoint returns decoded user data for a valid token."""

    def fake_verify(_token: str):
        return {"uid": "user-123", "email": "user@example.com"}

    monkeypatch.setattr(rest_server, "verify_firebase_id_token", fake_verify)

    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer fake-token"}
    )
    assert response.status_code == 200
    assert response.json() == {"uid": "user-123", "email": "user@example.com"}


def test_auth_me_with_invalid_firebase_token(client, monkeypatch):
    """Test the auth endpoint returns 401 when Firebase token verification fails."""

    def fake_verify(_token: str):
        raise ValueError("Invalid token")

    monkeypatch.setattr(rest_server, "verify_firebase_id_token", fake_verify)

    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer bad-token"}
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid token"}
