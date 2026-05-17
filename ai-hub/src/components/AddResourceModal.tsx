'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Resource } from '@/lib/db';

const RESOURCE_TYPES = ['YouTube', 'Article', 'Course', 'Documentation', 'Tool', 'Other'];

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: (resource: Resource) => void;
  onUpdated: (resource: Resource) => void;
  existingTags: string[];
  editing?: Resource | null;
  aiEnabled?: boolean;
  aiHasProvider?: boolean;
};

export default function AddResourceModal({ open, onClose, onAdded, onUpdated, existingTags, editing, aiEnabled = false, aiHasProvider = false }: Props) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [submittedBy, setSubmittedBy] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [error, setError] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && editing) {
      setTitle(editing.title);
      setUrl(editing.url);
      setDescription(editing.description);
      setResourceType(editing.resource_type);
      setSubmittedBy(editing.submitted_by ?? '');
      setTags(editing.tags);
    } else if (!open) {
      setTitle(''); setUrl(''); setDescription(''); setResourceType('');
      setSubmittedBy(''); setTags([]); setTagInput(''); setError('');
    }
  }, [open, editing]);

  function handleTagInput(value: string) {
    setTagInput(value);
    if (value.trim()) {
      setTagSuggestions(
        existingTags.filter(t => t.includes(value.toLowerCase().trim()) && !tags.includes(t))
      );
    } else {
      setTagSuggestions([]);
    }
  }

  function addTag(tag: string) {
    const normalized = tag.toLowerCase().trim();
    if (normalized && !tags.includes(normalized) && tags.length < 5) {
      setTags([...tags, normalized]);
    }
    setTagInput('');
    setTagSuggestions([]);
    tagInputRef.current?.focus();
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(tags.slice(0, -1));
    }
  }

  async function handleAutofill() {
    if (!url.trim()) return;
    setAutofilling(true);
    try {
      const res = await fetch('/api/ai/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Auto-fill failed');
        return;
      }
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.resource_type) setResourceType(data.resource_type);
      if (Array.isArray(data.tags) && data.tags.length > 0) {
        setTags(data.tags.slice(0, 5));
      }
    } catch {
      toast.error('Could not reach the AI provider — check your connection');
    } finally {
      setAutofilling(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const isEdit = !!editing;
      const res = await fetch(isEdit ? `/api/resources/${editing.id}` : '/api/resources', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, url, description, resource_type: resourceType, tags, submitted_by: submittedBy }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to save');
      }
      const resource = await res.json();
      if (isEdit) {
        onUpdated(resource);
      } else {
        onAdded(resource);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_open, details) => { if (details.reason === 'close-press') onClose(); }}
      disablePointerDismissal
    >
      <DialogContent className="sm:max-w-130">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Resource' : 'Add a Resource'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Getting Started with GitHub Copilot" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="url">URL <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <Input id="url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." required className="flex-1" />
              {aiEnabled && (
                <button
                  type="button"
                  onClick={handleAutofill}
                  disabled={autofilling || !url.trim() || !aiHasProvider}
                  title={aiHasProvider ? 'Auto-fill from URL' : 'Configure an AI provider in Settings to use this feature'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-400 bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-600 dark:hover:bg-amber-950/50 whitespace-nowrap"
                >
                  {autofilling
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Filling...</>
                    : <><Sparkles className="h-3.5 w-3.5" />Auto-fill</>}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A short summary of what this resource covers..."
              required
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Type <span className="text-destructive">*</span></Label>
            <Select value={resourceType} onValueChange={(v) => setResourceType(v ?? '')} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a type..." />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tags <span className="text-muted-foreground text-xs">(up to 5, press Enter or comma to add)</span></Label>
            <div className="flex flex-wrap gap-1.5 p-2 border border-input rounded-md min-h-10.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="rounded-full hover:bg-muted ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {tags.length < 5 && (
                <input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={e => handleTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={tags.length === 0 ? 'Type a tag...' : ''}
                  className="flex-1 min-w-20 outline-none bg-transparent text-sm placeholder:text-muted-foreground"
                />
              )}
            </div>
            {tagSuggestions.length > 0 && (
              <div className="border border-input rounded-md shadow-sm bg-background overflow-hidden">
                {tagSuggestions.slice(0, 6).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="submittedBy">Your name <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input id="submittedBy" value={submittedBy} onChange={e => setSubmittedBy(e.target.value)} placeholder="e.g. Wayne" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting || !resourceType}>
              {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Add Resource'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
