import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initializeSchema } from './schema.js';

const DEFAULT_DB_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.agent-team',
  'team.db'
);

export function getDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath || process.env.AGENT_TEAM_DB_PATH || DEFAULT_DB_PATH;
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);
  return db;
}
