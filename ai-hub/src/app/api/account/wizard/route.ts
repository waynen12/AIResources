import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const row = db.prepare(`SELECT show_wizard FROM accounts WHERE id = ?`).get(
    Number(session.user.id)
  ) as { show_wizard: number } | undefined;

  if (!row) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  return NextResponse.json({ show_wizard: row.show_wizard === 1 });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { show_wizard?: boolean };
  if (typeof body.show_wizard !== 'boolean') {
    return NextResponse.json({ error: 'show_wizard must be a boolean' }, { status: 400 });
  }

  const db = getDb();
  db.prepare(`UPDATE accounts SET show_wizard = ? WHERE id = ?`).run(
    body.show_wizard ? 1 : 0,
    Number(session.user.id)
  );

  return NextResponse.json({ ok: true });
}
