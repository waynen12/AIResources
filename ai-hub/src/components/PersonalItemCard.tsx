'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PersonalItem } from '@/lib/db';

const TYPE_COLOURS: Record<string, string> = {
  YouTube: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Article: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Course: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Documentation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Tool: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_LABELS: Record<PersonalItem['status'], string> = {
  not_started: 'To Read/Watch',
  in_progress: 'In Progress',
  done: 'Done',
};

const STATUS_COLOURS: Record<PersonalItem['status'], string> = {
  not_started: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const STATUSES: PersonalItem['status'][] = ['not_started', 'in_progress', 'done'];

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Props = {
  item: PersonalItem;
  onEdit: (item: PersonalItem) => void;
  onDelete: (item: PersonalItem) => void;
  onStatusChange: (item: PersonalItem) => void;
};

export default function PersonalItemCard({ item, onEdit, onDelete, onStatusChange }: Props) {
  const typeClass = TYPE_COLOURS[item.resource_type] ?? TYPE_COLOURS.Other;
  const descRef = useRef<HTMLParagraphElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<PersonalItem['status']>(item.status);

  useEffect(() => { setCurrentStatus(item.status); }, [item.status]);

  useEffect(() => {
    const el = descRef.current;
    if (!el || isExpanded) return;
    const check = () => setIsTruncated(el.scrollHeight > el.clientHeight);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isExpanded]);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  async function handleStatusSelect(status: PersonalItem['status']) {
    setDropdownOpen(false);
    if (status === currentStatus) return;
    setCurrentStatus(status);
    try {
      const res = await fetch(`/api/personal-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const updated: PersonalItem = await res.json();
      onStatusChange(updated);
    } catch {
      setCurrentStatus(item.status);
      toast.error('Failed to update status');
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${typeClass}`}>
          {item.resource_type}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(item)}
            className="text-muted-foreground hover:text-amber-500 transition-colors p-0.5 rounded"
            aria-label="Edit item"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(item)}
            className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
            aria-label="Delete item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-amber-500 transition-colors p-0.5 rounded"
            aria-label="Open link"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-base leading-snug text-card-foreground line-clamp-2">
          {item.title}
        </h3>
        <p
          ref={descRef}
          className={`text-sm text-muted-foreground mt-1 leading-relaxed${isExpanded ? '' : ' line-clamp-3'}`}
        >
          {item.description}
        </p>
        {isTruncated && (
          <button
            onClick={() => setIsExpanded(e => !e)}
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-amber-500 transition-colors mt-1"
          >
            {isExpanded ? 'Show less' : 'Show more'}
            <ChevronDown className={`h-3 w-3 transition-transform${isExpanded ? ' rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map(tag => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center border-t border-border pt-2 mt-auto">
        {/* Status badge with dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md transition-colors ${STATUS_COLOURS[currentStatus]}`}
          >
            {STATUS_LABELS[currentStatus]}
            <ChevronDown className="h-3 w-3" />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-20 min-w-36 rounded-md border border-border bg-popover shadow-md overflow-hidden">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusSelect(s)}
                  className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${s === currentStatus ? 'opacity-50 cursor-default' : ''}`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground/70">{formatDate(item.date_added)}</span>
      </div>
    </div>
  );
}
