import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

type ProviderRow = {
  provider_name: string;
  encrypted_api_key: string | null;
  is_active: number;
};

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT provider_name, encrypted_api_key, is_active FROM ai_providers').all() as ProviderRow[];
  return NextResponse.json(
    rows.map(r => ({
      provider_name: r.provider_name,
      is_active: r.is_active === 1,
      has_key: !!r.encrypted_api_key,
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { provider_name, api_key } = body as { provider_name?: string; api_key?: string };

  if (!provider_name?.trim()) {
    return NextResponse.json({ error: 'provider_name is required' }, { status: 400 });
  }

  const db = getDb();

  if (api_key?.trim()) {
    let encryptedKey: string;
    try {
      encryptedKey = encrypt(api_key.trim());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Encryption failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    db.prepare(`
      INSERT INTO ai_providers (provider_name, encrypted_api_key, is_active, updated_at)
      VALUES (?, ?, 1, datetime('now'))
      ON CONFLICT(provider_name) DO UPDATE SET
        encrypted_api_key = excluded.encrypted_api_key,
        is_active = 1,
        updated_at = datetime('now')
    `).run(provider_name, encryptedKey);
  } else {
    db.prepare(`
      INSERT INTO ai_providers (provider_name, is_active, updated_at)
      VALUES (?, 1, datetime('now'))
      ON CONFLICT(provider_name) DO UPDATE SET
        is_active = 1,
        updated_at = datetime('now')
    `).run(provider_name);
  }

  db.prepare('UPDATE ai_providers SET is_active = 0 WHERE provider_name != ?').run(provider_name);

  const row = db.prepare('SELECT provider_name, encrypted_api_key, is_active FROM ai_providers WHERE provider_name = ?').get(provider_name) as ProviderRow;
  return NextResponse.json({
    provider_name: row.provider_name,
    is_active: row.is_active === 1,
    has_key: !!row.encrypted_api_key,
  });
}
