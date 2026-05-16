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
      date_added TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER,
      action TEXT NOT NULL,
      ip_address TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

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
    submitted_by: row.submitted_by,
    date_added: row.date_added,
  };
}
