# AI Hub

An internal team site for sharing and discovering AI-related learning materials. Team members contribute Resources; the hub makes them searchable.

## Language

### Resources

**Resource** (also: Learning Resource):
A URL submitted by a team member, enriched with a title, description, type, and tags. The atomic unit of the hub.
_Avoid_: Link, item, entry, bookmark

**Resource Type**:
A closed classification applied to every Resource. Exactly one type per Resource. Valid values: `YouTube`, `Article`, `Course`, `Documentation`, `Tool`, `Other`.
_Avoid_: Category, kind, format

**YouTube**:
A Resource whose URL is a YouTube video.
_Avoid_: Video (not all videos are YouTube)

**Article**:
A Resource that is written content meant to be read once — a blog post, essay, or news piece.
_Avoid_: Blog post, post

**Course**:
A Resource that is structured, multi-part learning content intended to be followed sequentially.
_Avoid_: Tutorial series, program

**Documentation**:
A Resource you consult repeatedly as a reference — official docs, API references, or a GitHub repo where the primary value is in reading (README, examples, specs).
_Avoid_: Docs, reference

**Tool**:
A Resource that is software you install or run — a library, CLI, SaaS, or API service. A GitHub repo you `npm install` is a Tool.
_Avoid_: Library, utility

**Tool vs Documentation rule**:
Ask "do you use it or read it?" If the value is in running or integrating the software → Tool. If the value is in reading or consulting it → Documentation.

**Other**:
A Resource that does not fit any of the above types.

**Contributor**:
A team member who submits Resources to the hub. Also the name of the standard Account role — can add, edit, and delete Resources but cannot access Settings. Can change their own password via the nav.
_Avoid_: User, member, author, submitter

**Account**:
The login credential belonging to a Contributor or Admin. Created and managed by Admins via the Accounts UI (Settings → Manage Accounts) or the bootstrap CLI. No open registration. `submitted_by` on a Resource is derived from the Account rather than free-text input. Accounts are never deleted — deactivation blocks login while preserving Resource history.
_Avoid_: User, profile, login

**Admin**:
An Account role with elevated privileges — can access Settings (AI provider config, API key, import/export) and manage all Accounts (create, deactivate, reactivate, reset passwords, change roles) in addition to all Contributor capabilities. There may be multiple Admins. The site owner holds an Admin Account. The last active Admin cannot be deactivated or demoted.
_Avoid_: Owner, superuser, moderator


### AI Features

**Auto-fill**:
An AI-powered action that populates a Resource's title, description, type, and tags from its URL. Triggered per-Resource before submission.
_Avoid_: Autofill (one word), prefill, fetch metadata

**Smart Search**:
An AI-powered search mode where the user's natural-language query is matched against the full Resource catalog and results are returned ranked by relevance. Distinct from keyword search.
_Avoid_: AI search, semantic search, intelligent search

**AI Provider**:
The external AI service (Anthropic or OpenAI) that powers Auto-fill and Smart Search. Exactly one Provider is active at a time.
_Avoid_: Model, service, backend

**Kill Switch**:
A global toggle that disables all AI features for all Contributors. When off, no AI UI is shown anywhere in the hub.
_Avoid_: Feature flag, AI toggle, disable AI

### News

**News Item**:
The AI-generated digest text produced by one run of an n8n workflow. Stored verbatim as a single text blob per run. Not submitted by a Contributor. Distinct from a Resource, which is permanent.
_Avoid_: Resource, digest item, article (clashes with Resource Type), raw article

**News Feed**:
A named stream of News Items from a specific n8n workflow. Two feeds exist: "General AI News" (daily) and "Learning Radar" (weekly). The News tab shows one Feed at a time, toggled by a pill selector.
_Avoid_: Channel, digest, workflow

**Ingest Token**:
The shared secret that n8n presents in the `Authorization: Bearer` header when pushing a News Item to `POST /api/news/ingest`. Stored in `app_settings`. Admin-only — visible and regenerable in Settings.
_Avoid_: API key (reserved for AI provider keys), webhook secret

**Promote**:
The action of converting an article link from a News Item into a permanent Resource in the Catalog. Triggered by the logged-in user via a "Save to Resources" button in the News tab. Promotion opens the Add Resource modal with the article URL pre-filled; Auto-fill handles the rest. The resulting Resource is owned by the Contributor who promoted it.
_Avoid_: Save, import, pin, bookmark

### Personal Learning

**Personal Item**:
A URL saved privately by a single Account for their own learning tracking. Shares the same fields as a Resource (title, URL, description, type, tags) but is visible only to the Account that created it — including Admins. Not part of the Catalog. Carries a Status. Displayed in the "My Learning" tab.
_Avoid_: Personal Resource, bookmark, note, private resource

**Status**:
A field on a Personal Item indicating the Account's progress: `not_started` ("To Read/Watch"), `in_progress` ("In Progress"), or `done` ("Done"). Default on creation: `not_started`. Changed via a dropdown badge on the Personal Item card.
_Avoid_: State, progress, completion

**My Learning**:
The tab in the main UI that displays a logged-in Account's Personal Items. Visually identical to the Resources tab. Supports keyword search and Smart Search (scoped to the Account's own items only). Ordered status-first (`not_started` → `in_progress` → `done`), then newest within each group. Personal Items do not appear in the Catalog, export, or Catalog Smart Search.
_Avoid_: Personal tab, private tab, my resources

**Save to My Learning**:
The action of copying a Resource or News article into the logged-in Account's Personal Items as an independent copy. Triggered by a bookmark icon on ResourceCards or a "Save to My Learning" button on News article rows. Executes immediately with a toast — no modal. If the URL already exists in the Account's Personal Items, the save is silently skipped and a "Already in My Learning" toast is shown.
_Avoid_: Bookmark, pin, add to personal

### Discovery

**Catalog**:
The full collection of Resources in the hub. Smart Search operates across the entire Catalog. Personal Items are not part of the Catalog.
_Avoid_: Library, database, list, feed

**Tag**:
A lowercase label attached to a Resource or Personal Item to aid discovery. A Resource or Personal Item may have zero to five Tags.
_Avoid_: Category, label, keyword

## Example dialogue

> **Dev**: I want to add the LangChain GitHub repo — what type is it?
>
> **Domain expert**: Depends. Are you adding it so people can install and use it, or so they can read the docs and examples?
>
> **Dev**: Mostly so people can reference the README and example notebooks.
>
> **Domain expert**: Then it's Documentation, not a Tool. Tool is for things you run or install.

---

> **Dev**: Should News Items show up in Smart Search results?
>
> **Domain expert**: No — Smart Search operates on the Catalog, which is Resources only. News Items are temporary and separate.

---

> **Dev**: The Contributor who added this Resource — do I get that from their Account?
>
> **Domain expert**: Yes — `submitted_by` is derived from the authenticated session via the `account_id` FK and a JOIN on `accounts`. The free-text input was removed when auth landed.
