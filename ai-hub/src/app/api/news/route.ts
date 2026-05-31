import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const feed = searchParams.get('feed');

  if (feed !== 'daily' && feed !== 'weekly') {
    return NextResponse.json({ error: 'feed must be daily or weekly' }, { status: 400 });
  }

  const db = getDb();
  const rows = db.prepare(
    'SELECT id, digest_html, articles_json, published_at FROM news_items WHERE feed_type = ? ORDER BY published_at DESC'
  ).all(feed) as { id: number; digest_html: string; articles_json: string; published_at: string }[];

  const items = rows.map(row => ({
    id: row.id,
    digest_html: row.digest_html,
    articles: JSON.parse(row.articles_json) as { title: string; url: string }[],
    published_at: row.published_at,
  }));

  return NextResponse.json({ items });
}
