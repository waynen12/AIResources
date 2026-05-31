import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();

  const rows = db.prepare(`
    SELECT tag1 as tag FROM resources WHERE tag1 IS NOT NULL
    UNION SELECT tag2 FROM resources WHERE tag2 IS NOT NULL
    UNION SELECT tag3 FROM resources WHERE tag3 IS NOT NULL
    UNION SELECT tag4 FROM resources WHERE tag4 IS NOT NULL
    UNION SELECT tag5 FROM resources WHERE tag5 IS NOT NULL
    ORDER BY tag ASC
  `).all() as { tag: string }[];

  return NextResponse.json(rows.map(r => r.tag));
}
