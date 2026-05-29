import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import fs from 'node:fs';
import path from 'node:path';

const GRPC_BACKEND_HOST = process.env.GRPC_BACKEND_HOST || 'localhost:50051';

export interface GrpcHelloRequest {
  name: string;
}

export interface GrpcHelloResponse {
  message: string;
}

type GrpcCallback = (err: Error | null, response: GrpcHelloResponse) => void;

type GreeterClient = {
  SayHello: (request: GrpcHelloRequest, callback: GrpcCallback) => void;
  SayHelloServerStream: (request: GrpcHelloRequest) => grpc.ClientReadableStream<GrpcHelloResponse>;
  SayHelloClientStream: (callback: GrpcCallback) => grpc.ClientWritableStream<GrpcHelloRequest>;
  SayHelloBidirectional: () => grpc.ClientDuplexStream<GrpcHelloRequest, GrpcHelloResponse>;
};

type GreeterConstructor = new (
  address: string,
  credentials: grpc.ChannelCredentials,
) => GreeterClient;

function resolveProtoPath(): string {
  const protoCandidates = [
    path.join(process.cwd(), 'apps/backend/protos/helloworld.proto'),
    path.join(process.cwd(), '../../apps/backend/protos/helloworld.proto'),
    path.join(process.cwd(), '../backend/protos/helloworld.proto'),
  ];

  const protoPath = protoCandidates.find((candidate) => fs.existsSync(candidate));
  if (!protoPath) {
    throw new Error(`Could not locate helloworld.proto. Tried: ${protoCandidates.join(', ')}`);
  }

  return protoPath;
}

export function createGreeterClient(): GreeterClient {
  const protoPath = resolveProtoPath();
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const helloProto = grpc.loadPackageDefinition(packageDefinition) as Record<string, unknown>;
  const rootGreeter = helloProto.Greeter;
  const nested = helloProto.helloworld as { Greeter?: GreeterConstructor } | undefined;
  const Greeter = (rootGreeter as GreeterConstructor | undefined) ?? nested?.Greeter;

  if (!Greeter) {
    throw new Error('Greeter service definition not found in loaded proto package');
  }

  return new Greeter(GRPC_BACKEND_HOST, grpc.credentials.createInsecure());
}
