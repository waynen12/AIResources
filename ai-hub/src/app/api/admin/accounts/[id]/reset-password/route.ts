import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const targetId = parseInt(id, 10);
  if (isNaN(targetId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await request.json() as { password?: string };
  const { password } = body;

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const db = getDb();
  const account = db.prepare(`SELECT id FROM accounts WHERE id = ?`).get(targetId);
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const hash = await bcrypt.hash(password, 12);
  db.prepare(`UPDATE accounts SET password_hash = ? WHERE id = ?`).run(hash, targetId);

  return NextResponse.json({ success: true });
}
