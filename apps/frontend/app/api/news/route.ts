// apps/frontend/app/api/news/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface NewsLikeItem {
  headline?: string;
  summary?: string;
  related_symbols?: string[];
}

function parseJsonFile(jsonPath: string): unknown {
  const fileContent = fs.readFileSync(jsonPath, 'utf-8');
  return JSON.parse(fileContent);
}

function filterNewsBySymbols<T extends NewsLikeItem>(news: T[], symbols: string[]): T[] {
  if (symbols.length === 0) {
    return news;
  }

  return news.filter((item) => {
    const relatedSymbols = Array.isArray(item.related_symbols)
      ? item.related_symbols.map((symbol) => String(symbol).toUpperCase())
      : [];
    if (relatedSymbols.some((symbol) => symbols.includes(symbol))) {
      return true;
    }

    const haystack = `${item.headline ?? ''} ${item.summary ?? ''}`.toUpperCase();
    return symbols.some((symbol) => haystack.includes(symbol));
  });
}

export async function GET(request: NextRequest) {
  const backendJsonPath = path.join(
    process.cwd(),
    '..',
    'backend',
    'data',
    'news_analysis_result.json',
  );
  const fallbackJsonPath = path.join(process.cwd(), 'public', 'news_data.json');
  const candidatePaths = [backendJsonPath, fallbackJsonPath];
  const symbols = request.nextUrl.searchParams
    .get('symbols')
    ?.split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean) ?? [];

  let sawFile = false;
  const errors: string[] = [];

  for (const jsonPath of candidatePaths) {
    if (!fs.existsSync(jsonPath)) {
      continue;
    }

    sawFile = true;

    try {
      const data = parseJsonFile(jsonPath);
      if (
        data &&
        typeof data === 'object' &&
        'news' in data &&
        Array.isArray((data as { news?: unknown }).news)
      ) {
        return NextResponse.json({
          ...(data as Record<string, unknown>),
          news: filterNewsBySymbols((data as { news: NewsLikeItem[] }).news, symbols),
        });
      }

      if (Array.isArray(data)) {
        return NextResponse.json(filterNewsBySymbols(data as NewsLikeItem[], symbols));
      }

      return NextResponse.json(data);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${path.basename(jsonPath)}: ${detail}`);
    }
  }

  if (!sawFile) {
    return NextResponse.json({ error: 'News data not found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      error: 'Failed to load news',
      detail: errors.join(' | '),
    },
    { status: 500 },
  );
}
