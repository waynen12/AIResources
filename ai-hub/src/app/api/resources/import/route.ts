import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { auth } from '@/lib/auth';

const RESOURCE_TYPES = ['YouTube', 'Article', 'Course', 'Documentation', 'Tool', 'Other'];
const EXPECTED_HEADERS = ['title', 'url', 'description', 'resource_type', 'tags', 'submitted_by', 'date_added'];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const row: string[] = [];
    while (i < n) {
      if (text[i] === '"') {
        // quoted field
        i++;
        let cell = '';
        while (i < n) {
          if (text[i] === '"' && text[i + 1] === '"') {
            cell += '"';
            i += 2;
          } else if (text[i] === '"') {
            i++;
            break;
          } else {
            cell += text[i++];
          }
        }
        row.push(cell);
        if (i < n && text[i] === ',') i++;
      } else {
        let cell = '';
        while (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          cell += text[i++];
        }
        row.push(cell);
        if (i < n && text[i] === ',') i++;
      }
      if (i >= n || text[i] === '\n' || text[i] === '\r') break;
    }
    if (i < n && text[i] === '\r') i++;
    if (i < n && text[i] === '\n') i++;

    if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
      rows.push(row);
    }
  }

  return rows;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length < 2) {
    return NextResponse.json({ error: 'CSV is empty or has no data rows' }, { status: 400 });
  }

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const missingHeaders = EXPECTED_HEADERS.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return NextResponse.json(
      { error: `Missing required columns: ${missingHeaders.join(', ')}` },
      { status: 400 }
    );
  }

  const idx = (name: string) => headers.indexOf(name);

  const db = getDb();
  const insertStmt = db.prepare(`
    INSERT INTO resources (title, url, description, resource_type, tag1, tag2, tag3, tag4, tag5, submitted_by, date_added)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const auditStmt = db.prepare(
    'INSERT INTO audit_log (resource_id, action, ip_address) VALUES (?, ?, ?)'
  );
  const existsStmt = db.prepare('SELECT id FROM resources WHERE url = ?');

  let added = 0;
  let skipped_duplicates = 0;
  let skipped_bad_rows = 0;

  const importMany = db.transaction(() => {
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];

      const title = row[idx('title')]?.trim();
      const url = row[idx('url')]?.trim();
      const description = row[idx('description')]?.trim();
      const resource_type = row[idx('resource_type')]?.trim();

      if (!title || !url || !description || !resource_type) {
        skipped_bad_rows++;
        continue;
      }
      if (!RESOURCE_TYPES.includes(resource_type)) {
        skipped_bad_rows++;
        continue;
      }

      const existing = existsStmt.get(url);
      if (existing) {
        skipped_duplicates++;
        continue;
      }

      const tagsRaw = row[idx('tags')]?.trim() ?? '';
      const tags = tagsRaw ? tagsRaw.split('|').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 5) : [];

      const submitted_by = row[idx('submitted_by')]?.trim() || null;
      const date_added = row[idx('date_added')]?.trim() || new Date().toISOString();

      const result = insertStmt.run(
        title, url, description, resource_type,
        tags[0] ?? null, tags[1] ?? null, tags[2] ?? null, tags[3] ?? null, tags[4] ?? null,
        submitted_by, date_added
      );
      auditStmt.run(result.lastInsertRowid, 'import', ip);
      added++;
    }
  });

  importMany();

  return NextResponse.json({ added, skipped_duplicates, skipped_bad_rows });
}
