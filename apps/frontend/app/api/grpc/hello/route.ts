/**
 * gRPC Proxy API Route
 * Provides gRPC calls to frontend through HTTP/JSON
 *
 * This route acts as a bridge between the Next.js frontend
 * and the gRPC backend service.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

const GRPC_BACKEND_HOST = process.env.GRPC_BACKEND_HOST || 'localhost:50051';

interface GrpcHelloRequest {
  name: string;
}

interface GrpcHelloResponse {
  message: string;
}

type GrpcCallback = (err: Error | null, response: GrpcHelloResponse) => void;

type GreeterClient = {
  SayHello: (request: GrpcHelloRequest, callback: GrpcCallback) => void;
};

type GreeterConstructor = new (
  address: string,
  credentials: grpc.ChannelCredentials,
) => GreeterClient;

/**
 * Call gRPC service from Node.js
 * We'll use @grpc/grpc-js to make gRPC calls
 */
async function callGrpcHello(name: string): Promise<GrpcHelloResponse> {
  try {
    // Resolve the backend proto path for both monorepo-root and app-local run modes.
    const protoCandidates = [
      path.join(process.cwd(), 'apps/backend/protos/helloworld.proto'),
      path.join(process.cwd(), '../../apps/backend/protos/helloworld.proto'),
      path.join(process.cwd(), '../backend/protos/helloworld.proto'),
    ];
    const protoPath = protoCandidates.find((candidate) => fs.existsSync(candidate));
    if (!protoPath) {
      throw new Error(`Could not locate helloworld.proto. Tried: ${protoCandidates.join(', ')}`);
    }

    // Load proto
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const helloProto = grpc.loadPackageDefinition(packageDefinition) as Record<string, unknown>;

    // Create client
    const rootGreeter = helloProto.Greeter;
    const nested = helloProto.helloworld as { Greeter?: GreeterConstructor } | undefined;
    const Greeter = (rootGreeter as GreeterConstructor | undefined) ?? nested?.Greeter;
    if (!Greeter) {
      throw new Error('Greeter service definition not found in loaded proto package');
    }

    const client = new Greeter(GRPC_BACKEND_HOST, grpc.credentials.createInsecure());

    // Make the call
    return await new Promise((resolve, reject) => {
      client.SayHello({ name }, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  } catch (error) {
    console.error('gRPC call failed:', error);
    throw error;
  }
}

/**
 * POST /api/grpc/hello
 * Call the gRPC backend's SayHello method
 */
export async function POST(request: NextRequest) {
  try {
    const body: GrpcHelloRequest = await request.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required and must be a string' }, { status: 400 });
    }

    const response = await callGrpcHello(body.name);
    return NextResponse.json(response);
  } catch (error) {
    console.error('gRPC endpoint error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to call gRPC backend',
      },
      { status: 500 },
    );
  }
}
