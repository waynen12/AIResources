<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project-specific agent guidance

### shadcn/ui uses @base-ui/react — not Radix
The component library was scaffolded with `@base-ui/react`. **Do not assume Radix UI prop names.** Always check `src/components/ui/` before writing Dialog, Select, or other compound component code. Key differences:
- `<Dialog>` uses `disablePointerDismissal` (not `onInteractOutside`) and `onOpenChange` receives `(open, details)` where `details.reason === 'close-press'` identifies the X button.
- `<Select onValueChange>` receives `string | null`, not `string`.

### AI features — invariants to preserve
- The `ai_enabled` kill switch in `app_settings` is the single source of truth. When `false`, **no AI UI renders at all** — not even disabled buttons. Check `aiEnabled` before rendering any AI element.
- API keys are encrypted with AES-256-GCM (`src/lib/encryption.ts`) before hitting the DB. The raw key must never be returned to the frontend. Provider GET endpoints return `{ provider_name, is_active, has_key: boolean }` only.
- `getAIProvider()` in `src/lib/ai/index.ts` enforces both the kill switch and the provider check in one call. Use it in every AI API route — do not re-implement the logic.
- `smartSearch` passes the **entire resource catalog** to Claude. This is intentional for a small internal library. If the catalog grows very large (1000+ rows), revisit with a pre-filter step before it becomes a problem.

### Adding a new AI provider
1. Add the SDK package.
2. Create `src/lib/ai/<name>.ts` implementing all three methods of `AIProvider` (`fetchUrlMetadata`, `suggestTags`, `smartSearch`).
3. Enable the provider option in `SettingsModal.tsx` (remove "Coming soon").
4. Register it in the `getAIProvider()` factory in `src/lib/ai/index.ts`.

### Database
`better-sqlite3` is synchronous — no `await`. The DB is initialised (tables created, default settings seeded) on first call to `getDb()`. New tables go in the `db.exec(...)` block in `src/lib/db.ts`. Add `INSERT OR IGNORE` seeds for any new `app_settings` defaults alongside the table.

### ESLint
`react-hooks/set-state-in-effect` is disabled globally (`eslint.config.mjs`) — calling `setState` directly inside `useEffect` is the accepted pattern in this codebase.
