'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import type { Resource } from '@/lib/db';

const TYPE_COLOURS: Record<string, string> = {
  YouTube: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Article: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Course: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Documentation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Tool: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Props = {
  resource: Resource;
  onTagClick: (tag: string) => void;
  onEdit: (resource: Resource) => void;
  onDelete: (resource: Resource) => void;
  sessionAccountId?: number | null;
  sessionRole?: 'admin' | 'contributor';
};

export default function ResourceCard({ resource, onTagClick, onEdit, onDelete, sessionAccountId, sessionRole }: Props) {
  const canMutate = sessionRole === 'admin' || resource.account_id === sessionAccountId;
  const typeClass = TYPE_COLOURS[resource.resource_type] ?? TYPE_COLOURS.Other;
  const descRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const el = descRef.current;
    if (!el || isExpanded) return;
    const check = () => setIsTruncated(el.scrollHeight > el.clientHeight);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isExpanded]);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${typeClass}`}>
          {resource.resource_type}
        </span>
        <div className="flex items-center gap-1">
          {canMutate && (
            <button
              onClick={() => onEdit(resource)}
              className="text-muted-foreground hover:text-amber-500 transition-colors p-0.5 rounded"
              aria-label="Edit resource"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {canMutate && (
            <button
              onClick={() => onDelete(resource)}
              className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
              aria-label="Delete resource"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-amber-500 transition-colors p-0.5 rounded"
            aria-label="Open resource"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-base leading-snug text-card-foreground line-clamp-2">
          {resource.title}
        </h3>
        <p
          ref={descRef}
          className={`text-sm text-muted-foreground mt-1 leading-relaxed${isExpanded ? '' : ' line-clamp-3'}`}
        >
          {resource.description}
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

      {resource.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {resource.tags.map(tag => (
            <button
              key={tag}
              onClick={() => onTagClick(tag)}
              className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center text-xs text-muted-foreground/70 border-t border-border pt-2 mt-auto">
        <span>{resource.submitted_by ? `Added by ${resource.submitted_by}` : 'Anonymous'}</span>
        <span>{formatDate(resource.date_added)}</span>
      </div>
    </div>
  );
}
