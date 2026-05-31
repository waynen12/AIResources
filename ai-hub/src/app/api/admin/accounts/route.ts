import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { auth } from '@/lib/auth';

type AccountRow = {
  id: number;
  username: string;
  role: string;
  is_active: number;
  created_at: string;
};

function requireAdmin() {
  return auth().then(session => {
    if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    if (session.user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    return { session };
  });
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const db = getDb();
  const rows = db.prepare(
    `SELECT id, username, role, is_active, created_at FROM accounts ORDER BY created_at ASC`
  ).all() as AccountRow[];

  return NextResponse.json(rows.map(r => ({ ...r, is_active: r.is_active === 1 })));
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json() as { username?: string; password?: string; role?: string };
  const { username, password, role } = body;

  if (!username?.trim()) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  if (!password || password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  if (!role || !['admin', 'contributor'].includes(role)) return NextResponse.json({ error: 'Role must be admin or contributor' }, { status: 400 });

  const db = getDb();
  const existing = db.prepare(`SELECT id FROM accounts WHERE username = ?`).get(username.trim());
  if (existing) return NextResponse.json({ error: `Account "${username.trim()}" already exists` }, { status: 409 });

  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare(
    `INSERT INTO accounts (username, password_hash, role) VALUES (?, ?, ?)`
  ).run(username.trim(), hash, role);

  return NextResponse.json({
    id: result.lastInsertRowid,
    username: username.trim(),
    role,
    is_active: true,
    created_at: new Date().toISOString(),
  }, { status: 201 });
}
