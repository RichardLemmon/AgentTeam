import type Database from 'better-sqlite3';

const CURRENT_VERSION = 3;

export function initializeSchema(db: Database.Database): void {
  const currentVersion = getSchemaVersion(db);
  if (currentVersion < CURRENT_VERSION) {
    applyMigrations(db, currentVersion);
  }
}

function getSchemaVersion(db: Database.Database): number {
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
  ).get();

  if (!tableExists) return 0;

  const row = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined;
  return row?.version ?? 0;
}

function applyMigrations(db: Database.Database, fromVersion: number): void {
  if (fromVersion < 1) migrateToV1(db);
  if (fromVersion < 2) migrateToV2(db);
  if (fromVersion < 3) migrateToV3(db);
}

function migrateToV1(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_summaries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      content TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      role TEXT NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      removed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      assignee_id TEXT REFERENCES team_members(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_entries (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      member_id TEXT NOT NULL REFERENCES team_members(id),
      entry_type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      member_id TEXT NOT NULL REFERENCES team_members(id),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discussions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      topic TEXT NOT NULL,
      summary TEXT,
      created_by TEXT NOT NULL REFERENCES team_members(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discussion_participants (
      discussion_id TEXT NOT NULL REFERENCES discussions(id),
      member_id TEXT NOT NULL REFERENCES team_members(id),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (discussion_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS discussion_messages (
      id TEXT PRIMARY KEY,
      discussion_id TEXT NOT NULL REFERENCES discussions(id),
      member_id TEXT NOT NULL REFERENCES team_members(id),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      member_id TEXT NOT NULL REFERENCES team_members(id),
      title TEXT NOT NULL,
      rationale TEXT NOT NULL,
      context TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shared_artifacts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      member_id TEXT NOT NULL REFERENCES team_members(id),
      title TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO schema_version (version) VALUES (1);
  `);
}

function migrateToV2(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_journal (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      author TEXT NOT NULL DEFAULT 'user',
      entry TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO schema_version (version) VALUES (2);
  `);
}

function migrateToV3(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_questions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      member_id TEXT NOT NULL REFERENCES team_members(id),
      question TEXT NOT NULL,
      context TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'answered')),
      answer TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      answered_at TEXT
    );

    CREATE TABLE IF NOT EXISTS expansion_requests (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      requested_by TEXT NOT NULL REFERENCES team_members(id),
      role_needed TEXT NOT NULL,
      justification TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'denied')),
      resolution_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    INSERT INTO schema_version (version) VALUES (3);
  `);
}
