/**
 * Account management CLI for AI Hub.
 *
 * Usage:
 *   npx tsx scripts/manage-user.ts --create --username <name> --role admin|contributor --password <pw>
 *   npx tsx scripts/manage-user.ts --deactivate --username <name>
 *   npx tsx scripts/manage-user.ts --reset-password --username <name> --password <pw>
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const SALT_ROUNDS = 12;
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'aihub.db');

function getDb(): Database.Database {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
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
  `);

  // Add account_id to resources if it predates auth.
  const cols = db.prepare(`PRAGMA table_info(resources)`).all() as { name: string }[];
  if (cols.length > 0 && !cols.some(c => c.name === 'account_id')) {
    db.exec(`ALTER TABLE resources ADD COLUMN account_id INTEGER REFERENCES accounts(id)`);
  }

  return db;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    create: args.includes('--create'),
    deactivate: args.includes('--deactivate'),
    resetPassword: args.includes('--reset-password'),
    username: get('--username'),
    role: get('--role') as 'admin' | 'contributor' | undefined,
    password: get('--password'),
  };
}

async function main() {
  const opts = parseArgs();

  if (!opts.username) {
    console.error('Error: --username is required');
    process.exit(1);
  }

  const db = getDb();

  if (opts.create) {
    if (!opts.role || !['admin', 'contributor'].includes(opts.role)) {
      console.error('Error: --role must be admin or contributor');
      process.exit(1);
    }
    if (!opts.password) {
      console.error('Error: --password is required for --create');
      process.exit(1);
    }

    const existing = db.prepare(`SELECT id FROM accounts WHERE username = ?`).get(opts.username);
    if (existing) {
      console.error(`Error: account "${opts.username}" already exists`);
      process.exit(1);
    }

    const hash = await bcrypt.hash(opts.password, SALT_ROUNDS);
    const result = db.prepare(
      `INSERT INTO accounts (username, password_hash, role) VALUES (?, ?, ?)`
    ).run(opts.username, hash, opts.role);

    // Migrate any unowned resources to this account if it's the first admin.
    if (opts.role === 'admin') {
      const adminCount = (db.prepare(`SELECT COUNT(*) as c FROM accounts WHERE role = 'admin'`).get() as { c: number }).c;
      if (adminCount === 1) {
        db.prepare(`UPDATE resources SET account_id = ? WHERE account_id IS NULL`).run(result.lastInsertRowid);
        console.log(`Migrated existing resources to account "${opts.username}"`);
      }
    }

    console.log(`Created ${opts.role} account "${opts.username}" (id=${result.lastInsertRowid})`);

  } else if (opts.deactivate) {
    const account = db.prepare(`SELECT id, is_active FROM accounts WHERE username = ?`).get(opts.username) as { id: number; is_active: number } | undefined;
    if (!account) {
      console.error(`Error: account "${opts.username}" not found`);
      process.exit(1);
    }
    db.prepare(`UPDATE accounts SET is_active = 0 WHERE username = ?`).run(opts.username);
    console.log(`Deactivated account "${opts.username}"`);

  } else if (opts.resetPassword) {
    if (!opts.password) {
      console.error('Error: --password is required for --reset-password');
      process.exit(1);
    }
    const account = db.prepare(`SELECT id FROM accounts WHERE username = ?`).get(opts.username) as { id: number } | undefined;
    if (!account) {
      console.error(`Error: account "${opts.username}" not found`);
      process.exit(1);
    }
    const hash = await bcrypt.hash(opts.password, SALT_ROUNDS);
    db.prepare(`UPDATE accounts SET password_hash = ? WHERE username = ?`).run(hash, opts.username);
    console.log(`Password reset for account "${opts.username}"`);

  } else {
    console.error('Error: specify --create, --deactivate, or --reset-password');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
