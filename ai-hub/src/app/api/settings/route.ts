import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('ai_enabled') as { value: string } | undefined;
  return NextResponse.json({ ai_enabled: row?.value === 'true' });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (typeof body.ai_enabled !== 'boolean') {
    return NextResponse.json({ error: 'ai_enabled must be a boolean' }, { status: 400 });
  }
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run('ai_enabled', body.ai_enabled ? 'true' : 'false');
  return NextResponse.json({ ai_enabled: body.ai_enabled });
}
