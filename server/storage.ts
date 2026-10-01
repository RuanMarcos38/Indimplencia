import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const directory = process.env.DATA_DIR || './data';
mkdirSync(directory, { recursive: true });
export const database = new DatabaseSync(directory + '/quitafacil.sqlite');
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL, password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    expires INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS records (
    collection TEXT NOT NULL, id TEXT NOT NULL, content TEXT NOT NULL,
    PRIMARY KEY(collection, id)
  );
`);

export const db = {
  async list<T>(collection: string, options: { limit?: number } = {}) {
    const rows = database.prepare('SELECT id, content FROM records WHERE collection = ? ORDER BY rowid LIMIT ?')
      .all(collection, options.limit || 100) as Array<{ id: string; content: string }>;
    return { items: rows.map(row => ({ ...JSON.parse(row.content), id: row.id } as T & { id: string })) };
  },
  async add(collection: string, records: unknown[]) {
    return records.map(record => {
      const id = randomUUID();
      database.prepare('INSERT INTO records(collection, id, content) VALUES (?, ?, ?)')
        .run(collection, id, JSON.stringify(record));
      return id;
    });
  },
  async update(collection: string, records: Array<{ id: string; record: unknown }>) {
    return records.map(({ id, record }) => database.prepare(
      'UPDATE records SET content = ? WHERE collection = ? AND id = ?'
    ).run(JSON.stringify(record), collection, id).changes > 0);
  },
};

