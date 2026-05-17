import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/encryption';

type ProviderRow = { provider_name: string; encrypted_api_key: string | null };

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { provider_name, api_key } = body as { provider_name?: string; api_key?: string };

  if (!provider_name?.trim()) {
    return NextResponse.json({ error: 'provider_name is required' }, { status: 400 });
  }

  let keyToTest: string | null = null;

  if (api_key?.trim()) {
    keyToTest = api_key.trim();
  } else {
    const db = getDb();
    const row = db.prepare('SELECT encrypted_api_key FROM ai_providers WHERE provider_name = ?').get(provider_name) as ProviderRow | undefined;
    if (row?.encrypted_api_key) {
      try {
        keyToTest = decrypt(row.encrypted_api_key);
      } catch {
        return NextResponse.json({ error: 'Could not decrypt stored key' }, { status: 500 });
      }
    }
  }

  if (!keyToTest) {
    return NextResponse.json({ error: 'No API key to test' }, { status: 400 });
  }

  if (provider_name === 'anthropic') {
    try {
      const client = new Anthropic({ apiKey: keyToTest });
      await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'ping' }],
      });

      if (api_key?.trim()) {
        try {
          const db = getDb();
          const encryptedKey = encrypt(api_key.trim());
          db.prepare(`
            INSERT INTO ai_providers (provider_name, encrypted_api_key, is_active, updated_at)
            VALUES (?, ?, 1, datetime('now'))
            ON CONFLICT(provider_name) DO UPDATE SET
              encrypted_api_key = excluded.encrypted_api_key,
              updated_at = datetime('now')
          `).run(provider_name, encryptedKey);
        } catch {
          /* non-fatal — key already tested OK */
        }
      }

      return NextResponse.json({ success: true });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }
      if (err instanceof Anthropic.PermissionDeniedError) {
        return NextResponse.json({ error: 'API account balance exhausted' }, { status: 402 });
      }
      return NextResponse.json({ error: 'Could not reach the AI provider' }, { status: 503 });
    }
  }

  return NextResponse.json({ error: `Unknown provider: ${provider_name}` }, { status: 400 });
}
