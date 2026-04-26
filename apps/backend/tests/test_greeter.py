from concurrent import futures

import grpc

from protos import helloworld_pb2, helloworld_pb2_grpc
from src import greeter_server
from src.services import GreeterService


def test_say_hello_returns_expected_message():
    service = GreeterService()
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    helloworld_pb2_grpc.add_GreeterServicer_to_server(
        greeter_server.Greeter(service), server
    )
    port = server.add_insecure_port("[::]:0")
    assert port != 0
    server.start()

    try:
        channel = grpc.insecure_channel(f"localhost:{port}")
        grpc.channel_ready_future(channel).result(timeout=5)
        stub = helloworld_pb2_grpc.GreeterStub(channel)
        resp = stub.SayHello(helloworld_pb2.HelloRequest(name="pytest"))
        assert resp.message == "Hello, pytest!"
    finally:
        server.stop(0).wait()


def test_say_hello_server_stream_returns_multiple_messages():
    service = GreeterService()
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    helloworld_pb2_grpc.add_GreeterServicer_to_server(
        greeter_server.Greeter(service), server
    )
    port = server.add_insecure_port("[::]:0")
    assert port != 0
    server.start()

    try:
        channel = grpc.insecure_channel(f"localhost:{port}")
        grpc.channel_ready_future(channel).result(timeout=5)
        stub = helloworld_pb2_grpc.GreeterStub(channel)
        responses = list(
            stub.SayHelloServerStream(helloworld_pb2.HelloRequest(name="pytest"))
        )
        assert len(responses) == 3
        assert responses[0].message == "Hello #1, pytest!"
        assert responses[1].message == "Hello #2, pytest!"
        assert responses[2].message == "Hello #3, pytest!"
    finally:
        server.stop(0).wait()


def test_say_hello_client_stream_aggregates_messages():
    service = GreeterService()
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    helloworld_pb2_grpc.add_GreeterServicer_to_server(
        greeter_server.Greeter(service), server
    )
    port = server.add_insecure_port("[::]:0")
    assert port != 0
    server.start()

    try:
        channel = grpc.insecure_channel(f"localhost:{port}")
        grpc.channel_ready_future(channel).result(timeout=5)
        stub = helloworld_pb2_grpc.GreeterStub(channel)

        requests = (
            helloworld_pb2.HelloRequest(name=name)
            for name in ["alice", "bob", "charlie"]
        )
        response = stub.SayHelloClientStream(requests)
        assert response.message == "Hello, alice! | Hello, bob! | Hello, charlie!"
    finally:
        server.stop(0).wait()


def test_say_hello_bidirectional_stream_returns_per_request_messages():
    service = GreeterService()
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    helloworld_pb2_grpc.add_GreeterServicer_to_server(
        greeter_server.Greeter(service), server
    )
    port = server.add_insecure_port("[::]:0")
    assert port != 0
    server.start()

    try:
        channel = grpc.insecure_channel(f"localhost:{port}")
        grpc.channel_ready_future(channel).result(timeout=5)
        stub = helloworld_pb2_grpc.GreeterStub(channel)

        requests = (
            helloworld_pb2.HelloRequest(name=name)
            for name in ["pytest", "grpc", "stream"]
        )
        responses = list(stub.SayHelloBidirectional(requests))
        assert [resp.message for resp in responses] == [
            "Hello, pytest!",
            "Hello, grpc!",
            "Hello, stream!",
        ]
    finally:
        server.stop(0).wait()

