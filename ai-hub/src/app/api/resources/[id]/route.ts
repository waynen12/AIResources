import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToResource } from '@/lib/db';
import { auth } from '@/lib/auth';

const RESOURCE_TYPES = ['YouTube', 'Article', 'Course', 'Documentation', 'Tool', 'Other'];

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
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

  const db = getDb();
  const existing = db.prepare('SELECT id, account_id FROM resources WHERE id = ?').get(id) as { id: number; account_id: number | null } | undefined;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const accountId = Number(session.user.id);
  const isAdmin = session.user.role === 'admin';
  if (!isAdmin && existing.account_id !== accountId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const normalizedTags = tags.slice(0, 5).map((t: string) => t.toLowerCase().trim()).filter(Boolean);

  db.prepare(`
    UPDATE resources SET
      title = ?, url = ?, description = ?, resource_type = ?,
      tag1 = ?, tag2 = ?, tag3 = ?, tag4 = ?, tag5 = ?
    WHERE id = ?
  `).run(
    title.trim(), url.trim(), description.trim(), resource_type,
    normalizedTags[0] ?? null, normalizedTags[1] ?? null,
    normalizedTags[2] ?? null, normalizedTags[3] ?? null, normalizedTags[4] ?? null,
    id
  );

  db.prepare('INSERT INTO audit_log (resource_id, action, ip_address) VALUES (?, ?, ?)').run(id, 'update', ip);

  const row = db.prepare('SELECT r.*, a.username FROM resources r LEFT JOIN accounts a ON r.account_id = a.id WHERE r.id = ?').get(id);
  return NextResponse.json(rowToResource(row as Parameters<typeof rowToResource>[0]));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  const db = getDb();
  const existing = db.prepare('SELECT id, account_id FROM resources WHERE id = ?').get(id) as { id: number; account_id: number | null } | undefined;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const accountId = Number(session.user.id);
  const isAdmin = session.user.role === 'admin';
  if (!isAdmin && existing.account_id !== accountId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  db.prepare('INSERT INTO audit_log (resource_id, action, ip_address) VALUES (?, ?, ?)').run(id, 'delete', ip);

  return new NextResponse(null, { status: 204 });
}
