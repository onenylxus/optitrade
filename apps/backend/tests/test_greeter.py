from concurrent import futures

import grpc

from protos import helloworld_pb2, helloworld_pb2_grpc
from src import greeter_server


def test_say_hello_returns_expected_message():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    helloworld_pb2_grpc.add_GreeterServicer_to_server(greeter_server.Greeter(), server)
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
