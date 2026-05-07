// apps/frontend/app/api/news/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {

    const jsonPath = path.join(process.cwd(), '..', 'backend', 'data', 'news_analysis_result.json');

    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json({ error: 'News data not found' }, { status: 404 });
    }

    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(fileContent);

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load news' }, { status: 500 });
  }
}
