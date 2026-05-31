import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { auth } from '@/lib/auth';

const HEADERS = ['title', 'url', 'description', 'resource_type', 'tags', 'submitted_by', 'date_added'];

function csvCell(value: string | null | undefined): string {
  const s = value ?? '';
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getDb();
  const rows = db.prepare(
    'SELECT title, url, description, resource_type, tag1, tag2, tag3, tag4, tag5, submitted_by, date_added FROM resources ORDER BY date_added ASC'
  ).all() as {
    title: string; url: string; description: string; resource_type: string;
    tag1: string | null; tag2: string | null; tag3: string | null; tag4: string | null; tag5: string | null;
    submitted_by: string | null; date_added: string;
  }[];

  const lines: string[] = [HEADERS.join(',')];

  for (const row of rows) {
    const tags = [row.tag1, row.tag2, row.tag3, row.tag4, row.tag5]
      .filter(Boolean)
      .join('|');
    lines.push([
      csvCell(row.title),
      csvCell(row.url),
      csvCell(row.description),
      csvCell(row.resource_type),
      csvCell(tags),
      csvCell(row.submitted_by),
      csvCell(row.date_added),
    ].join(','));
  }

  const csv = lines.join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="aihub-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
