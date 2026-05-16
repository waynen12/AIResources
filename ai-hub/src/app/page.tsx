'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ResourceCard from '@/components/ResourceCard';
import AddResourceModal from '@/components/AddResourceModal';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import ThemeToggle from '@/components/ThemeToggle';
import type { Resource } from '@/lib/db';

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? 'AI Hub';

type ApiResponse = {
  resources: Resource[];
  total: number;
  page: number;
  hasMore: boolean;
};

export default function Home() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [deletingResource, setDeletingResource] = useState<Resource | null>(null);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  async function fetchTags() {
    const res = await fetch('/api/tags');
    if (res.ok) setExistingTags(await res.json());
  }

  const fetchResources = useCallback(async (searchTerm: string, pageNum: number, replace: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resources?search=${encodeURIComponent(searchTerm)}&page=${pageNum}`);
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      setResources(prev => replace ? data.resources : [...prev, ...data.resources]);
      setHasMore(data.hasMore);
      setTotal(data.total);
      setPage(pageNum);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchResources('', 1, true);
    fetchTags();
  }, [fetchResources]);

  useEffect(() => {
    if (initialLoad) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchResources(search, 1, true);
    }, 250);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, fetchResources, initialLoad]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        fetchResources(search, page + 1, false);
      }
    }, { rootMargin: '200px' });

    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [hasMore, loading, page, search, fetchResources]);

  function handleResourceAdded(resource: Resource) {
    setResources(prev => [resource, ...prev]);
    setTotal(t => t + 1);
    fetchTags();
  }

  function handleResourceUpdated(resource: Resource) {
    setResources(prev => prev.map(r => r.id === resource.id ? resource : r));
    fetchTags();
  }

  function handleResourceDeleted(id: number) {
    setResources(prev => prev.filter(r => r.id !== id));
    setTotal(t => t - 1);
    fetchTags();
  }

  function handleEditClose() {
    setEditingResource(null);
    setModalOpen(false);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav
        className="relative z-10 flex items-center justify-between px-6 py-4"
        style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)' }}
      >
        <span className="text-white font-bold text-xl tracking-tight">{SITE_NAME}</span>
        <ThemeToggle />
      </nav>

      {/* Hero */}
      <div
        className="px-6 pb-12 text-center -mt-15 pt-18"
        style={{ background: 'linear-gradient(135deg, #F57C00 0%, #FF8F00 40%, #7B6FBD 80%, #4A5BAA 100%)' }}
      >
        <h1 className="text-4xl font-extrabold text-white mb-2 drop-shadow-sm">{SITE_NAME}</h1>
        <p className="text-white/85 text-base mb-6">Tutorials, articles, videos and courses for the team</p>
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, description or tag..."
            className="pl-9 bg-white border-none shadow-lg h-11 text-sm"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="text-sm text-muted-foreground">
          {initialLoad ? '\u00a0' : `${total} resource${total !== 1 ? 's' : ''}${search ? ` matching "${search}"` : ''}`}
        </span>
        <button
          onClick={() => { setEditingResource(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-md hover:brightness-110 transition-all"
          style={{ background: '#F57C00' }}
        >
          <Plus className="h-4 w-4" />
          Add Resource
        </button>
      </div>

      {/* Grid */}
      <main className="px-6 pb-16 max-w-6xl mx-auto">
        {!initialLoad && resources.length === 0 && (
          <div className="text-center py-24 text-muted-foreground">
            {search ? `No resources found for "${search}"` : 'No resources yet \u2014 be the first to add one!'}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {resources.map(r => (
            <ResourceCard
              key={r.id}
              resource={r}
              onTagClick={setSearch}
              onEdit={resource => { setEditingResource(resource); setModalOpen(true); }}
              onDelete={setDeletingResource}
            />
          ))}
        </div>

        <div ref={loaderRef} className="h-8 mt-4 flex items-center justify-center">
          {loading && !initialLoad && (
            <span className="text-sm text-muted-foreground animate-pulse">Loading more...</span>
          )}
        </div>
      </main>

      <AddResourceModal
        open={modalOpen}
        onClose={handleEditClose}
        onAdded={handleResourceAdded}
        onUpdated={handleResourceUpdated}
        existingTags={existingTags}
        editing={editingResource}
      />

      <DeleteConfirmModal
        resource={deletingResource}
        onClose={() => setDeletingResource(null)}
        onDeleted={handleResourceDeleted}
      />
    </div>
  );
}
