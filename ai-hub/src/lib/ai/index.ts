import { getDb } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { AnthropicProvider } from './anthropic';
import type { AIProvider } from './provider';

export function getAIProvider(): AIProvider | null {
  const db = getDb();

  const aiEnabled = (db.prepare('SELECT value FROM app_settings WHERE key = ?').get('ai_enabled') as { value: string } | undefined)?.value;
  if (aiEnabled !== 'true') return null;

  const row = db.prepare('SELECT provider_name, encrypted_api_key FROM ai_providers WHERE is_active = 1 LIMIT 1').get() as
    | { provider_name: string; encrypted_api_key: string | null }
    | undefined;

  if (!row?.encrypted_api_key) return null;

  try {
    const apiKey = decrypt(row.encrypted_api_key);
    if (row.provider_name === 'anthropic') {
      return new AnthropicProvider(apiKey);
    }
  } catch {
    return null;
  }

  return null;
}

export type { AIProvider };
