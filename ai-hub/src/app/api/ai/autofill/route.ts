import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { url } = body as { url?: string };

  if (!url?.trim()) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  const provider = getAIProvider();
  if (!provider) {
    return NextResponse.json({ error: 'AI provider not configured' }, { status: 503 });
  }

  try {
    const metadata = await provider.fetchUrlMetadata(url.trim());
    return NextResponse.json(metadata);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[autofill] error:', message, err);
    if (message.includes('401') || message.toLowerCase().includes('authentication')) {
      return NextResponse.json({ error: 'Invalid API key — check your Settings' }, { status: 401 });
    }
    if (message.includes('402') || message.toLowerCase().includes('quota') || message.toLowerCase().includes('balance')) {
      return NextResponse.json({ error: 'API quota exhausted — check your account balance' }, { status: 402 });
    }
    if (message.toLowerCase().includes('fetch') || message.includes('HTTP ') || message.includes('abort')) {
      return NextResponse.json({ error: 'Could not fetch that URL — check the link is publicly accessible' }, { status: 422 });
    }
    return NextResponse.json({ error: 'Could not reach the AI provider — check your connection' }, { status: 503 });
  }
}
