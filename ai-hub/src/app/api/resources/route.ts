import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToResource } from '@/lib/db';

const RESOURCE_TYPES = ['YouTube', 'Article', 'Course', 'Documentation', 'Tool', 'Other'];
const PAGE_SIZE = 12;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.toLowerCase().trim() ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  const db = getDb();

  const searchPattern = `%${search}%`;
  const whereClause = search
    ? `WHERE (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tag1) LIKE ? OR LOWER(tag2) LIKE ? OR LOWER(tag3) LIKE ? OR LOWER(tag4) LIKE ? OR LOWER(tag5) LIKE ?)`
    : '';
  const searchParams2 = search ? Array(7).fill(searchPattern) : [];

  const total = (db.prepare(`SELECT COUNT(*) as count FROM resources ${whereClause}`).get(...searchParams2) as { count: number }).count;

  const rows = db.prepare(
    `SELECT * FROM resources ${whereClause} ORDER BY date_added DESC LIMIT ? OFFSET ?`
  ).all(...searchParams2, PAGE_SIZE, offset);

  return NextResponse.json({
    resources: (rows as Parameters<typeof rowToResource>[0][]).map(rowToResource),
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: offset + PAGE_SIZE < total,
  });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  const body = await request.json();
  const { title, url, description, resource_type, tags = [], submitted_by } = body;

  if (!title?.trim() || !url?.trim() || !description?.trim() || !resource_type?.trim()) {
    return NextResponse.json({ error: 'title, url, description and resource_type are required' }, { status: 400 });
  }

  if (!RESOURCE_TYPES.includes(resource_type)) {
    return NextResponse.json({ error: 'Invalid resource type' }, { status: 400 });
  }

  const normalizedTags = tags.slice(0, 5).map((t: string) => t.toLowerCase().trim()).filter(Boolean);

  const db = getDb();

  const result = db.prepare(`
    INSERT INTO resources (title, url, description, resource_type, tag1, tag2, tag3, tag4, tag5, submitted_by)
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
    submitted_by?.trim() || null
  );

  db.prepare(`INSERT INTO audit_log (resource_id, action, ip_address) VALUES (?, ?, ?)`).run(result.lastInsertRowid, 'create', ip);

  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(rowToResource(row as Parameters<typeof rowToResource>[0]), { status: 201 });
}
