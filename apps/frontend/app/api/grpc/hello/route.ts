/**
 * gRPC Proxy API Route
 * Provides gRPC calls to frontend through HTTP/JSON
 *
 * This route acts as a bridge between the Next.js frontend
 * and the gRPC backend service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createGreeterClient, GrpcHelloRequest, GrpcHelloResponse } from '../_shared';

export const runtime = 'nodejs';

/**
 * Call gRPC service from Node.js
 * We'll use @grpc/grpc-js to make gRPC calls
 */
async function callGrpcHello(name: string): Promise<GrpcHelloResponse> {
  try {
    const client = createGreeterClient();

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
