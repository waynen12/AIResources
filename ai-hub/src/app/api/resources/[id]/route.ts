import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToResource } from '@/lib/db';

const RESOURCE_TYPES = ['YouTube', 'Article', 'Course', 'Documentation', 'Tool', 'Other'];

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
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

  const db = getDb();
  const existing = db.prepare('SELECT id FROM resources WHERE id = ?').get(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const normalizedTags = tags.slice(0, 5).map((t: string) => t.toLowerCase().trim()).filter(Boolean);

  db.prepare(`
    UPDATE resources SET
      title = ?, url = ?, description = ?, resource_type = ?,
      tag1 = ?, tag2 = ?, tag3 = ?, tag4 = ?, tag5 = ?,
      submitted_by = ?
    WHERE id = ?
  `).run(
    title.trim(), url.trim(), description.trim(), resource_type,
    normalizedTags[0] ?? null, normalizedTags[1] ?? null,
    normalizedTags[2] ?? null, normalizedTags[3] ?? null, normalizedTags[4] ?? null,
    submitted_by?.trim() || null,
    id
  );

  db.prepare('INSERT INTO audit_log (resource_id, action, ip_address) VALUES (?, ?, ?)').run(id, 'update', ip);

  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
  return NextResponse.json(rowToResource(row as Parameters<typeof rowToResource>[0]));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  const db = getDb();
  const existing = db.prepare('SELECT id FROM resources WHERE id = ?').get(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  db.prepare('INSERT INTO audit_log (resource_id, action, ip_address) VALUES (?, ?, ?)').run(id, 'delete', ip);

  return new NextResponse(null, { status: 204 });
}
