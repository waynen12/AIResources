'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? 'Learning Hub';

type Props = {
  open: boolean;
  initialShowAtLogin?: boolean;
  onSkip: () => void;
  onFinish: (showAtLogin: boolean) => void;
};

const PANELS = [
  {
    title: `Welcome to ${SITE_NAME}`,
    subtitle: 'A shared library of tutorials, articles, videos, and courses — plus your own private learning space.',
    body: `${SITE_NAME} is a single place to discover, save, and track learning resources. Browse and search the shared library, follow daily AI news and insights, and keep a private list of anything you want to learn — on any topic.`,
    image: null,
  },
  {
    title: 'Resources',
    subtitle: "Browse, search, and save the team's shared AI learning library.",
    body: 'Use the search bar to find resources by title, description, or tag. Enable AI Smart Search (✨) to ask in plain English — e.g. "beginner Python tutorials". Click the bookmark icon on any card to save a resource to your personal My Learning list.',
    image: '/wizard-resources.png',
  },
  {
    title: 'News',
    subtitle: 'Stay up to date with daily AI news and weekly learning radar digests.',
    body: 'Two feeds: General AI News (daily) and Learning Radar (weekly). Expand any digest to see individual articles. Promote an article to the shared Resources library, or save it straight to your My Learning list — no form needed.',
    image: '/wizard-news.png',
  },
  {
    title: 'My Learning',
    subtitle: 'Your private learning list — only you can see it.',
    body: "My Learning is entirely yours — it's private, and it's not limited to AI. Add anything you want to learn: a cooking course, a language, a programming language, a new framework. Track progress with To Read, In Progress, and Done status badges, and use AI Smart Search to find items by topic.",
    image: '/wizard-learning.png',
  },
];

export default function WizardModal({ open, initialShowAtLogin = true, onSkip, onFinish }: Props) {
  const [currentPanel, setCurrentPanel] = useState(0);
  const [showAtLogin, setShowAtLogin] = useState(initialShowAtLogin);

  useEffect(() => {
    if (open) {
      setCurrentPanel(0);
      setShowAtLogin(initialShowAtLogin);
    }
  }, [open, initialShowAtLogin]);

  if (!open) return null;

  const panel = PANELS[currentPanel];
  const isFirst = currentPanel === 0;
  const isLast = currentPanel === PANELS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 bg-background rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Skip link */}
        <div className="flex justify-end px-6 pt-5">
          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Skip
          </button>
        </div>

        {/* Panel content */}
        <div className="px-8 pt-3 pb-4">
          <h2 className="text-2xl font-bold text-foreground mb-1">{panel.title}</h2>
          <p className="text-muted-foreground text-sm mb-5">{panel.subtitle}</p>

          {/* Visual */}
          {panel.image ? (
            <img
              src={panel.image}
              alt={panel.title}
              className="w-full h-52 rounded-xl object-cover object-top mb-5 border border-border"
            />
          ) : (
            /* Panel 1 — mini app illustration */
            <div className="w-full h-52 rounded-xl overflow-hidden border border-border flex flex-col mb-5">
              {/* Hero */}
              <div
                className="shrink-0 flex flex-col justify-between p-2.5 gap-1.5"
                style={{ background: 'linear-gradient(135deg, #F57C00 0%, #FF8F00 40%, #7B6FBD 80%, #4A5BAA 100%)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-[10px] tracking-tight">AI Hub</span>
                  <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-full bg-white/25" />
                    <div className="w-3 h-3 rounded-full bg-white/25" />
                    <div className="w-3 h-3 rounded-full bg-white/25" />
                  </div>
                </div>
                <div className="bg-white rounded h-4 mx-1 flex items-center px-1.5 gap-1">
                  <div className="w-2 h-2 rounded-sm bg-gray-300 shrink-0" />
                  <div className="h-1 bg-gray-200 rounded flex-1" />
                </div>
              </div>
              {/* Tabs */}
              <div className="shrink-0 flex border-b border-border bg-background px-2">
                <span className="px-2 py-1 text-[8px] font-semibold text-amber-500 border-b-2 border-amber-500">Resources</span>
                <span className="px-2 py-1 text-[8px] text-muted-foreground">News</span>
                <span className="px-2 py-1 text-[8px] text-muted-foreground">My Learning</span>
              </div>
              {/* Card grid */}
              <div className="flex-1 bg-background p-2 grid grid-cols-3 gap-1.5 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-md bg-muted border border-border p-1.5 flex flex-col gap-1">
                    <div className="h-1.5 bg-muted-foreground/25 rounded w-3/4" />
                    <div className="h-1 bg-muted-foreground/15 rounded w-full" />
                    <div className="h-1 bg-muted-foreground/15 rounded w-2/3" />
                    <div className="mt-auto pt-1 flex gap-1">
                      <div className="h-2.5 w-8 rounded bg-amber-200 dark:bg-amber-900/40" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-foreground/80 leading-relaxed">{panel.body}</p>
        </div>

        {/* Footer */}
        <div className="px-8 pb-7 pt-2 flex flex-col gap-4">

          {/* Dot indicators */}
          <div className="flex justify-center gap-2">
            {PANELS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPanel(i)}
                aria-label={`Go to panel ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === currentPanel
                    ? 'w-6 bg-amber-500'
                    : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60'
                }`}
              />
            ))}
          </div>

          {/* Prev / Next / Get Started */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => setCurrentPanel(p => p - 1)}
              disabled={isFirst}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-0 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            {isLast ? (
              <button
                onClick={() => onFinish(showAtLogin)}
                className="px-6 py-2 rounded-xl text-sm font-semibold text-white shadow-md hover:brightness-110 transition-all"
                style={{ background: '#F57C00' }}
              >
                Get Started
              </button>
            ) : (
              <button
                onClick={() => setCurrentPanel(p => p + 1)}
                className="flex items-center gap-1 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Show at login — last panel only */}
          {isLast && (
            <label className="flex items-center justify-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showAtLogin}
                onChange={e => setShowAtLogin(e.target.checked)}
                className="rounded accent-amber-500"
              />
              Show this at login
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
