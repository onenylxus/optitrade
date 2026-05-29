import { NextRequest, NextResponse } from 'next/server';
import { createGreeterClient, GrpcHelloRequest } from '../_shared';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body: GrpcHelloRequest = await request.json();
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required and must be a string' }, { status: 400 });
    }

    const client = createGreeterClient();
    const stream = client.SayHelloServerStream({ name: body.name });

    const messages = await new Promise<string[]>((resolve, reject) => {
      const data: string[] = [];
      stream.on('data', (response) => data.push(response.message));
      stream.on('error', (error) => reject(error));
      stream.on('end', () => resolve(data));
    });

    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to call gRPC server stream',
      },
      { status: 500 },
    );
  }
}
