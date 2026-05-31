'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import AddResourceModal from '@/components/AddResourceModal';
import type { Resource } from '@/lib/db';

type Article = { title: string; url: string };

type NewsItem = {
  id: number;
  digest_html: string;
  articles: Article[];
  published_at: string;
};

type Props = {
  aiEnabled: boolean;
  aiHasProvider: boolean;
  existingTags: string[];
  onResourceAdded: (resource: Resource) => void;
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function NewsTab({ aiEnabled, aiHasProvider, existingTags, onResourceAdded }: Props) {
  const [feed, setFeed] = useState<'daily' | 'weekly'>('daily');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedArticles, setExpandedArticles] = useState<Set<number>>(new Set());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [promoteUrl, setPromoteUrl] = useState('');

  useEffect(() => {
    setLoading(true);
    setItems([]);
    fetch(`/api/news?feed=${feed}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { items: NewsItem[] }) => setItems(data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [feed]);

  function toggleArticles(id: number) {
    setExpandedArticles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handlePromote(url: string) {
    setPromoteUrl(url);
    setAddModalOpen(true);
  }

  return (
    <div className="px-6 pb-16 max-w-4xl mx-auto">
      {/* Pill toggle */}
      <div className="flex justify-center my-6">
        <div className="flex rounded-full border border-input bg-muted p-1 gap-1">
          {(['daily', 'weekly'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFeed(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                feed === f
                  ? 'bg-white dark:bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'daily' ? 'General AI News' : 'Learning Radar'}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-24 text-muted-foreground">
          No {feed === 'daily' ? 'daily AI news' : 'Learning Radar'} digests yet.
        </div>
      )}

      <div className="space-y-8">
        {items.map(item => (
          <div key={item.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            {/* Date header */}
            <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/30">
              <time className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {formatDate(item.published_at)}
              </time>
            </div>

            {/* Digest HTML */}
            <div
              className="px-5 py-4 prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: item.digest_html }}
            />

            {/* Articles / Save to Resources */}
            {item.articles.length > 0 && (
              <div className="border-t">
                <button
                  onClick={() => toggleArticles(item.id)}
                  className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <span>{item.articles.length} article{item.articles.length !== 1 ? 's' : ''}</span>
                  {expandedArticles.has(item.id)
                    ? <ChevronUp className="h-4 w-4" />
                    : <ChevronDown className="h-4 w-4" />
                  }
                </button>
                {expandedArticles.has(item.id) && (
                  <div className="divide-y">
                    {item.articles.map((article, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm flex-1 truncate hover:text-amber-600 dark:hover:text-amber-400"
                        >
                          {article.title}
                        </a>
                        <button
                          onClick={() => handlePromote(article.url)}
                          className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-md border border-amber-400 text-amber-700 dark:text-amber-400 dark:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                        >
                          Save to Resources
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <AddResourceModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={resource => { onResourceAdded(resource); setAddModalOpen(false); }}
        onUpdated={() => {}}
        existingTags={existingTags}
        editing={null}
        initialUrl={promoteUrl}
        aiEnabled={aiEnabled}
        aiHasProvider={aiHasProvider}
      />
    </div>
  );
}
