import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, ResourceSummary, UrlMetadata } from './provider';

const RESOURCE_TYPES = ['YouTube', 'Article', 'Course', 'Documentation', 'Tool', 'Other'];

const FETCH_SYSTEM = `You are an assistant that extracts structured metadata from web pages.
You will receive pre-extracted page metadata (title, description, og tags, headings).
Respond ONLY with a valid JSON object — no markdown, no explanation.
The JSON must have exactly these keys:
  title         (string, concise page title)
  description   (string, 1-2 sentence summary of what this resource covers)
  resource_type (one of: ${RESOURCE_TYPES.join(', ')})
  tags          (array of 1-5 lowercase keyword strings relevant to AI/tech topics)`;

const TAG_SYSTEM = `You are an assistant that suggests relevant tags for a resource.
Respond ONLY with a JSON array of lowercase tag strings — no markdown, no explanation.
Return 1-5 tags. Prefer tags from the existing tag list when they fit.`;

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_CHARS = 50_000;

const YOUTUBE_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'youtu.be', 'm.youtube.com']);

function isYouTube(url: string): boolean {
  try { return YOUTUBE_HOSTS.has(new URL(url).hostname); } catch { return false; }
}

type OEmbedResult = { title: string; author_name: string };

async function fetchYouTubeOEmbed(url: string): Promise<OEmbedResult | null> {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.json() as OEmbedResult;
  } catch {
    return null;
  }
}

function extractMetaSignals(html: string, url: string): string {
  const lines: string[] = [`URL: ${url}`];

  const attr = (tag: string, ...attrPairs: [string, string][]): string | null => {
    for (const [key, val] of attrPairs) {
      // match either attribute order: key=... content=... or content=... key=...
      const patterns = [
        new RegExp(`<${tag}[^>]+${key}=["']${val}["'][^>]+content=["']([^"']{1,500})["']`, 'i'),
        new RegExp(`<${tag}[^>]+content=["']([^"']{1,500})["'][^>]+${key}=["']${val}["']`, 'i'),
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m?.[1]) return m[1].trim();
      }
    }
    return null;
  };

  const titleTag = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim();
  if (titleTag) lines.push(`title: ${titleTag}`);

  const ogTitle = attr('meta', ['property', 'og:title']);
  if (ogTitle) lines.push(`og:title: ${ogTitle}`);

  const ogDesc = attr('meta', ['property', 'og:description']);
  if (ogDesc) lines.push(`og:description: ${ogDesc}`);

  const metaDesc = attr('meta', ['name', 'description']);
  if (metaDesc) lines.push(`meta description: ${metaDesc}`);

  const twitterTitle = attr('meta', ['name', 'twitter:title']);
  if (twitterTitle) lines.push(`twitter:title: ${twitterTitle}`);

  const twitterDesc = attr('meta', ['name', 'twitter:description']);
  if (twitterDesc) lines.push(`twitter:description: ${twitterDesc}`);

  const h1s = [...html.matchAll(/<h1[^>]*>([^<]{1,150})<\/h1>/gi)].map(m => m[1].trim());
  if (h1s.length) lines.push(`h1: ${h1s.join(' | ')}`);

  return lines.join('\n');
}

async function fetchPageSignals(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIHub-autofill/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const html = await res.text();
    return extractMetaSignals(html.slice(0, MAX_HTML_CHARS), url);
  } finally {
    clearTimeout(timer);
  }
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async fetchUrlMetadata(url: string): Promise<UrlMetadata> {
    let signals: string;
    let forcedType: string | null = null;

    if (isYouTube(url)) {
      forcedType = 'YouTube';
      const [oembed, pageSignals] = await Promise.all([
        fetchYouTubeOEmbed(url),
        fetchPageSignals(url).catch(() => ''),
      ]);
      const parts: string[] = [`URL: ${url}`, `resource_type: YouTube`];
      if (oembed?.title) parts.push(`title: ${oembed.title}`);
      if (oembed?.author_name) parts.push(`channel: ${oembed.author_name}`);
      // append og:description and other signals from page HTML
      const extra = pageSignals.split('\n').filter(l =>
        l.startsWith('og:description') || l.startsWith('meta description') || l.startsWith('twitter:description')
      );
      parts.push(...extra);
      signals = parts.join('\n');
    } else {
      signals = await fetchPageSignals(url);
    }

    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: FETCH_SYSTEM,
      messages: [{
        role: 'user',
        content: `Extract metadata from these page signals:\n\n${signals}`,
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Anthropic');
    }

    const jsonText = textBlock.text.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(jsonText) as Partial<UrlMetadata>;
    return {
      title: parsed.title ?? '',
      description: parsed.description ?? '',
      resource_type: forcedType ?? (RESOURCE_TYPES.includes(parsed.resource_type ?? '') ? parsed.resource_type! : 'Other'),
      tags: (parsed.tags ?? []).slice(0, 5).map(t => t.toLowerCase().trim()),
    };
  }

  async suggestTags(title: string, description: string, existingTags: string[]): Promise<string[]> {
    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 128,
      system: TAG_SYSTEM,
      messages: [{
        role: 'user',
        content: `Title: ${title}\nDescription: ${description}\nExisting tags to prefer: ${existingTags.join(', ')}`,
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return [];

    const parsed = JSON.parse(textBlock.text) as string[];
    return parsed.slice(0, 5).map(t => t.toLowerCase().trim());
  }

  async smartSearch(query: string, resources: ResourceSummary[]): Promise<number[]> {
    if (resources.length === 0) return [];

    const catalog = JSON.stringify(
      resources.map(r => ({ id: r.id, title: r.title, description: r.description, tags: r.tags }))
    );

    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system: `You are a search engine for a team library of AI and tech learning resources.
Given a natural-language query and a JSON catalog of resources, return a JSON array of resource IDs that are relevant to the query, ranked by relevance (most relevant first).
Only include IDs of genuinely relevant resources. Return [] if nothing matches.
Respond ONLY with a JSON array of integers — no markdown, no explanation.`,
      messages: [{
        role: 'user',
        content: `Query: "${query}"\n\nCatalog:\n${catalog}`,
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return [];

    const jsonText = textBlock.text.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
    const ids = JSON.parse(jsonText) as unknown[];
    return ids.filter((id): id is number => typeof id === 'number');
  }
}
