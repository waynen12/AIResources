'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Search, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import PersonalItemCard from '@/components/PersonalItemCard';
import AddResourceModal from '@/components/AddResourceModal';
import type { PersonalItem, Resource } from '@/lib/db';

const PAGE_SIZE = 12;

type Counts = { not_started: number; in_progress: number; done: number };

type ApiResponse = {
  items: PersonalItem[];
  total: number;
  page: number;
  hasMore: boolean;
  counts: Counts;
};

type Props = {
  aiEnabled: boolean;
  aiHasProvider: boolean;
  existingTags: string[];
};

export default function PersonalTab({ aiEnabled, aiHasProvider, existingTags }: Props) {
  const [items, setItems] = useState<PersonalItem[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>({ not_started: 0, in_progress: 0, done: 0 });
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [smartMode, setSmartMode] = useState(false);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiSearchActive, setAiSearchActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PersonalItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<PersonalItem | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async (searchTerm: string, pageNum: number, replace: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/personal-items?search=${encodeURIComponent(searchTerm)}&page=${pageNum}`);
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      setItems(prev => replace ? data.items : [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setTotal(data.total);
      setPage(pageNum);
      if (replace) setCounts(data.counts);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchItems('', 1, true);
  }, [fetchItems]);

  useEffect(() => {
    if (initialLoad) return;
    if (smartMode) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchItems(search, 1, true);
    }, 250);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, fetchItems, initialLoad, smartMode]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        fetchItems(search, page + 1, false);
      }
    }, { rootMargin: '200px' });
    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [hasMore, loading, page, search, fetchItems]);

  async function handleSmartSearch() {
    if (!search.trim() || aiSearching) return;
    setAiSearching(true);
    try {
      const res = await fetch('/api/ai/personal-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: search.trim() }),
      });
      if (!res.ok) {
        toast.error('AI search failed — try keyword search instead');
        return;
      }
      const data = await res.json() as { items: PersonalItem[] };
      setItems(data.items);
      setTotal(data.items.length);
      setHasMore(false);
      setAiSearchActive(true);
    } catch {
      toast.error('AI search failed — check your connection');
    } finally {
      setAiSearching(false);
    }
  }

  function handleItemAdded(resource: Resource) {
    const item = resource as unknown as PersonalItem;
    setItems(prev => [item, ...prev]);
    setTotal(t => t + 1);
    setCounts(c => ({ ...c, not_started: c.not_started + 1 }));
  }

  function handleItemUpdated(resource: Resource) {
    const updated = resource as unknown as PersonalItem;
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  }

  function handleStatusChange(updated: PersonalItem) {
    setItems(prev => {
      const old = prev.find(i => i.id === updated.id);
      if (!old) return prev;
      const next = prev.map(i => i.id === updated.id ? updated : i);
      setCounts(c => {
        const newCounts = { ...c };
        newCounts[old.status] = Math.max(0, newCounts[old.status] - 1);
        newCounts[updated.status] = newCounts[updated.status] + 1;
        return newCounts;
      });
      return next;
    });
  }

  async function handleDelete(item: PersonalItem) {
    setDeletingItem(null);
    try {
      const res = await fetch(`/api/personal-items/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setItems(prev => prev.filter(i => i.id !== item.id));
      setTotal(t => t - 1);
      setCounts(c => ({ ...c, [item.status]: Math.max(0, c[item.status] - 1) }));
      toast.success('Item removed from My Learning');
    } catch {
      toast.error('Failed to delete item');
    }
  }

  function handleEditClose() {
    setEditingItem(null);
    setModalOpen(false);
  }

  const personalItemAsResource = (item: PersonalItem): Resource => ({
    id: item.id,
    title: item.title,
    url: item.url,
    description: item.description,
    resource_type: item.resource_type,
    tags: item.tags,
    submitted_by: null,
    account_id: item.account_id,
    date_added: item.date_added,
  });

  return (
    <div>
      {/* Search bar */}
      <div className="px-6 py-4 max-w-6xl mx-auto">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Input
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              if (smartMode && aiSearchActive) {
                setAiSearchActive(false);
                fetchItems('', 1, true);
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && smartMode && search.trim()) {
                handleSmartSearch();
              }
            }}
            placeholder={smartMode ? 'Ask anything — press Enter to search...' : 'Search your items...'}
            disabled={aiSearching}
            className="pl-9 pr-11 h-10 text-sm"
          />
          {aiEnabled && aiHasProvider && (
            <button
              type="button"
              onClick={() => {
                if (smartMode) {
                  setSmartMode(false);
                  setAiSearchActive(false);
                  fetchItems(search, 1, true);
                } else {
                  setSmartMode(true);
                  if (search) fetchItems('', 1, true);
                }
              }}
              title={smartMode ? 'Switch to keyword search' : 'Switch to AI smart search'}
              className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 transition-colors ${
                smartMode ? 'text-amber-500 bg-amber-50' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {aiSearching
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Sparkles className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 max-w-6xl mx-auto">
        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
          {initialLoad ? ' ' : aiSearchActive
            ? <><Sparkles className="h-3.5 w-3.5 text-amber-500" />{total} AI result{total !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;</>
            : total === 0
              ? 'No items yet'
              : `${total} item${total !== 1 ? 's' : ''} — ${counts.not_started} to read · ${counts.in_progress} in progress · ${counts.done} done`
          }
        </span>
        <button
          onClick={() => { setEditingItem(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-md hover:brightness-110 transition-all"
          style={{ background: '#F57C00' }}
        >
          <Plus className="h-4 w-4" />
          Add Personal Item
        </button>
      </div>

      {/* Grid */}
      <main className="px-6 pb-16 max-w-6xl mx-auto">
        {!initialLoad && items.length === 0 && (
          <div className="text-center py-24 text-muted-foreground">
            {search
              ? `No items found for "${search}"`
              : 'Nothing here yet — save a Resource or News article to get started.'}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map(item => (
            <PersonalItemCard
              key={item.id}
              item={item}
              onEdit={i => { setEditingItem(i); setModalOpen(true); }}
              onDelete={i => setDeletingItem(i)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
        <div ref={loaderRef} className="h-8 mt-4 flex items-center justify-center">
          {loading && !initialLoad && (
            <span className="text-sm text-muted-foreground animate-pulse">Loading more...</span>
          )}
        </div>
      </main>

      {/* Delete confirmation */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-base mb-2">Remove from My Learning?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              &ldquo;{deletingItem.title}&rdquo; will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingItem)}
                className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:brightness-110 transition-all"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <AddResourceModal
        open={modalOpen}
        onClose={handleEditClose}
        onAdded={handleItemAdded}
        onUpdated={handleItemUpdated}
        existingTags={existingTags}
        editing={editingItem ? personalItemAsResource(editingItem) : null}
        aiEnabled={aiEnabled}
        aiHasProvider={aiHasProvider}
        destination="personal"
      />
    </div>
  );
}
