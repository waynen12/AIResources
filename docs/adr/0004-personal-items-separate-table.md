# ADR 0004 — Personal Items in a Separate Table

**Status:** Accepted

## Context

The My Learning feature requires storing items that are private to a single Account. These share the same fields as Resources (title, URL, description, type, tags) but must never appear in the Catalog, export, or Smart Search.

Two options were considered:

1. Add a `scope` column (`'shared' | 'personal'`) to the existing `resources` table.
2. Create a dedicated `personal_items` table mirroring the same columns.

## Decision

Use a dedicated `personal_items` table (option 2).

## Reasons

- A `scope` flag on `resources` requires every existing query (GET list, export, Smart Search, audit log) to add a `WHERE scope = 'shared'` guard. One missed guard leaks private data. A separate table makes it structurally impossible for a Personal Item to appear in a Catalog query.
- Personal Items are expected to diverge from Resources over time (e.g. a status field for learning progress). Separating now avoids future migrations that split a shared table.
- The cost (duplicate column definitions, parallel API routes) is low and well-contained.
