// apps/frontend/app/api/earnings/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const backendJsonPath = path.join(process.cwd(), '..', 'backend', 'data', 'earnings_data.json');
    const fallbackJsonPath = path.join(process.cwd(), 'public', 'earnings_data.json');
    const jsonPath = fs.existsSync(backendJsonPath) ? backendJsonPath : fallbackJsonPath;

    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json({ earnings: [], source: 'none' });
    }

    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(fileContent);
    return NextResponse.json({ earnings: data, source: 'file' });
  } catch {
    return NextResponse.json({ error: 'Failed to load earnings' }, { status: 500 });
  }
}
