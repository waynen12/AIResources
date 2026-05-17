import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToResource } from '@/lib/db';
import { getAIProvider } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { query } = body as { query?: string };

  if (!query?.trim()) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const provider = getAIProvider();
  if (!provider) {
    return NextResponse.json({ error: 'AI provider not configured' }, { status: 503 });
  }

  const db = getDb();
  const rows = db.prepare('SELECT * FROM resources ORDER BY date_added DESC').all();
  const allResources = (rows as Parameters<typeof rowToResource>[0][]).map(rowToResource);

  const catalog = allResources.map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    tags: r.tags,
  }));

  try {
    const rankedIds = await provider.smartSearch(query.trim(), catalog);

    const byId = new Map(allResources.map(r => [r.id, r]));
    const results = rankedIds.filter(id => byId.has(id)).map(id => byId.get(id)!);

    return NextResponse.json({ resources: results });
  } catch (err) {
    console.error('[ai/search] error:', err);
    return NextResponse.json({ error: 'Search failed — try keyword search' }, { status: 503 });
  }
}
