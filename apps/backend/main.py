"""Unified server runner for both gRPC and REST APIs."""

import logging
import threading
from concurrent import futures

import grpc
import uvicorn

from protos import helloworld_pb2, helloworld_pb2_grpc
from src.rest_server import create_app
from src.services import GreeterService


class Greeter(helloworld_pb2_grpc.GreeterServicer):
    def __init__(self, service: GreeterService):
        self.service = service

    def SayHello(self, request, context):
        message = self.service.say_hello(request.name)
        return helloworld_pb2.HelloReply(message=message)

    def SayHelloServerStream(self, request, context):
        base_name = request.name
        for i in range(1, 4):
            message = self.service.say_hello_with_prefix(base_name, prefix=f"Hello #{i}")
            yield helloworld_pb2.HelloReply(message=message)

    def SayHelloClientStream(self, request_iterator, context):
        names = [request.name for request in request_iterator]
        message = self.service.aggregate_hellos(names)
        return helloworld_pb2.HelloReply(message=message)

    def SayHelloBidirectional(self, request_iterator, context):
        for request in request_iterator:
            message = self.service.say_hello(request.name)
            yield helloworld_pb2.HelloReply(message=message)


def run_grpc_server(service: GreeterService, port: str = "50051"):
    """
    Run gRPC server in a separate thread.

    Args:
        service: The greeter service instance.
        port: The port to listen on.
    """
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    helloworld_pb2_grpc.add_GreeterServicer_to_server(Greeter(service), server)
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    print(f"gRPC server started on port {port}")
    server.wait_for_termination()


def run_rest_server(rest_port: int = 8000):
    """
    Run REST server (FastAPI with Uvicorn).

    Args:
        rest_port: The port to listen on.
    """
    app = create_app()
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=rest_port,
        log_level="info",
    )
    server = uvicorn.Server(config)
    print(f"REST API server started on port {rest_port}")
    print(f"  OpenAPI docs: http://localhost:{rest_port}/docs")
    import asyncio
    asyncio.run(server.serve())


def main():
    """Start both gRPC and REST servers."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    service = GreeterService()

    # Start gRPC server in a separate thread
    grpc_thread = threading.Thread(
        target=run_grpc_server,
        args=(service, "50051"),
        daemon=False,
    )
    grpc_thread.start()

    # Start REST server in main thread
    try:
        run_rest_server(8000)
    except KeyboardInterrupt:
        print("\nShutting down servers...")


if __name__ == "__main__":
    main()
