import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { auth } from '@/lib/auth';

type AccountRow = {
  id: number;
  username: string;
  role: string;
  is_active: number;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const targetId = parseInt(id, 10);
  if (isNaN(targetId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await request.json() as { action?: string; role?: string };
  const { action, role } = body;

  const db = getDb();
  const account = db.prepare(`SELECT id, username, role, is_active FROM accounts WHERE id = ?`).get(targetId) as AccountRow | undefined;
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  if (action === 'deactivate') {
    if (targetId === Number(session.user.id)) {
      return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
    }
    const adminCount = (db.prepare(
      `SELECT COUNT(*) as c FROM accounts WHERE role = 'admin' AND is_active = 1`
    ).get() as { c: number }).c;
    if (account.role === 'admin' && adminCount <= 1) {
      return NextResponse.json({ error: 'Cannot deactivate the last active Admin' }, { status: 400 });
    }
    db.prepare(`UPDATE accounts SET is_active = 0 WHERE id = ?`).run(targetId);
    return NextResponse.json({ ...account, is_active: false });

  } else if (action === 'reactivate') {
    db.prepare(`UPDATE accounts SET is_active = 1 WHERE id = ?`).run(targetId);
    return NextResponse.json({ ...account, is_active: true });

  } else if (action === 'role') {
    if (!role || !['admin', 'contributor'].includes(role)) {
      return NextResponse.json({ error: 'Role must be admin or contributor' }, { status: 400 });
    }
    if (targetId === Number(session.user.id) && role !== 'admin') {
      const adminCount = (db.prepare(
        `SELECT COUNT(*) as c FROM accounts WHERE role = 'admin' AND is_active = 1`
      ).get() as { c: number }).c;
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot demote the last active Admin' }, { status: 400 });
      }
    }
    db.prepare(`UPDATE accounts SET role = ? WHERE id = ?`).run(role, targetId);
    return NextResponse.json({ ...account, role, is_active: account.is_active === 1 });

  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}
