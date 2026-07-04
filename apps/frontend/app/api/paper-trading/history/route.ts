// apps/frontend/app/api/paper-trading/history/route.ts
//
// Thin proxy to the FastAPI /api/paper-trading/history endpoint.
// The source of truth is the SQLite `paper_trades` table — see
// apps/backend/src/db.py and apps/backend/scripts/migrate_json_to_sqlite.py.

import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const r = await fetch(`${BACKEND_URL}/api/paper-trading/history`, {
      cache: 'no-store',
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `Backend returned HTTP ${r.status}` },
        { status: r.status },
      );
    }
    return NextResponse.json(await r.json(), { status: 200 });
  } catch (err) {
    console.error('paper-trading/history proxy error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Proxy failed' },
      { status: 502 },
    );
  }
}