import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { currentPassword?: string; newPassword?: string };
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Both fields are required' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }

  const db = getDb();
  const accountId = Number(session.user.id);
  const account = db.prepare(
    `SELECT id, password_hash FROM accounts WHERE id = ? AND is_active = 1`
  ).get(accountId) as { id: number; password_hash: string } | undefined;

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, account.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  db.prepare(`UPDATE accounts SET password_hash = ? WHERE id = ?`).run(newHash, accountId);

  return NextResponse.json({ success: true });
}
