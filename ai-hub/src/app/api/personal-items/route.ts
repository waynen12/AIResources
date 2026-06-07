import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToPersonalItem } from '@/lib/db';
import { auth } from '@/lib/auth';

const RESOURCE_TYPES = ['YouTube', 'Article', 'Course', 'Documentation', 'Tool', 'Other'];
const PAGE_SIZE = 12;

const STATUS_ORDER = `CASE status WHEN 'not_started' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'done' THEN 2 ELSE 3 END`;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accountId = Number(session.user.id);
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.toLowerCase().trim() ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  const db = getDb();
  const searchPattern = `%${search}%`;

  const baseWhere = `WHERE account_id = ?`;
  const searchClause = search
    ? ` AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tag1) LIKE ? OR LOWER(tag2) LIKE ? OR LOWER(tag3) LIKE ? OR LOWER(tag4) LIKE ? OR LOWER(tag5) LIKE ?)`
    : '';
  const whereClause = baseWhere + searchClause;
  const baseArgs: unknown[] = [accountId];
  const searchArgs = search ? Array(7).fill(searchPattern) : [];

  const total = (db.prepare(`SELECT COUNT(*) as count FROM personal_items ${whereClause}`)
    .get(...baseArgs, ...searchArgs) as { count: number }).count;

  const rows = db.prepare(
    `SELECT * FROM personal_items ${whereClause} ORDER BY ${STATUS_ORDER}, date_added DESC LIMIT ? OFFSET ?`
  ).all(...baseArgs, ...searchArgs, PAGE_SIZE, offset);

  const items = (rows as Parameters<typeof rowToPersonalItem>[0][]).map(rowToPersonalItem);

  const counts = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'not_started' THEN 1 ELSE 0 END) as not_started,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
    FROM personal_items WHERE account_id = ?
  `).get(accountId) as { not_started: number; in_progress: number; done: number };

  return NextResponse.json({
    items,
    total,
    page,
    hasMore: offset + PAGE_SIZE < total,
    counts: {
      not_started: counts.not_started ?? 0,
      in_progress: counts.in_progress ?? 0,
      done: counts.done ?? 0,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accountId = Number(session.user.id);
  const body = await request.json();
  const { title, url, description, resource_type, tags = [] } = body;

  if (!title?.trim() || !url?.trim() || !description?.trim() || !resource_type?.trim()) {
    return NextResponse.json({ error: 'title, url, description and resource_type are required' }, { status: 400 });
  }

  if (!RESOURCE_TYPES.includes(resource_type)) {
    return NextResponse.json({ error: 'Invalid resource type' }, { status: 400 });
  }

  const db = getDb();

  const existing = db.prepare(`SELECT id FROM personal_items WHERE account_id = ? AND url = ?`).get(accountId, url.trim());
  if (existing) {
    return NextResponse.json({ error: 'Already in My Learning' }, { status: 409 });
  }

  const normalizedTags = (tags as string[]).slice(0, 5).map(t => t.toLowerCase().trim()).filter(Boolean);

  const result = db.prepare(`
    INSERT INTO personal_items (account_id, title, url, description, resource_type, tag1, tag2, tag3, tag4, tag5)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    accountId,
    title.trim(),
    url.trim(),
    description.trim(),
    resource_type,
    normalizedTags[0] ?? null,
    normalizedTags[1] ?? null,
    normalizedTags[2] ?? null,
    normalizedTags[3] ?? null,
    normalizedTags[4] ?? null,
  );

  const row = db.prepare(`SELECT * FROM personal_items WHERE id = ?`).get(result.lastInsertRowid);
  return NextResponse.json(rowToPersonalItem(row as Parameters<typeof rowToPersonalItem>[0]), { status: 201 });
}
