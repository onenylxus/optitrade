# Backend (apps/backend)

## Overview

OptiTrade backend application with **dual API support**: RESTful API (FastAPI) and gRPC services. Both APIs share a common service layer for business logic, managed by Nx and `@nxlv/python`.

## Prerequisites

- Python 3.9+
- Node.js 18+ and npm (for Nx)

## Nx targets

All commands below run from the repository root.

### Dependency management

```bash
npx nx run @optitrade/backend:install
npx nx run @optitrade/backend:lock
npx nx run @optitrade/backend:sync
npx nx run @optitrade/backend:add
npx nx run @optitrade/backend:update
npx nx run @optitrade/backend:remove
```

### Development and quality

```bash
npx nx run @optitrade/backend:proto
npx nx run @optitrade/backend:lint
npx nx run @optitrade/backend:format
npx nx run @optitrade/backend:test
npx nx run @optitrade/backend:build
```

## What each target does

- `proto`: Generates Python gRPC code from `protos/helloworld.proto`.
- `lint`: Runs Ruff checks on `src` and `tests`.
- `format`: Runs Ruff format on `src` and `tests`.
- `test`: Runs `uv run pytest tests/` and depends on `proto`.
- `build`: Builds a distributable package into `apps/backend/dist`.

## API Architecture

### Shared Service Layer

The backend uses a **shared service layer** pattern to maintain consistency across both APIs:

- **`src/services.py`**: Contains core business logic (`GreeterService`)
- Both REST and gRPC APIs use the same service methods
- Makes it easy to add new features that automatically work with both protocols

### REST API (FastAPI)

**Server**: `src/rest_server.py` runs on `http://0.0.0.0:8000`

Features:
- OpenAPI/Swagger documentation at `/docs`
- JSON request/response format
- Easy HTTP client integration (curl, Postman, browser)
- Automatic request validation via Pydantic

**Key Endpoints**:
- `GET /health` - Health check
- `POST /api/v1/hello` - Greet with JSON body: `{"name": "World"}`
- `GET /api/v1/hello/{name}` - Greet with path parameter

**Example Usage**:
```bash
# Health check
curl http://localhost:8000/health

# Greet with JSON
curl -X POST http://localhost:8000/api/v1/hello \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice"}'

# Greet with path parameter
curl http://localhost:8000/api/v1/hello/Bob
```

### gRPC API

**Server**: `src/greeter_server.py` listens on `[::]:50051`

Features:
- Binary protocol (Protocol Buffers)
- Bidirectional streaming support
- High performance, low latency
- Language-agnostic service definition

**Service Definition** (`protos/helloworld.proto`):
```protobuf
service Greeter {
  rpc SayHello (HelloRequest) returns (HelloReply) {}
}
```

**Example Usage** (Python gRPC client):
```python
import grpc
from protos import helloworld_pb2, helloworld_pb2_grpc

channel = grpc.insecure_channel('localhost:50051')
stub = helloworld_pb2_grpc.GreeterStub(channel)
response = stub.SayHello(helloworld_pb2.HelloRequest(name='World'))
print(response.message)
```

### Running Both Servers Together

```bash
# From apps/backend directory
cd apps/backend

# Option 1: Run REST server only (FastAPI)
python -m src.rest_server

# Option 2: Run gRPC server only
python src/greeter_server.py

# Option 3: Run both servers (REST + gRPC)
python main.py
```

The unified runner (`main.py`) starts:
- gRPC server on port 50051 (background thread)
- REST server on port 8000 (main thread)

## Paths

- Source: `apps/backend/src`
  - `services.py` - Shared service layer with business logic
  - `rest_server.py` - FastAPI REST server
  - `greeter_server.py` - gRPC server implementation
- Tests: `apps/backend/tests`
  - `test_rest_api.py` - REST API tests (6 tests)
  - `test_greeter.py` - gRPC tests
- Protos: `apps/backend/protos`
- Coverage output: `coverage/apps/backend`
- Test reports: `reports/apps/backend/unittests`

## Testing

### Run All Tests
```bash
cd apps/backend
python -m pytest tests/ -v
```

### Run REST API Tests Only
```bash
cd apps/backend
python -m pytest tests/test_rest_api.py -v
```

Tests included:
- ✓ Health check endpoint
- ✓ POST hello with JSON payload
- ✓ GET hello with path parameter
- ✓ Response format validation
- ✓ OpenAPI docs availability
- ✓ Validation error handling

### Run gRPC Tests Only
```bash
cd apps/backend
python -m pytest tests/test_greeter.py -v
```

## Project Structure

```
apps/backend/
├── src/
│   ├── services.py          # Shared business logic
│   ├── rest_server.py       # FastAPI app factory
│   ├── greeter_server.py    # gRPC server
│   └── __init__.py
├── protos/
│   ├── helloworld.proto     # Service definitions
│   ├── helloworld_pb2.py    # Generated (DO NOT EDIT)
│   └── helloworld_pb2_grpc.py # Generated (DO NOT EDIT)
├── tests/
│   ├── conftest.py          # Pytest configuration
│   ├── test_rest_api.py     # REST tests
│   └── test_greeter.py      # gRPC tests
├── main.py                  # Dual server runner
├── pyproject.toml           # Python dependencies
└── README.md                # This file
```

## Dependencies

### Production
- `grpcio>=1.78.0` - gRPC framework
- `fastapi>=0.104.0` - REST API framework
- `uvicorn[standard]>=0.24.0` - ASGI server
- `pydantic>=2.0.0` - Data validation

### Development
- `pytest>=8.3.4` - Test runner
- `pytest-cov>=6.0.0` - Coverage reports
- `pytest-asyncio>=0.21.0` - Async test support
- `httpx>=0.24.0` - HTTP client for testing
- `grpcio-tools>=1.78.0` - gRPC code generation
