import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export function logJournalEntry(
  db: Database.Database,
  input: { project_id?: string; entry: string; author?: string }
) {
  const id = randomUUID();
  const author = input.author ?? 'user';
  const project_id = input.project_id ?? null;
  db.prepare(
    'INSERT INTO user_journal (id, project_id, author, entry) VALUES (?, ?, ?, ?)'
  ).run(id, project_id, author, input.entry);
  return { id, project_id, author, entry: input.entry };
}

export function listJournalEntries(
  db: Database.Database,
  input: { project_id?: string }
) {
  if (input.project_id) {
    return db
      .prepare('SELECT * FROM user_journal WHERE project_id = ? ORDER BY created_at ASC')
      .all(input.project_id);
  }
  return db
    .prepare('SELECT * FROM user_journal ORDER BY created_at ASC')
    .all();
}
