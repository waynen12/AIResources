# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

AI Hub is an internal team resource site for sharing AI-related tutorials, articles, YouTube videos, and courses. It is a single Next.js project (TypeScript) with API routes serving as the backend and React as the frontend. Data is stored in SQLite via `better-sqlite3`. The app is deployed on a Windows Server under IIS via reverse proxy to Node.js.

## Commands

```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # production build
npm start        # production server (requires build first)
npm run lint     # ESLint
```

## Architecture

### Stack
- **Next.js 16** (App Router, TypeScript) — single project for both frontend and API
- **shadcn/ui + Tailwind CSS v4** — component library (uses `@base-ui/react` under the hood, NOT Radix UI)
- **better-sqlite3** — synchronous SQLite access, database file stored at `data/aihub.db` (git-ignored)
- **lucide-react** — icons
- **sonner** — toast notifications
- **@anthropic-ai/sdk** — Anthropic Claude API client
- **openai** — OpenAI API client

### Key files
- `src/lib/db.ts` — database initialisation, table creation, `rowToResource()` helper
- `src/lib/encryption.ts` — AES-256-GCM encrypt/decrypt for API keys stored in DB
- `src/lib/ai/provider.ts` — `AIProvider` interface: `fetchUrlMetadata`, `suggestTags`, `smartSearch`
- `src/lib/ai/anthropic.ts` — Anthropic implementation using `claude-haiku-4-5`
- `src/lib/ai/openai.ts` — OpenAI implementation using `gpt-4o`
- `src/lib/ai/index.ts` — factory: reads kill switch + active provider from DB, returns `AIProvider | null`
- `src/app/api/resources/route.ts` — GET (paginated + search) and POST handlers
- `src/app/api/resources/[id]/route.ts` — PUT and DELETE handlers
- `src/app/api/resources/export/route.ts` — GET: streams full CSV download of all resources
- `src/app/api/resources/import/route.ts` — POST: accepts multipart CSV upload, inserts rows, returns counts
- `src/app/api/tags/route.ts` — returns all unique tags for autocomplete
- `src/app/api/settings/route.ts` — GET/POST global settings (`ai_enabled` kill switch)
- `src/app/api/settings/providers/route.ts` — GET/POST AI provider config (never returns raw key)
- `src/app/api/settings/providers/test/route.ts` — POST test connection for Anthropic or OpenAI; on success with a new key, persists it
- `src/app/api/ai/autofill/route.ts` — POST `{ url }` → extracted metadata via `fetchUrlMetadata`
- `src/app/api/ai/search/route.ts` — POST `{ query }` → AI-ranked `Resource[]` via `smartSearch`
- `src/app/page.tsx` — main page: hero, search bar (keyword + smart mode), infinite scroll card grid
- `src/components/ResourceCard.tsx` — individual resource card with edit/delete/open actions
- `src/components/AddResourceModal.tsx` — add/edit modal; includes Auto-fill button when AI is active
- `src/components/DeleteConfirmModal.tsx` — delete confirmation dialog
- `src/components/SettingsModal.tsx` — gear icon modal: kill switch, provider selector, API key, test connection, export/import
- `src/components/ThemeToggle.tsx` — light/dark toggle, persisted in localStorage

### Database schema
```sql
resources    (id, title, url, description, resource_type, tag1..tag5, submitted_by, date_added)
audit_log    (id, resource_id, action, ip_address, timestamp)
ai_providers (id, provider_name, encrypted_api_key, is_active, created_at, updated_at)
app_settings (key TEXT PRIMARY KEY, value TEXT)
```
Tags are stored as up to 5 separate nullable columns (tag1–tag5), normalised to lowercase. `rowToResource()` in `db.ts` combines them into a `tags: string[]` array for the API response.

All create/update/delete operations log to `audit_log` with the client IP. No UI exists for the audit log. Import operations also log each inserted row to `audit_log` with action `'import'`.

### Configuration
- `NEXT_PUBLIC_SITE_NAME` — site title, defaults to `"AI Hub"`. Set in `.env.local` for company deployments.
- `SETTINGS_ENCRYPTION_KEY` — 32-byte hex secret for AES-256-GCM encryption of API keys in DB. Must be set in `.env.local`. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `better-sqlite3` is listed in `serverExternalPackages` in `next.config.ts` — required because it is a native Node.js addon that must not be bundled.

## AI Provider Integration

### Design rules
- AI features are controlled by a **kill switch** (`ai_enabled` in `app_settings` table). When `false`, all AI UI is hidden entirely — the app behaves as if no AI features exist.
- When `ai_enabled` is `true` but no provider is configured, AI buttons are **visible but disabled** with tooltip: `"Configure an AI provider in Settings to use this feature"`.
- The **API key is never returned to the frontend** once saved. The GET endpoint for providers returns `{ provider_name, is_active, has_key: boolean }` only.
- Showing the key in any UI element is forbidden.
- Both provider keys are stored in the DB simultaneously; only one has `is_active = 1`. Switching providers on Save deactivates the other — the key is preserved for easy switching back.

### Provider interface (`src/lib/ai/provider.ts`)
```typescript
interface AIProvider {
  fetchUrlMetadata(url: string): Promise<{ title: string; description: string; resource_type: string; tags: string[] }>;
  suggestTags(title: string, description: string, existingTags: string[]): Promise<string[]>;
  smartSearch(query: string, resources: ResourceSummary[]): Promise<number[]>; // returns ranked IDs
}
```

### Anthropic implementation (`src/lib/ai/anthropic.ts`)
Model: `claude-haiku-4-5` throughout (fast, cheap, sufficient).

**`fetchUrlMetadata`** — two-phase pipeline:
1. Server-side `fetch()` of the URL (10 s timeout, 50 K char cap on HTML).
2. `extractMetaSignals()` strips the HTML down to just `<title>`, `og:*`, `meta description`, `twitter:*`, and `<h1>` tags — a dozen focused lines instead of raw HTML noise.
3. That compact signal is sent to Claude for structured JSON extraction.

**YouTube special case**: for `youtube.com` / `youtu.be` URLs, the oEmbed API (`youtube.com/oembed`) is called in parallel with the page fetch. oEmbed provides the exact video title and channel; `og:description` from the page HTML provides the description. `resource_type` is hard-coded to `"YouTube"`.

**`smartSearch`** — sends the full resource catalog (id, title, description, tags) as JSON to Claude with the user's natural-language query. Claude returns a ranked array of relevant resource IDs. The `/api/ai/search` route resolves those IDs to full `Resource` objects in DB order.

### OpenAI implementation (`src/lib/ai/openai.ts`)
Model: `gpt-4o` throughout. Uses `response_format: { type: 'json_object' }` on all calls — no markdown stripping needed. Shares the same page-fetching helpers (extractMetaSignals, fetchPageSignals, YouTube oEmbed) as the Anthropic implementation. `smartSearch` returns `{ ids: [...] }` wrapped JSON; `suggestTags` returns `{ tags: [...] }`.

### AI features in the UI

**Auto-fill** (Add Resource modal):
- `✨ Auto-fill` button appears next to the URL field when `aiEnabled && aiHasProvider`.
- Disabled (with tooltip) when AI is on but no provider is configured.
- Spinner on the button only during the call; rest of the form stays editable.
- Populates title, description, resource type, and tags from the URL.

**Smart search** (main page search bar):
- `✨` sparkle button at the right edge of the search input; only shown when `aiEnabled && aiHasProvider`.
- Clicking toggles smart mode (button turns amber). Typing in smart mode does **not** trigger keyword search.
- Pressing **Enter** in smart mode fires `POST /api/ai/search` and replaces the grid with AI-ranked results.
- Toolbar shows `✨ N AI results for "…"` when smart results are active.
- Typing again after AI results clear the AI results and restore all resources.
- Toggling off smart mode immediately runs keyword search with the current input.

### Error handling (toast notifications via sonner)
| Situation | Toast message |
|---|---|
| 401 from provider | "Invalid API key — check your Settings" |
| 402 / quota exhausted | "API quota exhausted — check your account balance" |
| URL not publicly reachable | "Could not fetch that URL — check the link is publicly accessible" |
| Network / unknown | "Could not reach the AI provider — check your connection" |

### Settings modal (gear icon in nav)
- **Kill switch**: toggle to enable/disable all AI features globally.
- **Provider selector**: two live buttons — Anthropic and OpenAI. Clicking switches the key field shown; the active provider only changes on Save.
- **API key field**: password input, write-only. Once saved shows `••••••••` + "Change key" button. Placeholder adjusts per provider (`sk-ant-...` vs `sk-...`).
- **Test connection**: tests whichever provider is currently selected in the UI.
- **Save**: saves the key for the selected provider, marks it active, deactivates the other, then closes the modal.
- **Export CSV**: triggers `GET /api/resources/export` — downloads all resources as a CSV file.
- **Import CSV**: browser file picker → `POST /api/resources/import` → toast with counts (added / duplicates skipped / bad rows skipped). On success, the main grid refreshes automatically via `onImportComplete` callback.

## Export / Import

### Export (`GET /api/resources/export`)
- Returns all resources ordered by `date_added ASC` as a CSV file attachment.
- Filename includes today's date: `aihub-export-YYYY-MM-DD.csv`.
- Columns: `title, url, description, resource_type, tags, submitted_by, date_added`.
- Tags are pipe-separated in a single column (e.g. `python|llm|tutorial`).
- Fields are RFC 4180 quoted when they contain commas, newlines, or double-quotes.
- Resource IDs are not included.

### Import (`POST /api/resources/import`)
- Accepts `multipart/form-data` with a `file` field containing the CSV.
- Validates that all required headers are present: `title, url, description, resource_type, tags, submitted_by, date_added`.
- Per-row validation: skips rows missing required fields (`title`, `url`, `description`, `resource_type`) or with an invalid `resource_type`.
- Skips rows whose URL already exists in the database (duplicate check).
- Preserves the original `date_added` from the CSV.
- Logs each inserted row to `audit_log` with action `'import'`.
- Returns `{ added, skipped_duplicates, skipped_bad_rows }`.
- The entire import runs in a single SQLite transaction.

## shadcn/ui — Important: uses @base-ui/react, not Radix

This project was scaffolded with a version of shadcn that uses `@base-ui/react` instead of `@radix-ui/react`. The component APIs differ:

- **Dialog dismiss**: use `disablePointerDismissal` on `<Dialog>` (not `onInteractOutside`), and intercept `onOpenChange` with `details.reason` to block Escape key
- **Select `onValueChange`**: receives `string | null`, not `string`
- Do not assume Radix prop names — check `src/components/ui/` source when in doubt

## Theme

Hybrid layout:
- **Hero/nav**: gradient background `linear-gradient(135deg, #F57C00 → #FF8F00 → #7B6FBD → #4A5BAA)`
- **Light mode**: white cards on `#F5F5F5`
- **Dark mode**: `#1F2937` cards on `#111827` charcoal
- **Accent**: amber `#F57C00` / `#FB923C` for buttons, badges, tag hover states
- Theme persisted in `localStorage`, toggled by `ThemeToggle` component
- The hero search bar is pinned white in both themes (`dark:bg-white dark:text-gray-900`) because it sits on a coloured gradient background.

## Deployment (IIS)

The app runs as a Node.js process behind an IIS reverse proxy. After `npm run build`, start with `npm start`. The `data/` directory (containing `aihub.db`) must be writable by the Node.js process. For company-specific branding, create `.env.local` with `NEXT_PUBLIC_SITE_NAME="Company AI Hub"` — no code changes needed. See `README.md` for full step-by-step Windows Server / IIS deployment instructions including NSSM service setup and `web.config`.
