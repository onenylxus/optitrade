import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/api/client';

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/portfolio`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => ({}))) as unknown;

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Failed to load portfolio',
          detail:
            typeof payload === 'object' &&
            payload !== null &&
            'detail' in payload &&
            typeof (payload as { detail?: unknown }).detail === 'string'
              ? (payload as { detail: string }).detail
              : response.statusText,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error: 'Failed to load portfolio',
        detail: 'Backend is unavailable',
      },
      { status: 502 },
    );
  }
}
