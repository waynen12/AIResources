import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  const db = getDb();

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const setting = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('news_ingest_token') as { value: string } | undefined;
  if (!setting?.value || token !== setting.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { feed_type?: unknown; digest_html?: unknown; articles?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { feed_type, digest_html, articles } = body;

  if (feed_type !== 'daily' && feed_type !== 'weekly') {
    return NextResponse.json({ error: 'feed_type must be daily or weekly' }, { status: 400 });
  }
  if (typeof digest_html !== 'string' || !digest_html.trim()) {
    return NextResponse.json({ error: 'digest_html required' }, { status: 400 });
  }

  const articles_json = JSON.stringify(Array.isArray(articles) ? articles : []);

  const result = db.prepare(
    'INSERT INTO news_items (feed_type, digest_html, articles_json) VALUES (?, ?, ?)'
  ).run(feed_type, digest_html, articles_json);

  const limit = feed_type === 'daily' ? 7 : 4;
  db.prepare(`
    DELETE FROM news_items
    WHERE feed_type = ? AND id NOT IN (
      SELECT id FROM news_items WHERE feed_type = ? ORDER BY published_at DESC LIMIT ?
    )
  `).run(feed_type, feed_type, limit);

  return NextResponse.json({ id: Number(result.lastInsertRowid) });
}
