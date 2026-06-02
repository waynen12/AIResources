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
- `src/lib/auth.ts` — Auth.js v5 config: Credentials provider, bcrypt verify, JWT callbacks (`accountId`, `username`, `role`), rolling 7-day sessions
- `src/lib/encryption.ts` — AES-256-GCM encrypt/decrypt for API keys stored in DB
- `src/lib/ai/provider.ts` — `AIProvider` interface: `fetchUrlMetadata`, `suggestTags`, `smartSearch`
- `src/lib/ai/anthropic.ts` — Anthropic implementation using `claude-haiku-4-5`
- `src/lib/ai/openai.ts` — OpenAI implementation using `gpt-4o`
- `src/lib/ai/index.ts` — factory: reads kill switch + active provider from DB, returns `AIProvider | null`
- `src/proxy.ts` — Next.js 16 proxy (replaces deprecated `middleware.ts`); redirects unauthenticated → `/login`; exempts `/api/auth/*`
- `src/app/api/auth/[...nextauth]/route.ts` — Auth.js GET/POST handler
- `src/app/api/account/password/route.ts` — POST: change logged-in user's own password (verifies current, re-hashes new at bcrypt cost 12)
- `src/app/api/admin/accounts/route.ts` — GET: list all accounts (active + inactive); POST: create account. Admin only.
- `src/app/api/admin/accounts/[id]/route.ts` — PATCH: `{ action: 'deactivate' | 'reactivate' | 'role', role? }`. Guards: blocks self-deactivation and last-admin deactivation/demotion. Admin only.
- `src/app/api/admin/accounts/[id]/reset-password/route.ts` — POST: admin sets a new password for any account. Admin only.
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
- `src/app/login/page.tsx` — amber/gradient login form with Suspense boundary for `useSearchParams`
- `src/app/page.tsx` — main page: hero, search bar (keyword + smart mode), infinite scroll card grid
- `src/components/ResourceCard.tsx` — individual resource card with edit/delete/open actions
- `src/components/AddResourceModal.tsx` — add/edit modal; includes Auto-fill button when AI is active
- `src/components/ChangePasswordModal.tsx` — password change dialog; opened via key icon in the nav
- `src/components/DeleteConfirmModal.tsx` — delete confirmation dialog
- `src/components/SessionProviderWrapper.tsx` — client `SessionProvider` wrapper used in layout
- `src/components/AccountsModal.tsx` — admin-only modal for full account management: list all accounts, create, deactivate/reactivate, inline role change, inline password reset. Opened via "Manage Accounts" button in SettingsModal.
- `src/components/SettingsModal.tsx` — gear icon modal: kill switch, provider selector, API key, test connection, export/import, Manage Accounts button, News Ingest Token (generate/regenerate, shown once)
- `src/components/ThemeToggle.tsx` — light/dark toggle, persisted in localStorage
- `src/components/NewsTab.tsx` — News tab: pill toggle (General AI News / Learning Radar), digest cards with amber date headers, collapsible article list, "Save to Resources" promote buttons
- `src/app/api/news/ingest/route.ts` — `POST /api/news/ingest`: Bearer token auth, insert + auto-prune (7 daily / 4 weekly)
- `src/app/api/news/route.ts` — `GET /api/news?feed=daily|weekly`: session-gated, newest-first
- `src/app/api/settings/news-token/route.ts` — GET `{has_token}`, POST generate + save UUID token
- `scripts/manage-user.ts` — CLI: `--create`, `--deactivate`, `--reset-password` (admin use only)

### Database schema
```sql
accounts     (id, username, password_hash, role, is_active, created_at)
resources    (id, title, url, description, resource_type, tag1..tag5, submitted_by, account_id, date_added)
audit_log    (id, resource_id, action, ip_address, timestamp)
ai_providers (id, provider_name, encrypted_api_key, is_active, created_at, updated_at)
app_settings (key TEXT PRIMARY KEY, value TEXT)
news_items   (id, feed_type CHECK('daily'|'weekly'), digest_html, articles_json DEFAULT '[]', published_at)
```
`app_settings` seeds: `ai_enabled` (default `false`), `news_ingest_token` (default `''`).
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
- **Manage Accounts**: opens `AccountsModal` (admin only).

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

---

## Roadmap — Personal Learning Hub (Digital Ocean)

The app is being extended from an internal QA/team tool into a personal learning hub hosted on a Digital Ocean droplet.

### Deployment (Digital Ocean)

See [`docs/adr/0003-pm2-over-docker-for-aihub.md`](../docs/adr/0003-pm2-over-docker-for-aihub.md) for the runtime decision record.
See [`docs/deployment/droplet-setup.md`](../docs/deployment/droplet-setup.md) for the full one-time setup runbook.

**Droplet:** 2 GB RAM / 50 GB / LON1 — Ubuntu 24.04 LTS. Shares the droplet with the existing n8n Docker Compose stack (Caddy + n8n + PostgreSQL).

**Runtime:** Native Node.js via PM2 (not Docker). App lives at `/opt/aihub/ai-hub/` on the host, owned by the `deploy` user.

**Reverse proxy / TLS:** Existing Caddy container handles TLS via Let's Encrypt. One block added to `/opt/n8n/Caddyfile`:
```
hub.notrauto.org {
    reverse_proxy host-gateway:3000
}
```
`host-gateway` is a Docker special hostname resolving to the host IP; requires `extra_hosts: ["host-gateway:host-gateway"]` on the Caddy service in `/opt/n8n/docker-compose.yml`.

**DNS:** Cloudflare A record `hub → <droplet IP>`, DNS-only (grey cloud) — same as `n8n.notrauto.org`.

**CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`) — push to `main` triggers SSH deploy: `git pull → npm ci → npm run build → pm2 restart aihub`. GitHub repo secrets required: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`.

**Environment:** `.env.local` at `/opt/aihub/ai-hub/.env.local` — never committed. Required vars:
- `AUTH_SECRET` — random 32-byte hex; signs Auth.js JWT tokens
- `AUTH_URL` — `https://hub.notrauto.org`; tells Auth.js the canonical URL
- `SETTINGS_ENCRYPTION_KEY` — 32-byte hex; AES-256-GCM key for stored AI provider API keys
- `NEXT_PUBLIC_SITE_NAME` — optional, defaults to `"AI Hub"`

**Swap:** 2 GB swap file configured at `/swapfile` — required to survive the Next.js build while n8n is running.

### Authentication

See [`docs/adr/0001-authentication.md`](../docs/adr/0001-authentication.md) for the full decision record.

**Library:** Auth.js v5 (`next-auth`) with the Credentials provider. JWT sessions only (Auth.js enforces this with Credentials — DB sessions are not available). Rolling 7-day max age (`maxAge: 60 * 60 * 24 * 7`, `updateAge: 60 * 60 * 24`).

**Roles:** `admin` | `contributor`. Admins have full access. Contributors can only edit/delete their own Resources.

**Visibility:** Fully private. Next.js middleware redirects all unauthenticated requests to `/login`. No public read access.

**Database schema additions:**
```sql
accounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,        -- bcrypt
  role        TEXT NOT NULL CHECK(role IN ('admin', 'contributor')),
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
)
```
`resources` gains `account_id INTEGER REFERENCES accounts(id)` — replaces the free-text `submitted_by` column. API routes JOIN `accounts` and return `username` as `submitted_by` in the response so the frontend shape is unchanged. Existing rows are migrated to the initial Admin's `account_id` at seed time.

**Account management UI:** `AccountsModal` (Settings → Manage Accounts, admin only)
- Lists all accounts (active and inactive) with role, status, and created date.
- Inline role dropdown: change contributor ↔ admin; saves immediately on selection.
- Inline reset-password form: expands per row on "Reset password" click; admin sets the new password directly.
- Deactivate / Reactivate per row. Accounts are never deleted — deactivation preserves Resource history.
- Guards enforced at the API: self-deactivation blocked; last active Admin cannot be deactivated or demoted.
- New Account form: username, role, password (min 8 chars); expands in-place at the bottom of the list.

**Account management CLI:** `scripts/manage-user.ts` (admin use, server access required)
```bash
npx tsx scripts/manage-user.ts --create --username wayne --role admin   # first run / bootstrap
npx tsx scripts/manage-user.ts --create --username alice --role contributor
npx tsx scripts/manage-user.ts --deactivate --username alice
npx tsx scripts/manage-user.ts --reset-password --username alice
```
Use the CLI only for bootstrapping the first Admin or emergency recovery. All routine account management should go through the UI.

**Route protection:**
- `src/middleware.ts` — redirects unauthenticated requests to `/login`; redirects authenticated requests away from `/login` to `/`
- `PUT /api/resources/[id]` and `DELETE /api/resources/[id]` — check `session.user.accountId === resource.accountId || session.user.role === 'admin'`; return 403 otherwise

**UI changes:**
- Nav: username displayed; key icon (`KeyRound`) opens `ChangePasswordModal` for all logged-in users; gear icon (Settings) hidden for Contributors; Sign out button always visible
- Add Resource modal: `submitted_by` free-text input removed; server derives it from the session
- ResourceCard: edit/delete actions hidden when the logged-in user is a Contributor who does not own the Resource

### Password change

Users can change their own password from the nav. Admins can reset any user's password via the Accounts UI or the CLI (`--reset-password`).

**API:** `POST /api/account/password`
- Requires valid session (401 if absent)
- Body: `{ currentPassword: string, newPassword: string }`
- Validates current password with `bcrypt.compare` before accepting the new one
- On mismatch: `{ error: 'Current password is incorrect' }` with status 400
- New password minimum length: 8 characters
- Hashes new password at bcrypt cost 12, updates the `accounts` row
- JWT sessions remain valid after a change (no forced re-login)

**Component:** `ChangePasswordModal` — three fields (Current password, New password, Confirm new password); client-side match check before submit; inline error display; success toasts "Password changed" and closes.

### "Added by" linked to auth user
- `submitted_by` is now derived from the authenticated session via the `account_id` FK and JOIN — no free-text input.
- Existing resources were migrated to the initial Admin account at auth introduction time.

### Daily News tab ✓ implemented

See [`docs/adr/0002-news-ingest-via-webhook.md`](../docs/adr/0002-news-ingest-via-webhook.md) for the integration decision record.

**Overview:** A second top-level tab alongside the resource library. Shows AI-generated HTML digests pushed by two n8n workflows. Two feeds selectable via a pill toggle: "General AI News" (daily) and "Learning Radar" (weekly). Articles within a digest can be Promoted to permanent Resources.

**Database:** `news_items` table added in `src/lib/db.ts` (see schema above). `news_ingest_token` seeded in `app_settings`.

Retention: on each ingest, rows beyond the limit are pruned. Limits: 7 for `daily`, 4 for `weekly`.

**Ingest endpoint** (`src/app/api/news/ingest/route.ts`):
- `POST /api/news/ingest` — no session required; validated by `Authorization: Bearer <news_ingest_token>`
- Body: `{ feed_type: 'daily' | 'weekly', digest_html: string, articles: { title: string, url: string }[] }`
- Validates token against `app_settings.news_ingest_token`; returns 401 on mismatch
- Inserts row, stores `articles` as `articles_json`, then prunes to retention limit
- Returns `{ id }` on success

**Read endpoint** (`src/app/api/news/route.ts`):
- `GET /api/news?feed=daily|weekly` — requires valid session
- Returns `{ items: { id, digest_html, articles: {title,url}[], published_at }[] }` newest-first

**Settings modal** (Admin only — implemented in `src/components/SettingsModal.tsx`):
- "News Ingest Token" section: "Generate Token" / "Regenerate" button; token revealed once unmasked with a Copy button
- `GET /api/settings/news-token` — returns `{ has_token: boolean }` only (never raw value)
- `POST /api/settings/news-token` — generates and saves new token, returns `{ token: string }` once

**Frontend (implemented):**
- `src/app/page.tsx` — tab bar ("Resources" | "News") above the toolbar; News tab renders `<NewsTab />`
- `src/components/NewsTab.tsx`: pill toggle, digest cards with amber date headers, collapsible article list with per-article "Save to Resources" promote buttons
- `src/components/AddResourceModal.tsx` — `initialUrl` prop added; pre-fills URL when opened from the promote flow

**Promote flow:** No new API route — reuses `POST /api/resources` via `AddResourceModal`. `submitted_by` / `account_id` from session. After promotion, `onResourceAdded` callback propagates to the Resources tab.

**n8n workflow changes — manual steps still required:**
- **Daily Digest**: re-enable the disabled `Code in JavaScript1` node (HTML stripper); wire its output into a new HTTP Request node that POSTs `{ feed_type: "daily", digest_html: "{{ $json.html }}", articles: [array of {title, url} from merged items] }` to `https://<host>/api/news/ingest` with header `Authorization: Bearer <token>`
- **Learning News**: add an HTTP Request node at the end that POSTs `{ feed_type: "weekly", digest_html: "{{ $json.output[0].content[0].text }}", articles: [...] }` — same structure
- Both workflows: the `articles` array comes from the items before the AI step (`items.map(i => ({ title: i.json.title, url: i.json.link }))`)
