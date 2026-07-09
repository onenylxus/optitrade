import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  if (!authorization) {
    return NextResponse.json({ detail: 'Missing bearer token' }, { status: 401 });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/session`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
      },
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : 'Backend is unavailable',
      },
      { status: 502 },
    );
  }
}
