# Authentication approach

Auth.js v5 (NextAuth) with the Credentials provider handles authentication. All routes require a valid session — there is no public read access. Accounts are managed by the site owner via a CLI script; no open registration.

## Key decisions and why

**JWT sessions only.** Auth.js v5 with Credentials provider does not support DB-backed session strategy — JWT is the only option. Sessions roll on activity with a 7-day max age. Session revocation is not possible without a token blocklist; this is acceptable for a small trusted team.

**Username, not email.** No email infrastructure is planned. Password resets are done via the CLI script. Storing email without a reset flow would be misleading.

**Two roles: `admin` and `contributor`.** Admins have full access including Settings (AI provider config, API keys, import/export). Contributors can add, edit, and delete only their own Resources — enforced via `account_id` ownership check on `PUT` and `DELETE` routes. The Settings gear icon is hidden entirely for Contributors.

**`account_id` FK replaces `submitted_by TEXT`.** Storing the username as plain text breaks if a username ever changes and loses referential integrity. Resources JOIN to `accounts` at query time and return `username` as `submitted_by` in the API response — the frontend shape is unchanged. Existing rows were migrated to the initial Admin account at the time auth was introduced.

**`is_active` flag for account deactivation.** Accounts are never deleted — deletion would orphan `account_id` references on Resources. Deactivating an account blocks login while preserving the full submission history.

## Considered options

- **Custom JWT with `jose`** — more control, but Auth.js eliminates the need to hand-roll CSRF protection, cookie rotation, and Next.js middleware integration.
- **DB-backed sessions** — would allow server-side revocation, but is unavailable with the Credentials provider in Auth.js v5.
- **Email as identifier** — enables self-service password reset eventually, but adds complexity (email validation, SMTP) with no planned benefit for a closed team.
