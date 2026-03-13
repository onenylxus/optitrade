from concurrent import futures
import grpc


def _import_generated():
    # Import generated modules lazily (they are created by tests or build step)
    try:
        import protos.hello_pb2 as hello_pb2
        import protos.hello_pb2_grpc as hello_pb2_grpc
    except Exception:
        raise
    return hello_pb2, hello_pb2_grpc


class HelloServiceImpl:
    def __init__(self, hello_pb2):
        self._hello_pb2 = hello_pb2

    def SayHello(self, request, context):
        return self._hello_pb2.HelloReply(message=f"Hello {request.name}")


def serve_in_thread(address='[::]:0'):
    hello_pb2, hello_pb2_grpc = _import_generated()

    class Servicer(hello_pb2_grpc.HelloServiceServicer):
        def SayHello(self, request, context):
            return HelloServiceImpl(hello_pb2).SayHello(request, context)

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=4))
    hello_pb2_grpc.add_HelloServiceServicer_to_server(Servicer(), server)
    bound_port = server.add_insecure_port(address)
    server.start()
    return server, bound_port


def stop_server(server):
    if server:
        server.stop(0)
