# ADR 0002 — News ingest via webhook endpoint

**Status:** Accepted

## Context

The News tab requires n8n to deliver AI-generated digest text to AI Hub on a schedule. Three mechanisms were considered:

1. **Webhook POST to API endpoint** — n8n calls `POST /api/news/ingest`; AI Hub stores the digest in SQLite.
2. **Shared JSON file** — n8n writes to disk; AI Hub reads the file on request.
3. **Direct SQLite write** — n8n uses a SQLite node to insert rows directly into the database.

## Decision

Use a dedicated `POST /api/news/ingest` endpoint secured with a shared Ingest Token (`Authorization: Bearer`). The token is stored in `app_settings` and regenerable by an Admin via Settings.

## Reasons

- **Follows existing patterns** — every other data flow in the app is a POST to an API route. No new conventions needed.
- **Decoupled** — n8n does not need filesystem access or knowledge of the DB schema. Changing the schema requires only an API contract update.
- **Works off-box** — file-based and direct-DB approaches require n8n and AI Hub to be co-located and share a filesystem/DB path. The webhook works regardless of topology.
- **Direct DB write rejected** — SQLite WAL mode handles concurrent reads well but concurrent writes from two processes (Node.js + n8n) risk lock contention and make schema migrations harder.
- **File-based rejected** — no history, no atomicity, path coupling, fails silently on write errors.

## Consequences

- n8n workflows each need one new HTTP Request node added at the end.
- The Ingest Token must be provisioned once and stored in both `app_settings` and n8n credentials.
- The endpoint is public-facing (not restricted to localhost) so the token must be treated as a secret.
