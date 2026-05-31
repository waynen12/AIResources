import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'aihub.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK(role IN ('admin', 'contributor')),
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      tag1 TEXT,
      tag2 TEXT,
      tag3 TEXT,
      tag4 TEXT,
      tag5 TEXT,
      submitted_by TEXT,
      account_id INTEGER REFERENCES accounts(id),
      date_added TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER,
      action TEXT NOT NULL,
      ip_address TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_name TEXT NOT NULL UNIQUE,
      encrypted_api_key TEXT,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO app_settings (key, value) VALUES ('ai_enabled', 'false');

    CREATE TABLE IF NOT EXISTS news_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_type     TEXT NOT NULL CHECK(feed_type IN ('daily', 'weekly')),
      digest_html   TEXT NOT NULL,
      articles_json TEXT NOT NULL DEFAULT '[]',
      published_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO app_settings (key, value) VALUES ('news_ingest_token', '');
  `);

  // If resources table predates auth (account_id column missing), add it.
  const cols = db.prepare(`PRAGMA table_info(resources)`).all() as { name: string }[];
  if (!cols.some(c => c.name === 'account_id')) {
    db.exec(`ALTER TABLE resources ADD COLUMN account_id INTEGER REFERENCES accounts(id)`);
  }

  // Migrate existing rows: assign them to the first admin account if one exists.
  const firstAdmin = db.prepare(`SELECT id FROM accounts WHERE role = 'admin' AND is_active = 1 ORDER BY id LIMIT 1`).get() as { id: number } | undefined;
  if (firstAdmin) {
    db.prepare(`UPDATE resources SET account_id = ? WHERE account_id IS NULL`).run(firstAdmin.id);
  }

  return db;
}

export type Resource = {
  id: number;
  title: string;
  url: string;
  description: string;
  resource_type: string;
  tags: string[];
  submitted_by: string | null;
  account_id: number | null;
  date_added: string;
};

type RawResource = {
  id: number;
  title: string;
  url: string;
  description: string;
  resource_type: string;
  tag1: string | null;
  tag2: string | null;
  tag3: string | null;
  tag4: string | null;
  tag5: string | null;
  submitted_by: string | null;
  account_id: number | null;
  // populated by JOIN on accounts
  username?: string | null;
  date_added: string;
};

export function rowToResource(row: RawResource): Resource {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    description: row.description,
    resource_type: row.resource_type,
    tags: [row.tag1, row.tag2, row.tag3, row.tag4, row.tag5].filter(Boolean) as string[],
    submitted_by: row.username ?? row.submitted_by,
    account_id: row.account_id,
    date_added: row.date_added,
  };
}
