import { describe, it, expect } from 'vitest';
import { createTestDb } from '../helpers.js';

describe('Schema', () => {
  it('creates all tables', () => {
    const db = createTestDb();
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all() as { name: string }[];

    const tableNames = tables.map(t => t.name);
    expect(tableNames).toEqual([
      'decisions',
      'discussion_messages',
      'discussion_participants',
      'discussions',
      'expansion_requests',
      'project_summaries',
      'projects',
      'schema_version',
      'shared_artifacts',
      'task_comments',
      'tasks',
      'team_members',
      'user_journal',
      'user_questions',
      'work_entries',
    ]);
    db.close();
  });

  it('sets schema version to latest', () => {
    const db = createTestDb();
    const row = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number };
    expect(row.version).toBe(3);
    db.close();
  });

  it('enforces foreign keys', () => {
    const db = createTestDb();
    expect(() => {
      db.prepare("INSERT INTO tasks (id, project_id, title, description, status, created_at, updated_at) VALUES ('t1', 'nonexistent', 'Test', 'Desc', 'pending', datetime('now'), datetime('now'))").run();
    }).toThrow();
    db.close();
  });
});
