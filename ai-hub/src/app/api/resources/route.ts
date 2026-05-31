import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToResource } from '@/lib/db';
import { auth } from '@/lib/auth';

const RESOURCE_TYPES = ['YouTube', 'Article', 'Course', 'Documentation', 'Tool', 'Other'];
const PAGE_SIZE = 12;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.toLowerCase().trim() ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  const db = getDb();

  const searchPattern = `%${search}%`;
  const whereClause = search
    ? `WHERE (LOWER(r.title) LIKE ? OR LOWER(r.description) LIKE ? OR LOWER(r.tag1) LIKE ? OR LOWER(r.tag2) LIKE ? OR LOWER(r.tag3) LIKE ? OR LOWER(r.tag4) LIKE ? OR LOWER(r.tag5) LIKE ?)`
    : '';
  const searchArgs = search ? Array(7).fill(searchPattern) : [];

  const total = (db.prepare(`SELECT COUNT(*) as count FROM resources r ${whereClause}`).get(...searchArgs) as { count: number }).count;

  const rows = db.prepare(
    `SELECT r.*, a.username FROM resources r LEFT JOIN accounts a ON r.account_id = a.id ${whereClause} ORDER BY r.date_added DESC LIMIT ? OFFSET ?`
  ).all(...searchArgs, PAGE_SIZE, offset);

  return NextResponse.json({
    resources: (rows as Parameters<typeof rowToResource>[0][]).map(rowToResource),
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: offset + PAGE_SIZE < total,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  const body = await request.json();
  const { title, url, description, resource_type, tags = [] } = body;

  if (!title?.trim() || !url?.trim() || !description?.trim() || !resource_type?.trim()) {
    return NextResponse.json({ error: 'title, url, description and resource_type are required' }, { status: 400 });
  }

  if (!RESOURCE_TYPES.includes(resource_type)) {
    return NextResponse.json({ error: 'Invalid resource type' }, { status: 400 });
  }

  const normalizedTags = tags.slice(0, 5).map((t: string) => t.toLowerCase().trim()).filter(Boolean);
  const accountId = Number(session.user.id);

  const db = getDb();

  const result = db.prepare(`
    INSERT INTO resources (title, url, description, resource_type, tag1, tag2, tag3, tag4, tag5, account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    url.trim(),
    description.trim(),
    resource_type,
    normalizedTags[0] ?? null,
    normalizedTags[1] ?? null,
    normalizedTags[2] ?? null,
    normalizedTags[3] ?? null,
    normalizedTags[4] ?? null,
    accountId
  );

  db.prepare(`INSERT INTO audit_log (resource_id, action, ip_address) VALUES (?, ?, ?)`).run(result.lastInsertRowid, 'create', ip);

  const row = db.prepare('SELECT r.*, a.username FROM resources r LEFT JOIN accounts a ON r.account_id = a.id WHERE r.id = ?').get(result.lastInsertRowid);
  return NextResponse.json(rowToResource(row as Parameters<typeof rowToResource>[0]), { status: 201 });
}
