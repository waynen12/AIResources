import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToPersonalItem } from '@/lib/db';
import { auth } from '@/lib/auth';

const RESOURCE_TYPES = ['YouTube', 'Article', 'Course', 'Documentation', 'Tool', 'Other'];
const STATUSES = ['not_started', 'in_progress', 'done'];

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accountId = Number(session.user.id);
  const { id } = await params;
  const itemId = parseInt(id, 10);

  const db = getDb();
  const existing = db.prepare(`SELECT * FROM personal_items WHERE id = ?`).get(itemId) as { account_id: number } | undefined;

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.account_id !== accountId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { title, url, description, resource_type, tags, status } = body;

  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    db.prepare(`UPDATE personal_items SET status = ? WHERE id = ?`).run(status, itemId);
    const row = db.prepare(`SELECT * FROM personal_items WHERE id = ?`).get(itemId);
    return NextResponse.json(rowToPersonalItem(row as Parameters<typeof rowToPersonalItem>[0]));
  }

  if (!title?.trim() || !url?.trim() || !description?.trim() || !resource_type?.trim()) {
    return NextResponse.json({ error: 'title, url, description and resource_type are required' }, { status: 400 });
  }
  if (!RESOURCE_TYPES.includes(resource_type)) {
    return NextResponse.json({ error: 'Invalid resource type' }, { status: 400 });
  }

  const normalizedTags = ((tags ?? []) as string[]).slice(0, 5).map(t => t.toLowerCase().trim()).filter(Boolean);

  db.prepare(`
    UPDATE personal_items
    SET title = ?, url = ?, description = ?, resource_type = ?,
        tag1 = ?, tag2 = ?, tag3 = ?, tag4 = ?, tag5 = ?
    WHERE id = ?
  `).run(
    title.trim(), url.trim(), description.trim(), resource_type,
    normalizedTags[0] ?? null, normalizedTags[1] ?? null,
    normalizedTags[2] ?? null, normalizedTags[3] ?? null,
    normalizedTags[4] ?? null,
    itemId,
  );

  const row = db.prepare(`SELECT * FROM personal_items WHERE id = ?`).get(itemId);
  return NextResponse.json(rowToPersonalItem(row as Parameters<typeof rowToPersonalItem>[0]));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accountId = Number(session.user.id);
  const { id } = await params;
  const itemId = parseInt(id, 10);

  const db = getDb();
  const existing = db.prepare(`SELECT account_id FROM personal_items WHERE id = ?`).get(itemId) as { account_id: number } | undefined;

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.account_id !== accountId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  db.prepare(`DELETE FROM personal_items WHERE id = ?`).run(itemId);
  return new NextResponse(null, { status: 204 });
}
