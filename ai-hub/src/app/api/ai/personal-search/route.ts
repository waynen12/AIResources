import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToPersonalItem } from '@/lib/db';
import { getAIProvider } from '@/lib/ai';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accountId = Number(session.user.id);
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
  const rows = db.prepare(
    `SELECT * FROM personal_items WHERE account_id = ? ORDER BY date_added DESC`
  ).all(accountId);
  const allItems = (rows as Parameters<typeof rowToPersonalItem>[0][]).map(rowToPersonalItem);

  if (allItems.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const catalog = allItems.map(i => ({
    id: i.id,
    title: i.title,
    description: i.description,
    tags: i.tags,
  }));

  try {
    const rankedIds = await provider.smartSearch(query.trim(), catalog);
    const byId = new Map(allItems.map(i => [i.id, i]));
    const results = rankedIds.filter(id => byId.has(id)).map(id => byId.get(id)!);
    return NextResponse.json({ items: results });
  } catch (err) {
    console.error('[ai/personal-search] error:', err);
    return NextResponse.json({ error: 'Search failed — try keyword search' }, { status: 503 });
  }
}
