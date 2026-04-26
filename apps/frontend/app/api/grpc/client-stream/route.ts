import { NextRequest, NextResponse } from 'next/server';
import { createGreeterClient } from '../_shared';

export const runtime = 'nodejs';

interface GrpcClientStreamRequest {
  names: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: GrpcClientStreamRequest = await request.json();
    if (!Array.isArray(body.names) || body.names.length === 0) {
      return NextResponse.json(
        { error: 'names must be a non-empty string array' },
        { status: 400 },
      );
    }

    if (body.names.some((name) => typeof name !== 'string' || name.length === 0)) {
      return NextResponse.json({ error: 'all names must be non-empty strings' }, { status: 400 });
    }

    const client = createGreeterClient();
    const message = await new Promise<string>((resolve, reject) => {
      const stream = client.SayHelloClientStream((err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response.message);
        }
      });

      body.names.forEach((name) => stream.write({ name }));
      stream.end();
    });

    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to call gRPC client stream',
      },
      { status: 500 },
    );
  }
}
