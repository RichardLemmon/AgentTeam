# AgentTeam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP server backed by SQLite that provides 35 tools for a 13-agent software development team, plus 13 agent prompt definition files.

**Architecture:** TypeScript MCP server using `@modelcontextprotocol/sdk` and `better-sqlite3`. Each tool domain (projects, tasks, discussions, etc.) is a separate module. Agent definitions are markdown prompt files in `agents/`. The database lives at `~/.agent-team/team.db` by default.

**Tech Stack:** TypeScript, Node.js, `@modelcontextprotocol/sdk`, `better-sqlite3`, `vitest` for testing

**Spec:** `docs/superpowers/specs/2026-03-23-agent-team-design.md`

---

## File Structure

```
mcp-server/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts              # MCP server entry point, registers all 35 tools
│   ├── constants.ts          # Valid roles, statuses, entry types, transitions
│   ├── validation.ts         # Input validation helpers
│   ├── db/
│   │   ├── connection.ts     # SQLite connection factory (WAL mode)
│   │   └── schema.ts         # Table creation, migration runner
│   └── tools/
│       ├── projects.ts       # create_project, get_project, update_project_status, list_projects
│       ├── summaries.ts      # get_project_summary, update_project_summary, get_summary_version, list_summary_history
│       ├── team-members.ts   # add_team_member, remove_team_member, list_team_members
│       ├── tasks.ts          # create_task, update_task, get_task, list_tasks
│       ├── work-entries.ts   # log_work, get_my_work, get_work_history
│       ├── task-comments.ts  # add_task_comment, list_task_comments, list_my_comments
│       ├── discussions.ts    # create_discussion, add_discussion_participant, add_discussion_message, update_discussion_summary, get_discussion, list_discussions
│       ├── decisions.ts      # log_decision, list_decisions, get_decision
│       └── artifacts.ts      # share_artifact, update_artifact, list_artifacts, get_artifact
├── tests/
│   ├── helpers.ts            # Test setup: in-memory DB factory, seed helpers
│   ├── db/
│   │   └── schema.test.ts
│   └── tools/
│       ├── projects.test.ts
│       ├── summaries.test.ts
│       ├── team-members.test.ts
│       ├── tasks.test.ts
│       ├── work-entries.test.ts
│       ├── task-comments.test.ts
│       ├── discussions.test.ts
│       ├── decisions.test.ts
│       └── artifacts.test.ts
agents/
├── project-manager.md
├── product-manager.md
├── ux-ui-designer.md
├── ux-researcher.md
├── frontend-developer.md
├── backend-developer.md
├── full-stack-developer.md
├── mobile-developer.md
├── devops-engineer.md
├── qa-engineer.md
├── security-engineer.md
├── data-engineer.md
└── data-scientist.md
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `mcp-server/package.json`
- Create: `mcp-server/tsconfig.json`
- Create: `mcp-server/vitest.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "agent-team-mcp",
  "version": "1.0.0",
  "description": "MCP server for AgentTeam - a reusable AI software development team",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "better-sqlite3": "^11.8.2"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22.15.3",
    "typescript": "^5.8.3",
    "vitest": "^3.1.2"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `cd mcp-server && npm install`
Expected: `node_modules/` created, `package-lock.json` generated

- [ ] **Step 5: Commit**

```bash
git add mcp-server/package.json mcp-server/tsconfig.json mcp-server/vitest.config.ts mcp-server/package-lock.json
git commit -m "feat: scaffold MCP server project with dependencies"
```

---

## Task 2: Constants and Validation

**Files:**
- Create: `mcp-server/src/constants.ts`
- Create: `mcp-server/src/validation.ts`

- [ ] **Step 1: Create constants.ts**

```typescript
export const VALID_ROLES = [
  'project_manager',
  'product_manager',
  'ux_ui_designer',
  'ux_researcher',
  'frontend_developer',
  'backend_developer',
  'full_stack_developer',
  'mobile_developer',
  'devops_engineer',
  'qa_engineer',
  'security_engineer',
  'data_engineer',
  'data_scientist',
] as const;

export type Role = typeof VALID_ROLES[number];

export const VALID_PROJECT_STATUSES = ['active', 'paused', 'archived', 'closed'] as const;
export type ProjectStatus = typeof VALID_PROJECT_STATUSES[number];

export const PROJECT_TRANSITIONS: Record<string, string[]> = {
  active: ['paused', 'archived', 'closed'],
  paused: ['active', 'archived', 'closed'],
  archived: ['active'],
  closed: [],
};

export const VALID_TASK_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'] as const;
export type TaskStatus = typeof VALID_TASK_STATUSES[number];

export const VALID_ENTRY_TYPES = ['code', 'note', 'status_update'] as const;
export type EntryType = typeof VALID_ENTRY_TYPES[number];

export const ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  CONSTRAINT_ERROR: 'CONSTRAINT_ERROR',
} as const;
```

- [ ] **Step 2: Create validation.ts**

```typescript
import {
  VALID_ROLES,
  VALID_PROJECT_STATUSES,
  VALID_TASK_STATUSES,
  VALID_ENTRY_TYPES,
  PROJECT_TRANSITIONS,
  ERROR_CODES,
} from './constants.js';

export interface ToolError {
  error: string;
  code: string;
}

export function validateRequired(value: unknown, fieldName: string): ToolError | null {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return { error: `${fieldName} is required`, code: ERROR_CODES.INVALID_INPUT };
  }
  return null;
}

export function validateRole(role: string): ToolError | null {
  if (!VALID_ROLES.includes(role as any)) {
    return { error: `Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`, code: ERROR_CODES.INVALID_INPUT };
  }
  return null;
}

export function validateProjectStatus(status: string): ToolError | null {
  if (!VALID_PROJECT_STATUSES.includes(status as any)) {
    return { error: `Invalid status: ${status}. Must be one of: ${VALID_PROJECT_STATUSES.join(', ')}`, code: ERROR_CODES.INVALID_INPUT };
  }
  return null;
}

export function validateProjectTransition(currentStatus: string, newStatus: string): ToolError | null {
  const allowed = PROJECT_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    return { error: `Cannot transition from ${currentStatus} to ${newStatus}`, code: ERROR_CODES.INVALID_TRANSITION };
  }
  return null;
}

export function validateTaskStatus(status: string): ToolError | null {
  if (!VALID_TASK_STATUSES.includes(status as any)) {
    return { error: `Invalid task status: ${status}. Must be one of: ${VALID_TASK_STATUSES.join(', ')}`, code: ERROR_CODES.INVALID_INPUT };
  }
  return null;
}

export function validateEntryType(entryType: string): ToolError | null {
  if (!VALID_ENTRY_TYPES.includes(entryType as any)) {
    return { error: `Invalid entry type: ${entryType}. Must be one of: ${VALID_ENTRY_TYPES.join(', ')}`, code: ERROR_CODES.INVALID_INPUT };
  }
  return null;
}

export function notFound(entity: string, id: string): ToolError {
  return { error: `${entity} not found: ${id}`, code: ERROR_CODES.NOT_FOUND };
}
```

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/constants.ts mcp-server/src/validation.ts
git commit -m "feat: add constants and validation helpers"
```

---

## Task 3: Database Connection and Schema

**Files:**
- Create: `mcp-server/src/db/connection.ts`
- Create: `mcp-server/src/db/schema.ts`
- Create: `mcp-server/tests/helpers.ts`
- Create: `mcp-server/tests/db/schema.test.ts`

- [ ] **Step 1: Write failing schema test**

Create `mcp-server/tests/helpers.ts`:

```typescript
import Database from 'better-sqlite3';
import { initializeSchema } from '../src/db/schema.js';

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);
  return db;
}
```

Create `mcp-server/tests/db/schema.test.ts`:

```typescript
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
      'project_summaries',
      'projects',
      'schema_version',
      'shared_artifacts',
      'task_comments',
      'tasks',
      'team_members',
      'work_entries',
    ]);
    db.close();
  });

  it('sets schema version to 1', () => {
    const db = createTestDb();
    const row = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number };
    expect(row.version).toBe(1);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npx vitest run tests/db/schema.test.ts`
Expected: FAIL — cannot resolve `../src/db/schema.js`

- [ ] **Step 3: Create connection.ts**

```typescript
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
```

- [ ] **Step 4: Create schema.ts**

```typescript
import type Database from 'better-sqlite3';

const CURRENT_VERSION = 1;

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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run tests/db/schema.test.ts`
Expected: PASS — all 3 tests

- [ ] **Step 6: Commit**

```bash
git add mcp-server/src/db/ mcp-server/tests/
git commit -m "feat: add database connection, schema, and migration system"
```

---

## Task 4: Projects Tools

**Files:**
- Create: `mcp-server/src/tools/projects.ts`
- Create: `mcp-server/tests/tools/projects.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject, getProject, updateProjectStatus, listProjects } from '../../src/tools/projects.js';

describe('Projects Tools', () => {
  let db: Database.Database;

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  describe('create_project', () => {
    it('creates a project with active status', () => {
      const result = createProject(db, { name: 'Test Project', description: 'A test' });
      expect(result.name).toBe('Test Project');
      expect(result.description).toBe('A test');
      expect(result.status).toBe('active');
      expect(result.id).toBeTruthy();
      expect(result.created_at).toBeTruthy();
    });

    it('rejects empty name', () => {
      const result = createProject(db, { name: '', description: 'A test' });
      expect(result.code).toBe('INVALID_INPUT');
    });
  });

  describe('get_project', () => {
    it('returns a project by ID', () => {
      const created = createProject(db, { name: 'Test', description: 'Desc' });
      const result = getProject(db, { project_id: created.id });
      expect(result.name).toBe('Test');
    });

    it('returns NOT_FOUND for missing project', () => {
      const result = getProject(db, { project_id: 'nonexistent' });
      expect(result.code).toBe('NOT_FOUND');
    });
  });

  describe('update_project_status', () => {
    it('transitions active to paused', () => {
      const created = createProject(db, { name: 'Test', description: 'Desc' });
      const result = updateProjectStatus(db, { project_id: created.id, status: 'paused' });
      expect(result.status).toBe('paused');
    });

    it('rejects invalid transition from closed', () => {
      const created = createProject(db, { name: 'Test', description: 'Desc' });
      updateProjectStatus(db, { project_id: created.id, status: 'closed' });
      const result = updateProjectStatus(db, { project_id: created.id, status: 'active' });
      expect(result.code).toBe('INVALID_TRANSITION');
    });

    it('allows archived to active (reopen)', () => {
      const created = createProject(db, { name: 'Test', description: 'Desc' });
      updateProjectStatus(db, { project_id: created.id, status: 'archived' });
      const result = updateProjectStatus(db, { project_id: created.id, status: 'active' });
      expect(result.status).toBe('active');
    });
  });

  describe('list_projects', () => {
    it('lists all projects', () => {
      createProject(db, { name: 'P1', description: 'D1' });
      createProject(db, { name: 'P2', description: 'D2' });
      const result = listProjects(db, {});
      expect(result.length).toBe(2);
    });

    it('filters by status', () => {
      createProject(db, { name: 'P1', description: 'D1' });
      const p2 = createProject(db, { name: 'P2', description: 'D2' });
      updateProjectStatus(db, { project_id: p2.id, status: 'paused' });
      const result = listProjects(db, { status: 'active' });
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('P1');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npx vitest run tests/tools/projects.test.ts`
Expected: FAIL — cannot resolve `../../src/tools/projects.js`

- [ ] **Step 3: Implement projects.ts**

```typescript
import type Database from 'better-sqlite3';
import crypto from 'crypto';
import {
  validateRequired,
  validateProjectStatus,
  validateProjectTransition,
  notFound,
} from '../validation.js';

export function createProject(db: Database.Database, input: { name: string; description: string }) {
  const nameErr = validateRequired(input.name, 'name');
  if (nameErr) return nameErr;
  const descErr = validateRequired(input.description, 'description');
  if (descErr) return descErr;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO projects (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, input.name, input.description, 'active', now, now);

  return { id, name: input.name, description: input.description, status: 'active', created_at: now };
}

export function getProject(db: Database.Database, input: { project_id: string }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(input.project_id) as any;
  if (!row) return notFound('Project', input.project_id);

  return { id: row.id, name: row.name, description: row.description, status: row.status, created_at: row.created_at, updated_at: row.updated_at };
}

export function updateProjectStatus(db: Database.Database, input: { project_id: string; status: string }) {
  const idErr = validateRequired(input.project_id, 'project_id');
  if (idErr) return idErr;
  const statusErr = validateProjectStatus(input.status);
  if (statusErr) return statusErr;

  const project = db.prepare('SELECT status FROM projects WHERE id = ?').get(input.project_id) as any;
  if (!project) return notFound('Project', input.project_id);

  const transErr = validateProjectTransition(project.status, input.status);
  if (transErr) return transErr;

  const now = new Date().toISOString();
  db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run(input.status, now, input.project_id);

  return { id: input.project_id, status: input.status, updated_at: now };
}

export function listProjects(db: Database.Database, input: { status?: string }) {
  if (input.status) {
    return db.prepare('SELECT id, name, status, created_at, updated_at FROM projects WHERE status = ? ORDER BY created_at DESC').all(input.status);
  }
  return db.prepare('SELECT id, name, status, created_at, updated_at FROM projects ORDER BY created_at DESC').all();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run tests/tools/projects.test.ts`
Expected: PASS — all 7 tests

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/projects.ts mcp-server/tests/tools/projects.test.ts
git commit -m "feat: add projects tools (create, get, update_status, list)"
```

---

## Task 5: Project Summaries Tools

**Files:**
- Create: `mcp-server/src/tools/summaries.ts`
- Create: `mcp-server/tests/tools/summaries.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { getProjectSummary, updateProjectSummary, getSummaryVersion, listSummaryHistory } from '../../src/tools/summaries.js';

describe('Summaries Tools', () => {
  let db: Database.Database;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
  });
  afterEach(() => { db.close(); });

  describe('update_project_summary', () => {
    it('creates first summary with version 1', () => {
      const result = updateProjectSummary(db, { project_id: projectId, content: 'Initial summary' });
      expect(result.version).toBe(1);
      expect(result.project_id).toBe(projectId);
    });

    it('increments version on subsequent updates', () => {
      updateProjectSummary(db, { project_id: projectId, content: 'V1' });
      const result = updateProjectSummary(db, { project_id: projectId, content: 'V2' });
      expect(result.version).toBe(2);
    });
  });

  describe('get_project_summary', () => {
    it('returns latest version', () => {
      updateProjectSummary(db, { project_id: projectId, content: 'V1' });
      updateProjectSummary(db, { project_id: projectId, content: 'V2' });
      const result = getProjectSummary(db, { project_id: projectId });
      expect(result.content).toBe('V2');
      expect(result.version).toBe(2);
    });

    it('returns NOT_FOUND when no summary exists', () => {
      const result = getProjectSummary(db, { project_id: projectId });
      expect(result.code).toBe('NOT_FOUND');
    });
  });

  describe('get_summary_version', () => {
    it('retrieves a specific historical version', () => {
      const v1 = updateProjectSummary(db, { project_id: projectId, content: 'V1' });
      updateProjectSummary(db, { project_id: projectId, content: 'V2' });
      const result = getSummaryVersion(db, { summary_id: v1.id });
      expect(result.content).toBe('V1');
      expect(result.version).toBe(1);
    });
  });

  describe('list_summary_history', () => {
    it('returns all versions ordered by version desc', () => {
      updateProjectSummary(db, { project_id: projectId, content: 'V1' });
      updateProjectSummary(db, { project_id: projectId, content: 'V2' });
      updateProjectSummary(db, { project_id: projectId, content: 'V3' });
      const result = listSummaryHistory(db, { project_id: projectId });
      expect(result.length).toBe(3);
      expect(result[0].version).toBe(3);
      expect(result[2].version).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npx vitest run tests/tools/summaries.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement summaries.ts**

```typescript
import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired, notFound } from '../validation.js';

export function updateProjectSummary(db: Database.Database, input: { project_id: string; content: string }) {
  const idErr = validateRequired(input.project_id, 'project_id');
  if (idErr) return idErr;
  const contentErr = validateRequired(input.content, 'content');
  if (contentErr) return contentErr;

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(input.project_id);
  if (!project) return notFound('Project', input.project_id);

  const lastVersion = db.prepare(
    'SELECT version FROM project_summaries WHERE project_id = ? ORDER BY version DESC LIMIT 1'
  ).get(input.project_id) as { version: number } | undefined;

  const version = (lastVersion?.version ?? 0) + 1;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO project_summaries (id, project_id, content, version, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.project_id, input.content, version, now);

  return { id, project_id: input.project_id, version, created_at: now };
}

export function getProjectSummary(db: Database.Database, input: { project_id: string }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  const row = db.prepare(
    'SELECT * FROM project_summaries WHERE project_id = ? ORDER BY version DESC LIMIT 1'
  ).get(input.project_id) as any;

  if (!row) return notFound('Summary', input.project_id);
  return { id: row.id, project_id: row.project_id, content: row.content, version: row.version, created_at: row.created_at };
}

export function getSummaryVersion(db: Database.Database, input: { summary_id: string }) {
  const err = validateRequired(input.summary_id, 'summary_id');
  if (err) return err;

  const row = db.prepare('SELECT * FROM project_summaries WHERE id = ?').get(input.summary_id) as any;
  if (!row) return notFound('Summary version', input.summary_id);

  return { id: row.id, project_id: row.project_id, content: row.content, version: row.version, created_at: row.created_at };
}

export function listSummaryHistory(db: Database.Database, input: { project_id: string }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  return db.prepare(
    'SELECT id, version, created_at FROM project_summaries WHERE project_id = ? ORDER BY version DESC'
  ).all(input.project_id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run tests/tools/summaries.test.ts`
Expected: PASS — all 5 tests

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/summaries.ts mcp-server/tests/tools/summaries.test.ts
git commit -m "feat: add project summaries tools (get, update, get_version, list_history)"
```

---

## Task 6: Team Members Tools

**Files:**
- Create: `mcp-server/src/tools/team-members.ts`
- Create: `mcp-server/tests/tools/team-members.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember, removeTeamMember, listTeamMembers } from '../../src/tools/team-members.js';

describe('Team Members Tools', () => {
  let db: Database.Database;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
  });
  afterEach(() => { db.close(); });

  describe('add_team_member', () => {
    it('adds a member with a valid role', () => {
      const result = addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
      expect(result.role).toBe('backend_developer');
      expect(result.id).toBeTruthy();
      expect(result.project_id).toBe(projectId);
    });

    it('rejects invalid role', () => {
      const result = addTeamMember(db, { project_id: projectId, role: 'wizard' });
      expect(result.code).toBe('INVALID_INPUT');
    });
  });

  describe('remove_team_member', () => {
    it('sets removed_at timestamp', () => {
      const member = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      const result = removeTeamMember(db, { member_id: member.id });
      expect(result.removed_at).toBeTruthy();
    });

    it('returns NOT_FOUND for missing member', () => {
      const result = removeTeamMember(db, { member_id: 'nonexistent' });
      expect(result.code).toBe('NOT_FOUND');
    });
  });

  describe('list_team_members', () => {
    it('lists active members by default', () => {
      addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
      const removed = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      removeTeamMember(db, { member_id: removed.id });

      const result = listTeamMembers(db, { project_id: projectId });
      expect(result.length).toBe(1);
      expect(result[0].role).toBe('backend_developer');
    });

    it('lists all members when active_only is false', () => {
      addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
      const removed = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      removeTeamMember(db, { member_id: removed.id });

      const result = listTeamMembers(db, { project_id: projectId, active_only: false });
      expect(result.length).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npx vitest run tests/tools/team-members.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement team-members.ts**

```typescript
import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired, validateRole, notFound } from '../validation.js';

export function addTeamMember(db: Database.Database, input: { project_id: string; role: string }) {
  const idErr = validateRequired(input.project_id, 'project_id');
  if (idErr) return idErr;
  const roleErr = validateRole(input.role);
  if (roleErr) return roleErr;

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(input.project_id);
  if (!project) return notFound('Project', input.project_id);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO team_members (id, project_id, role, joined_at) VALUES (?, ?, ?, ?)'
  ).run(id, input.project_id, input.role, now);

  return { id, project_id: input.project_id, role: input.role, joined_at: now };
}

export function removeTeamMember(db: Database.Database, input: { member_id: string }) {
  const err = validateRequired(input.member_id, 'member_id');
  if (err) return err;

  const member = db.prepare('SELECT id FROM team_members WHERE id = ?').get(input.member_id);
  if (!member) return notFound('Team member', input.member_id);

  const now = new Date().toISOString();
  db.prepare('UPDATE team_members SET removed_at = ? WHERE id = ?').run(now, input.member_id);

  return { id: input.member_id, removed_at: now };
}

export function listTeamMembers(db: Database.Database, input: { project_id: string; active_only?: boolean }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  const activeOnly = input.active_only !== false;
  if (activeOnly) {
    return db.prepare(
      'SELECT id, role, joined_at, removed_at FROM team_members WHERE project_id = ? AND removed_at IS NULL ORDER BY joined_at'
    ).all(input.project_id);
  }
  return db.prepare(
    'SELECT id, role, joined_at, removed_at FROM team_members WHERE project_id = ? ORDER BY joined_at'
  ).all(input.project_id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run tests/tools/team-members.test.ts`
Expected: PASS — all 5 tests

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/team-members.ts mcp-server/tests/tools/team-members.test.ts
git commit -m "feat: add team members tools (add, remove, list)"
```

---

## Task 7: Tasks Tools

**Files:**
- Create: `mcp-server/src/tools/tasks.ts`
- Create: `mcp-server/tests/tools/tasks.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember } from '../../src/tools/team-members.js';
import { createTask, updateTask, getTask, listTasks } from '../../src/tools/tasks.js';

describe('Tasks Tools', () => {
  let db: Database.Database;
  let projectId: string;
  let memberId: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
    const member = addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
    memberId = member.id;
  });
  afterEach(() => { db.close(); });

  describe('create_task', () => {
    it('creates an assigned task', () => {
      const result = createTask(db, { project_id: projectId, title: 'Build API', description: 'REST endpoints', assignee_id: memberId });
      expect(result.title).toBe('Build API');
      expect(result.status).toBe('pending');
      expect(result.assignee_id).toBe(memberId);
    });

    it('creates an unassigned task', () => {
      const result = createTask(db, { project_id: projectId, title: 'Build API', description: 'REST endpoints' });
      expect(result.assignee_id).toBeNull();
    });
  });

  describe('update_task', () => {
    it('updates status', () => {
      const task = createTask(db, { project_id: projectId, title: 'T', description: 'D', assignee_id: memberId });
      const result = updateTask(db, { task_id: task.id, status: 'in_progress' });
      expect(result.status).toBe('in_progress');
    });

    it('reassigns task', () => {
      const member2 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      const task = createTask(db, { project_id: projectId, title: 'T', description: 'D', assignee_id: memberId });
      const result = updateTask(db, { task_id: task.id, assignee_id: member2.id });
      expect(result.assignee_id).toBe(member2.id);
    });

    it('rejects invalid status', () => {
      const task = createTask(db, { project_id: projectId, title: 'T', description: 'D' });
      const result = updateTask(db, { task_id: task.id, status: 'done' });
      expect(result.code).toBe('INVALID_INPUT');
    });
  });

  describe('get_task', () => {
    it('returns full task details', () => {
      const task = createTask(db, { project_id: projectId, title: 'Build API', description: 'REST endpoints', assignee_id: memberId });
      const result = getTask(db, { task_id: task.id });
      expect(result.title).toBe('Build API');
      expect(result.description).toBe('REST endpoints');
    });
  });

  describe('list_tasks', () => {
    it('filters by assignee', () => {
      const member2 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      createTask(db, { project_id: projectId, title: 'T1', description: 'D', assignee_id: memberId });
      createTask(db, { project_id: projectId, title: 'T2', description: 'D', assignee_id: member2.id });
      const result = listTasks(db, { project_id: projectId, assignee_id: memberId });
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('T1');
    });

    it('filters by status', () => {
      const t1 = createTask(db, { project_id: projectId, title: 'T1', description: 'D' });
      createTask(db, { project_id: projectId, title: 'T2', description: 'D' });
      updateTask(db, { task_id: t1.id, status: 'completed' });
      const result = listTasks(db, { project_id: projectId, status: 'pending' });
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('T2');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npx vitest run tests/tools/tasks.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement tasks.ts**

```typescript
import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired, validateTaskStatus, notFound } from '../validation.js';

export function createTask(db: Database.Database, input: { project_id: string; title: string; description: string; assignee_id?: string }) {
  const idErr = validateRequired(input.project_id, 'project_id');
  if (idErr) return idErr;
  const titleErr = validateRequired(input.title, 'title');
  if (titleErr) return titleErr;
  const descErr = validateRequired(input.description, 'description');
  if (descErr) return descErr;

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(input.project_id);
  if (!project) return notFound('Project', input.project_id);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO tasks (id, project_id, assignee_id, title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.project_id, input.assignee_id ?? null, input.title, input.description, 'pending', now, now);

  return { id, project_id: input.project_id, assignee_id: input.assignee_id ?? null, title: input.title, status: 'pending', created_at: now };
}

export function updateTask(db: Database.Database, input: { task_id: string; status?: string; description?: string; assignee_id?: string }) {
  const idErr = validateRequired(input.task_id, 'task_id');
  if (idErr) return idErr;

  if (input.status) {
    const statusErr = validateTaskStatus(input.status);
    if (statusErr) return statusErr;
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(input.task_id) as any;
  if (!task) return notFound('Task', input.task_id);

  const now = new Date().toISOString();
  const status = input.status ?? task.status;
  const description = input.description ?? task.description;
  const assigneeId = input.assignee_id !== undefined ? input.assignee_id : task.assignee_id;

  db.prepare(
    'UPDATE tasks SET status = ?, description = ?, assignee_id = ?, updated_at = ? WHERE id = ?'
  ).run(status, description, assigneeId, now, input.task_id);

  return { id: input.task_id, status, assignee_id: assigneeId, updated_at: now };
}

export function getTask(db: Database.Database, input: { task_id: string }) {
  const err = validateRequired(input.task_id, 'task_id');
  if (err) return err;

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(input.task_id) as any;
  if (!row) return notFound('Task', input.task_id);

  return { id: row.id, project_id: row.project_id, assignee_id: row.assignee_id, title: row.title, description: row.description, status: row.status, created_at: row.created_at, updated_at: row.updated_at };
}

export function listTasks(db: Database.Database, input: { project_id: string; assignee_id?: string; status?: string }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  let sql = 'SELECT id, title, assignee_id, status, created_at, updated_at FROM tasks WHERE project_id = ?';
  const params: any[] = [input.project_id];

  if (input.assignee_id) {
    sql += ' AND assignee_id = ?';
    params.push(input.assignee_id);
  }
  if (input.status) {
    sql += ' AND status = ?';
    params.push(input.status);
  }
  sql += ' ORDER BY created_at DESC';

  return db.prepare(sql).all(...params);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run tests/tools/tasks.test.ts`
Expected: PASS — all 7 tests

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/tasks.ts mcp-server/tests/tools/tasks.test.ts
git commit -m "feat: add tasks tools (create, update, get, list)"
```

---

## Task 8: Work Entries Tools

**Files:**
- Create: `mcp-server/src/tools/work-entries.ts`
- Create: `mcp-server/tests/tools/work-entries.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember } from '../../src/tools/team-members.js';
import { createTask } from '../../src/tools/tasks.js';
import { logWork, getMyWork, getWorkHistory } from '../../src/tools/work-entries.js';

describe('Work Entries Tools', () => {
  let db: Database.Database;
  let projectId: string;
  let memberId: string;
  let taskId: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
    const member = addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
    memberId = member.id;
    const task = createTask(db, { project_id: projectId, title: 'T', description: 'D', assignee_id: memberId });
    taskId = task.id;
  });
  afterEach(() => { db.close(); });

  describe('log_work', () => {
    it('creates a work entry', () => {
      const result = logWork(db, { task_id: taskId, member_id: memberId, entry_type: 'code', content: 'Wrote the API endpoint' });
      expect(result.entry_type).toBe('code');
      expect(result.task_id).toBe(taskId);
    });

    it('rejects invalid entry type', () => {
      const result = logWork(db, { task_id: taskId, member_id: memberId, entry_type: 'decision', content: 'Bad' });
      expect(result.code).toBe('INVALID_INPUT');
    });
  });

  describe('get_my_work', () => {
    it('returns only entries for the specified member', () => {
      const member2 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      const task2 = createTask(db, { project_id: projectId, title: 'T2', description: 'D', assignee_id: member2.id });
      logWork(db, { task_id: taskId, member_id: memberId, entry_type: 'code', content: 'My work' });
      logWork(db, { task_id: task2.id, member_id: member2.id, entry_type: 'note', content: 'Their work' });

      const result = getMyWork(db, { member_id: memberId });
      expect(result.length).toBe(1);
      expect(result[0].content).toBe('My work');
    });

    it('filters by task_id', () => {
      const task2 = createTask(db, { project_id: projectId, title: 'T2', description: 'D', assignee_id: memberId });
      logWork(db, { task_id: taskId, member_id: memberId, entry_type: 'code', content: 'Work 1' });
      logWork(db, { task_id: task2.id, member_id: memberId, entry_type: 'note', content: 'Work 2' });

      const result = getMyWork(db, { member_id: memberId, task_id: taskId });
      expect(result.length).toBe(1);
      expect(result[0].content).toBe('Work 1');
    });
  });

  describe('get_work_history', () => {
    it('returns all work entries for a member across a project', () => {
      const task2 = createTask(db, { project_id: projectId, title: 'T2', description: 'D', assignee_id: memberId });
      logWork(db, { task_id: taskId, member_id: memberId, entry_type: 'code', content: 'W1' });
      logWork(db, { task_id: task2.id, member_id: memberId, entry_type: 'note', content: 'W2' });

      const result = getWorkHistory(db, { member_id: memberId, project_id: projectId });
      expect(result.length).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npx vitest run tests/tools/work-entries.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement work-entries.ts**

```typescript
import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired, validateEntryType, notFound } from '../validation.js';

export function logWork(db: Database.Database, input: { task_id: string; member_id: string; entry_type: string; content: string }) {
  const taskErr = validateRequired(input.task_id, 'task_id');
  if (taskErr) return taskErr;
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;
  const typeErr = validateEntryType(input.entry_type);
  if (typeErr) return typeErr;
  const contentErr = validateRequired(input.content, 'content');
  if (contentErr) return contentErr;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO work_entries (id, task_id, member_id, entry_type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, input.task_id, input.member_id, input.entry_type, input.content, now);

  return { id, task_id: input.task_id, member_id: input.member_id, entry_type: input.entry_type, created_at: now };
}

export function getMyWork(db: Database.Database, input: { member_id: string; task_id?: string }) {
  const err = validateRequired(input.member_id, 'member_id');
  if (err) return err;

  if (input.task_id) {
    return db.prepare(
      'SELECT id, task_id, entry_type, content, created_at FROM work_entries WHERE member_id = ? AND task_id = ? ORDER BY created_at DESC'
    ).all(input.member_id, input.task_id);
  }
  return db.prepare(
    'SELECT id, task_id, entry_type, content, created_at FROM work_entries WHERE member_id = ? ORDER BY created_at DESC'
  ).all(input.member_id);
}

export function getWorkHistory(db: Database.Database, input: { member_id: string; project_id: string }) {
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;
  const projectErr = validateRequired(input.project_id, 'project_id');
  if (projectErr) return projectErr;

  return db.prepare(
    `SELECT we.id, we.task_id, we.entry_type, we.content, we.created_at
     FROM work_entries we
     JOIN tasks t ON we.task_id = t.id
     WHERE we.member_id = ? AND t.project_id = ?
     ORDER BY we.created_at DESC`
  ).all(input.member_id, input.project_id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run tests/tools/work-entries.test.ts`
Expected: PASS — all 5 tests

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/work-entries.ts mcp-server/tests/tools/work-entries.test.ts
git commit -m "feat: add work entries tools (log, get_my_work, get_history)"
```

---

## Task 9: Task Comments Tools

**Files:**
- Create: `mcp-server/src/tools/task-comments.ts`
- Create: `mcp-server/tests/tools/task-comments.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember } from '../../src/tools/team-members.js';
import { createTask } from '../../src/tools/tasks.js';
import { addTaskComment, listTaskComments, listMyComments } from '../../src/tools/task-comments.js';

describe('Task Comments Tools', () => {
  let db: Database.Database;
  let projectId: string;
  let memberId: string;
  let taskId: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
    const member = addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
    memberId = member.id;
    const task = createTask(db, { project_id: projectId, title: 'T', description: 'D', assignee_id: memberId });
    taskId = task.id;
  });
  afterEach(() => { db.close(); });

  describe('add_task_comment', () => {
    it('adds a comment to a task', () => {
      const result = addTaskComment(db, { task_id: taskId, member_id: memberId, content: 'Found an edge case' });
      expect(result.task_id).toBe(taskId);
      expect(result.member_id).toBe(memberId);
    });
  });

  describe('list_task_comments', () => {
    it('returns all comments on a task', () => {
      const member2 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      addTaskComment(db, { task_id: taskId, member_id: memberId, content: 'C1' });
      addTaskComment(db, { task_id: taskId, member_id: member2.id, content: 'C2' });
      const result = listTaskComments(db, { task_id: taskId });
      expect(result.length).toBe(2);
    });
  });

  describe('list_my_comments', () => {
    it('returns only my comments across a project', () => {
      const task2 = createTask(db, { project_id: projectId, title: 'T2', description: 'D' });
      const member2 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      addTaskComment(db, { task_id: taskId, member_id: memberId, content: 'Mine' });
      addTaskComment(db, { task_id: task2.id, member_id: memberId, content: 'Also mine' });
      addTaskComment(db, { task_id: taskId, member_id: member2.id, content: 'Not mine' });

      const result = listMyComments(db, { member_id: memberId, project_id: projectId });
      expect(result.length).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npx vitest run tests/tools/task-comments.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement task-comments.ts**

```typescript
import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired } from '../validation.js';

export function addTaskComment(db: Database.Database, input: { task_id: string; member_id: string; content: string }) {
  const taskErr = validateRequired(input.task_id, 'task_id');
  if (taskErr) return taskErr;
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;
  const contentErr = validateRequired(input.content, 'content');
  if (contentErr) return contentErr;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO task_comments (id, task_id, member_id, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.task_id, input.member_id, input.content, now);

  return { id, task_id: input.task_id, member_id: input.member_id, created_at: now };
}

export function listTaskComments(db: Database.Database, input: { task_id: string }) {
  const err = validateRequired(input.task_id, 'task_id');
  if (err) return err;

  return db.prepare(
    'SELECT id, member_id, content, created_at FROM task_comments WHERE task_id = ? ORDER BY created_at'
  ).all(input.task_id);
}

export function listMyComments(db: Database.Database, input: { member_id: string; project_id: string }) {
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;
  const projectErr = validateRequired(input.project_id, 'project_id');
  if (projectErr) return projectErr;

  return db.prepare(
    `SELECT tc.id, tc.task_id, tc.content, tc.created_at
     FROM task_comments tc
     JOIN tasks t ON tc.task_id = t.id
     WHERE tc.member_id = ? AND t.project_id = ?
     ORDER BY tc.created_at DESC`
  ).all(input.member_id, input.project_id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run tests/tools/task-comments.test.ts`
Expected: PASS — all 3 tests

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/task-comments.ts mcp-server/tests/tools/task-comments.test.ts
git commit -m "feat: add task comments tools (add, list, list_mine)"
```

---

## Task 10: Discussions Tools

**Files:**
- Create: `mcp-server/src/tools/discussions.ts`
- Create: `mcp-server/tests/tools/discussions.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember } from '../../src/tools/team-members.js';
import {
  createDiscussion, addDiscussionParticipant, addDiscussionMessage,
  updateDiscussionSummary, getDiscussion, listDiscussions
} from '../../src/tools/discussions.js';

describe('Discussions Tools', () => {
  let db: Database.Database;
  let projectId: string;
  let member1Id: string;
  let member2Id: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
    const m1 = addTeamMember(db, { project_id: projectId, role: 'project_manager' });
    member1Id = m1.id;
    const m2 = addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
    member2Id = m2.id;
  });
  afterEach(() => { db.close(); });

  describe('create_discussion', () => {
    it('creates a discussion with participants', () => {
      const result = createDiscussion(db, {
        project_id: projectId, topic: 'API Design', created_by: member1Id, participant_ids: [member2Id]
      });
      expect(result.topic).toBe('API Design');
    });

    it('automatically adds creator as participant', () => {
      const disc = createDiscussion(db, {
        project_id: projectId, topic: 'Test', created_by: member1Id, participant_ids: []
      });
      const full = getDiscussion(db, { discussion_id: disc.id });
      expect(full.participants.length).toBe(1);
      expect(full.participants[0].member_id).toBe(member1Id);
    });
  });

  describe('add_discussion_participant', () => {
    it('adds a new participant after creation', () => {
      const member3 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      const disc = createDiscussion(db, {
        project_id: projectId, topic: 'Test', created_by: member1Id, participant_ids: [member2Id]
      });
      addDiscussionParticipant(db, { discussion_id: disc.id, member_id: member3.id });
      const full = getDiscussion(db, { discussion_id: disc.id });
      expect(full.participants.length).toBe(3);
    });
  });

  describe('add_discussion_message', () => {
    it('adds a message from a participant', () => {
      const disc = createDiscussion(db, {
        project_id: projectId, topic: 'Test', created_by: member1Id, participant_ids: [member2Id]
      });
      const result = addDiscussionMessage(db, { discussion_id: disc.id, member_id: member1Id, content: 'Hello team' });
      expect(result.discussion_id).toBe(disc.id);
    });

    it('rejects message from non-participant', () => {
      const member3 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      const disc = createDiscussion(db, {
        project_id: projectId, topic: 'Test', created_by: member1Id, participant_ids: [member2Id]
      });
      const result = addDiscussionMessage(db, { discussion_id: disc.id, member_id: member3.id, content: 'Hello' });
      expect(result.code).toBe('INVALID_INPUT');
    });
  });

  describe('update_discussion_summary', () => {
    it('sets the discussion summary', () => {
      const disc = createDiscussion(db, {
        project_id: projectId, topic: 'Test', created_by: member1Id, participant_ids: []
      });
      const result = updateDiscussionSummary(db, { discussion_id: disc.id, summary: 'We decided X' });
      expect(result.discussion_id).toBe(disc.id);
    });
  });

  describe('get_discussion', () => {
    it('returns full discussion with participants and messages', () => {
      const disc = createDiscussion(db, {
        project_id: projectId, topic: 'API Design', created_by: member1Id, participant_ids: [member2Id]
      });
      addDiscussionMessage(db, { discussion_id: disc.id, member_id: member1Id, content: 'Msg 1' });
      addDiscussionMessage(db, { discussion_id: disc.id, member_id: member2Id, content: 'Msg 2' });
      updateDiscussionSummary(db, { discussion_id: disc.id, summary: 'Summary' });

      const result = getDiscussion(db, { discussion_id: disc.id });
      expect(result.topic).toBe('API Design');
      expect(result.summary).toBe('Summary');
      expect(result.participants.length).toBe(2);
      expect(result.messages.length).toBe(2);
    });
  });

  describe('list_discussions', () => {
    it('filters by participant', () => {
      const member3 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      createDiscussion(db, { project_id: projectId, topic: 'D1', created_by: member1Id, participant_ids: [member2Id] });
      createDiscussion(db, { project_id: projectId, topic: 'D2', created_by: member1Id, participant_ids: [member3.id] });

      const result = listDiscussions(db, { project_id: projectId, participant_id: member2Id });
      expect(result.length).toBe(1);
      expect(result[0].topic).toBe('D1');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npx vitest run tests/tools/discussions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement discussions.ts**

```typescript
import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired, notFound } from '../validation.js';
import { ERROR_CODES } from '../constants.js';

export function createDiscussion(db: Database.Database, input: {
  project_id: string; topic: string; created_by: string; participant_ids: string[];
}) {
  const projErr = validateRequired(input.project_id, 'project_id');
  if (projErr) return projErr;
  const topicErr = validateRequired(input.topic, 'topic');
  if (topicErr) return topicErr;
  const creatorErr = validateRequired(input.created_by, 'created_by');
  if (creatorErr) return creatorErr;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const insertDiscussion = db.transaction(() => {
    db.prepare(
      'INSERT INTO discussions (id, project_id, topic, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, input.project_id, input.topic, input.created_by, now, now);

    // Add creator as participant
    db.prepare(
      'INSERT INTO discussion_participants (discussion_id, member_id, joined_at) VALUES (?, ?, ?)'
    ).run(id, input.created_by, now);

    // Add additional participants
    const allIds = new Set(input.participant_ids);
    allIds.delete(input.created_by); // Avoid duplicate
    for (const memberId of allIds) {
      db.prepare(
        'INSERT INTO discussion_participants (discussion_id, member_id, joined_at) VALUES (?, ?, ?)'
      ).run(id, memberId, now);
    }
  });

  insertDiscussion();
  return { id, project_id: input.project_id, topic: input.topic, created_at: now };
}

export function addDiscussionParticipant(db: Database.Database, input: { discussion_id: string; member_id: string }) {
  const discErr = validateRequired(input.discussion_id, 'discussion_id');
  if (discErr) return discErr;
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;

  const disc = db.prepare('SELECT id FROM discussions WHERE id = ?').get(input.discussion_id);
  if (!disc) return notFound('Discussion', input.discussion_id);

  const now = new Date().toISOString();
  db.prepare(
    'INSERT OR IGNORE INTO discussion_participants (discussion_id, member_id, joined_at) VALUES (?, ?, ?)'
  ).run(input.discussion_id, input.member_id, now);

  return { discussion_id: input.discussion_id, member_id: input.member_id, joined_at: now };
}

export function addDiscussionMessage(db: Database.Database, input: { discussion_id: string; member_id: string; content: string }) {
  const discErr = validateRequired(input.discussion_id, 'discussion_id');
  if (discErr) return discErr;
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;
  const contentErr = validateRequired(input.content, 'content');
  if (contentErr) return contentErr;

  // Verify participant membership
  const participant = db.prepare(
    'SELECT member_id FROM discussion_participants WHERE discussion_id = ? AND member_id = ?'
  ).get(input.discussion_id, input.member_id);
  if (!participant) {
    return { error: `Member ${input.member_id} is not a participant of discussion ${input.discussion_id}`, code: ERROR_CODES.INVALID_INPUT };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO discussion_messages (id, discussion_id, member_id, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.discussion_id, input.member_id, input.content, now);

  db.prepare('UPDATE discussions SET updated_at = ? WHERE id = ?').run(now, input.discussion_id);

  return { id, discussion_id: input.discussion_id, member_id: input.member_id, created_at: now };
}

export function updateDiscussionSummary(db: Database.Database, input: { discussion_id: string; summary: string }) {
  const discErr = validateRequired(input.discussion_id, 'discussion_id');
  if (discErr) return discErr;
  const summaryErr = validateRequired(input.summary, 'summary');
  if (summaryErr) return summaryErr;

  const disc = db.prepare('SELECT id FROM discussions WHERE id = ?').get(input.discussion_id);
  if (!disc) return notFound('Discussion', input.discussion_id);

  const now = new Date().toISOString();
  db.prepare('UPDATE discussions SET summary = ?, updated_at = ? WHERE id = ?').run(input.summary, now, input.discussion_id);

  return { discussion_id: input.discussion_id, updated_at: now };
}

export function getDiscussion(db: Database.Database, input: { discussion_id: string }) {
  const err = validateRequired(input.discussion_id, 'discussion_id');
  if (err) return err;

  const disc = db.prepare('SELECT * FROM discussions WHERE id = ?').get(input.discussion_id) as any;
  if (!disc) return notFound('Discussion', input.discussion_id);

  const participants = db.prepare(
    'SELECT member_id, joined_at FROM discussion_participants WHERE discussion_id = ? ORDER BY joined_at'
  ).all(input.discussion_id);

  const messages = db.prepare(
    'SELECT id, member_id, content, created_at FROM discussion_messages WHERE discussion_id = ? ORDER BY created_at'
  ).all(input.discussion_id);

  return {
    id: disc.id, topic: disc.topic, summary: disc.summary, created_by: disc.created_by,
    participants, messages, created_at: disc.created_at, updated_at: disc.updated_at,
  };
}

export function listDiscussions(db: Database.Database, input: { project_id: string; participant_id?: string }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  if (input.participant_id) {
    return db.prepare(
      `SELECT d.id, d.topic, d.created_by, d.created_at, d.updated_at
       FROM discussions d
       JOIN discussion_participants dp ON d.id = dp.discussion_id
       WHERE d.project_id = ? AND dp.member_id = ?
       ORDER BY d.updated_at DESC`
    ).all(input.project_id, input.participant_id);
  }
  return db.prepare(
    'SELECT id, topic, created_by, created_at, updated_at FROM discussions WHERE project_id = ? ORDER BY updated_at DESC'
  ).all(input.project_id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run tests/tools/discussions.test.ts`
Expected: PASS — all 7 tests

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/discussions.ts mcp-server/tests/tools/discussions.test.ts
git commit -m "feat: add discussions tools (create, add_participant, add_message, update_summary, get, list)"
```

---

## Task 11: Decisions Tools

**Files:**
- Create: `mcp-server/src/tools/decisions.ts`
- Create: `mcp-server/tests/tools/decisions.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember } from '../../src/tools/team-members.js';
import { logDecision, listDecisions, getDecision } from '../../src/tools/decisions.js';

describe('Decisions Tools', () => {
  let db: Database.Database;
  let projectId: string;
  let memberId: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
    const member = addTeamMember(db, { project_id: projectId, role: 'project_manager' });
    memberId = member.id;
  });
  afterEach(() => { db.close(); });

  describe('log_decision', () => {
    it('records a decision with rationale', () => {
      const result = logDecision(db, {
        project_id: projectId, member_id: memberId,
        title: 'Use REST over GraphQL',
        rationale: 'Simpler for our use case',
        context: 'Considered GraphQL but team has more REST experience',
      });
      expect(result.title).toBe('Use REST over GraphQL');
    });

    it('allows optional context', () => {
      const result = logDecision(db, {
        project_id: projectId, member_id: memberId,
        title: 'Use TypeScript', rationale: 'Type safety',
      });
      expect(result.title).toBe('Use TypeScript');
    });
  });

  describe('list_decisions', () => {
    it('lists all decisions for a project', () => {
      logDecision(db, { project_id: projectId, member_id: memberId, title: 'D1', rationale: 'R1' });
      logDecision(db, { project_id: projectId, member_id: memberId, title: 'D2', rationale: 'R2' });
      const result = listDecisions(db, { project_id: projectId });
      expect(result.length).toBe(2);
    });
  });

  describe('get_decision', () => {
    it('returns full decision details', () => {
      const dec = logDecision(db, {
        project_id: projectId, member_id: memberId,
        title: 'Use REST', rationale: 'Simplicity', context: 'Considered GraphQL',
      });
      const result = getDecision(db, { decision_id: dec.id });
      expect(result.rationale).toBe('Simplicity');
      expect(result.context).toBe('Considered GraphQL');
    });

    it('returns NOT_FOUND for missing decision', () => {
      const result = getDecision(db, { decision_id: 'nonexistent' });
      expect(result.code).toBe('NOT_FOUND');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npx vitest run tests/tools/decisions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement decisions.ts**

```typescript
import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired, notFound } from '../validation.js';

export function logDecision(db: Database.Database, input: {
  project_id: string; member_id: string; title: string; rationale: string; context?: string;
}) {
  const projErr = validateRequired(input.project_id, 'project_id');
  if (projErr) return projErr;
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;
  const titleErr = validateRequired(input.title, 'title');
  if (titleErr) return titleErr;
  const ratErr = validateRequired(input.rationale, 'rationale');
  if (ratErr) return ratErr;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO decisions (id, project_id, member_id, title, rationale, context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.project_id, input.member_id, input.title, input.rationale, input.context ?? null, now);

  return { id, project_id: input.project_id, title: input.title, created_at: now };
}

export function listDecisions(db: Database.Database, input: { project_id: string }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  return db.prepare(
    'SELECT id, title, member_id, created_at FROM decisions WHERE project_id = ? ORDER BY created_at DESC'
  ).all(input.project_id);
}

export function getDecision(db: Database.Database, input: { decision_id: string }) {
  const err = validateRequired(input.decision_id, 'decision_id');
  if (err) return err;

  const row = db.prepare('SELECT * FROM decisions WHERE id = ?').get(input.decision_id) as any;
  if (!row) return notFound('Decision', input.decision_id);

  return { id: row.id, project_id: row.project_id, member_id: row.member_id, title: row.title, rationale: row.rationale, context: row.context, created_at: row.created_at };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run tests/tools/decisions.test.ts`
Expected: PASS — all 5 tests

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/decisions.ts mcp-server/tests/tools/decisions.test.ts
git commit -m "feat: add decisions tools (log, list, get)"
```

---

## Task 12: Shared Artifacts Tools

**Files:**
- Create: `mcp-server/src/tools/artifacts.ts`
- Create: `mcp-server/tests/tools/artifacts.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember } from '../../src/tools/team-members.js';
import { shareArtifact, updateArtifact, listArtifacts, getArtifact } from '../../src/tools/artifacts.js';

describe('Artifacts Tools', () => {
  let db: Database.Database;
  let projectId: string;
  let memberId: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
    const member = addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
    memberId = member.id;
  });
  afterEach(() => { db.close(); });

  describe('share_artifact', () => {
    it('creates a shared artifact', () => {
      const result = shareArtifact(db, {
        project_id: projectId, member_id: memberId,
        title: 'User API Spec', artifact_type: 'api_spec',
        content: 'GET /users - returns list of users',
      });
      expect(result.title).toBe('User API Spec');
      expect(result.artifact_type).toBe('api_spec');
    });
  });

  describe('update_artifact', () => {
    it('updates content', () => {
      const art = shareArtifact(db, {
        project_id: projectId, member_id: memberId,
        title: 'Spec', artifact_type: 'api_spec', content: 'V1',
      });
      const result = updateArtifact(db, { artifact_id: art.id, content: 'V2' });
      expect(result.updated_at).toBeTruthy();

      const full = getArtifact(db, { artifact_id: art.id });
      expect(full.content).toBe('V2');
    });

    it('updates title optionally', () => {
      const art = shareArtifact(db, {
        project_id: projectId, member_id: memberId,
        title: 'Old Title', artifact_type: 'api_spec', content: 'Content',
      });
      updateArtifact(db, { artifact_id: art.id, content: 'Content', title: 'New Title' });
      const full = getArtifact(db, { artifact_id: art.id });
      expect(full.title).toBe('New Title');
    });
  });

  describe('list_artifacts', () => {
    it('lists all artifacts for a project', () => {
      shareArtifact(db, { project_id: projectId, member_id: memberId, title: 'A1', artifact_type: 'api_spec', content: 'C1' });
      shareArtifact(db, { project_id: projectId, member_id: memberId, title: 'A2', artifact_type: 'test_plan', content: 'C2' });
      const result = listArtifacts(db, { project_id: projectId });
      expect(result.length).toBe(2);
    });

    it('filters by artifact_type', () => {
      shareArtifact(db, { project_id: projectId, member_id: memberId, title: 'A1', artifact_type: 'api_spec', content: 'C1' });
      shareArtifact(db, { project_id: projectId, member_id: memberId, title: 'A2', artifact_type: 'test_plan', content: 'C2' });
      const result = listArtifacts(db, { project_id: projectId, artifact_type: 'api_spec' });
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('A1');
    });
  });

  describe('get_artifact', () => {
    it('returns full artifact details', () => {
      const art = shareArtifact(db, {
        project_id: projectId, member_id: memberId,
        title: 'Spec', artifact_type: 'api_spec', content: 'Full content here',
      });
      const result = getArtifact(db, { artifact_id: art.id });
      expect(result.content).toBe('Full content here');
      expect(result.member_id).toBe(memberId);
    });

    it('returns NOT_FOUND for missing artifact', () => {
      const result = getArtifact(db, { artifact_id: 'nonexistent' });
      expect(result.code).toBe('NOT_FOUND');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npx vitest run tests/tools/artifacts.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement artifacts.ts**

```typescript
import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired, notFound } from '../validation.js';

export function shareArtifact(db: Database.Database, input: {
  project_id: string; member_id: string; title: string; artifact_type: string; content: string;
}) {
  const projErr = validateRequired(input.project_id, 'project_id');
  if (projErr) return projErr;
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;
  const titleErr = validateRequired(input.title, 'title');
  if (titleErr) return titleErr;
  const typeErr = validateRequired(input.artifact_type, 'artifact_type');
  if (typeErr) return typeErr;
  const contentErr = validateRequired(input.content, 'content');
  if (contentErr) return contentErr;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO shared_artifacts (id, project_id, member_id, title, artifact_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.project_id, input.member_id, input.title, input.artifact_type, input.content, now, now);

  return { id, project_id: input.project_id, title: input.title, artifact_type: input.artifact_type, created_at: now };
}

export function updateArtifact(db: Database.Database, input: { artifact_id: string; content: string; title?: string }) {
  const idErr = validateRequired(input.artifact_id, 'artifact_id');
  if (idErr) return idErr;
  const contentErr = validateRequired(input.content, 'content');
  if (contentErr) return contentErr;

  const artifact = db.prepare('SELECT * FROM shared_artifacts WHERE id = ?').get(input.artifact_id) as any;
  if (!artifact) return notFound('Artifact', input.artifact_id);

  const now = new Date().toISOString();
  const title = input.title ?? artifact.title;

  db.prepare(
    'UPDATE shared_artifacts SET content = ?, title = ?, updated_at = ? WHERE id = ?'
  ).run(input.content, title, now, input.artifact_id);

  return { id: input.artifact_id, title, updated_at: now };
}

export function listArtifacts(db: Database.Database, input: { project_id: string; artifact_type?: string }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  if (input.artifact_type) {
    return db.prepare(
      'SELECT id, title, artifact_type, member_id, created_at, updated_at FROM shared_artifacts WHERE project_id = ? AND artifact_type = ? ORDER BY created_at DESC'
    ).all(input.project_id, input.artifact_type);
  }
  return db.prepare(
    'SELECT id, title, artifact_type, member_id, created_at, updated_at FROM shared_artifacts WHERE project_id = ? ORDER BY created_at DESC'
  ).all(input.project_id);
}

export function getArtifact(db: Database.Database, input: { artifact_id: string }) {
  const err = validateRequired(input.artifact_id, 'artifact_id');
  if (err) return err;

  const row = db.prepare('SELECT * FROM shared_artifacts WHERE id = ?').get(input.artifact_id) as any;
  if (!row) return notFound('Artifact', input.artifact_id);

  return { id: row.id, project_id: row.project_id, member_id: row.member_id, title: row.title, artifact_type: row.artifact_type, content: row.content, created_at: row.created_at, updated_at: row.updated_at };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run tests/tools/artifacts.test.ts`
Expected: PASS — all 6 tests

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools/artifacts.ts mcp-server/tests/tools/artifacts.test.ts
git commit -m "feat: add shared artifacts tools (share, update, list, get)"
```

---

## Task 13: MCP Server Entry Point

**Files:**
- Create: `mcp-server/src/index.ts`

This task wires all 35 tools to the MCP server. No tests — this is integration glue verified by building and running.

- [ ] **Step 1: Create index.ts**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getDb } from './db/connection.js';

// Tool imports
import { createProject, getProject, updateProjectStatus, listProjects } from './tools/projects.js';
import { getProjectSummary, updateProjectSummary, getSummaryVersion, listSummaryHistory } from './tools/summaries.js';
import { addTeamMember, removeTeamMember, listTeamMembers } from './tools/team-members.js';
import { createTask, updateTask, getTask, listTasks } from './tools/tasks.js';
import { logWork, getMyWork, getWorkHistory } from './tools/work-entries.js';
import { addTaskComment, listTaskComments, listMyComments } from './tools/task-comments.js';
import { createDiscussion, addDiscussionParticipant, addDiscussionMessage, updateDiscussionSummary, getDiscussion, listDiscussions } from './tools/discussions.js';
import { logDecision, listDecisions, getDecision } from './tools/decisions.js';
import { shareArtifact, updateArtifact, listArtifacts, getArtifact } from './tools/artifacts.js';

const db = getDb();

const server = new McpServer({
  name: 'agent-team',
  version: '1.0.0',
});

// --- Projects ---
server.tool('create_project', 'Create a new project', { name: z.string(), description: z.string() }, async (input) => {
  const result = createProject(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('get_project', 'Get project details by ID', { project_id: z.string() }, async (input) => {
  const result = getProject(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('update_project_status', 'Update project status', { project_id: z.string(), status: z.string() }, async (input) => {
  const result = updateProjectStatus(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('list_projects', 'List all projects, optionally filtered by status', { status: z.string().optional() }, async (input) => {
  const result = listProjects(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

// --- Summaries ---
server.tool('get_project_summary', 'Get latest project summary', { project_id: z.string() }, async (input) => {
  const result = getProjectSummary(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('update_project_summary', 'Update the project summary (creates new version)', { project_id: z.string(), content: z.string() }, async (input) => {
  const result = updateProjectSummary(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('get_summary_version', 'Get a specific historical summary version', { summary_id: z.string() }, async (input) => {
  const result = getSummaryVersion(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('list_summary_history', 'List all summary versions for a project', { project_id: z.string() }, async (input) => {
  const result = listSummaryHistory(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

// --- Team Members ---
server.tool('add_team_member', 'Add a team member to a project', { project_id: z.string(), role: z.string() }, async (input) => {
  const result = addTeamMember(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('remove_team_member', 'Remove a team member from a project', { member_id: z.string() }, async (input) => {
  const result = removeTeamMember(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('list_team_members', 'List team members on a project', { project_id: z.string(), active_only: z.boolean().optional() }, async (input) => {
  const result = listTeamMembers(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

// --- Tasks ---
server.tool('create_task', 'Create a task in a project', { project_id: z.string(), title: z.string(), description: z.string(), assignee_id: z.string().optional() }, async (input) => {
  const result = createTask(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('update_task', 'Update a task', { task_id: z.string(), status: z.string().optional(), description: z.string().optional(), assignee_id: z.string().optional() }, async (input) => {
  const result = updateTask(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('get_task', 'Get task details', { task_id: z.string() }, async (input) => {
  const result = getTask(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('list_tasks', 'List tasks in a project', { project_id: z.string(), assignee_id: z.string().optional(), status: z.string().optional() }, async (input) => {
  const result = listTasks(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

// --- Work Entries ---
server.tool('log_work', 'Log a private work entry against a task', { task_id: z.string(), member_id: z.string(), entry_type: z.string(), content: z.string() }, async (input) => {
  const result = logWork(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('get_my_work', 'Get your own work entries', { member_id: z.string(), task_id: z.string().optional() }, async (input) => {
  const result = getMyWork(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('get_work_history', 'Get full work history for a member on a project', { member_id: z.string(), project_id: z.string() }, async (input) => {
  const result = getWorkHistory(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

// --- Task Comments ---
server.tool('add_task_comment', 'Add a comment to a task', { task_id: z.string(), member_id: z.string(), content: z.string() }, async (input) => {
  const result = addTaskComment(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('list_task_comments', 'List all comments on a task', { task_id: z.string() }, async (input) => {
  const result = listTaskComments(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('list_my_comments', 'List your comments across a project', { member_id: z.string(), project_id: z.string() }, async (input) => {
  const result = listMyComments(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

// --- Discussions ---
server.tool('create_discussion', 'Create a discussion thread', { project_id: z.string(), topic: z.string(), created_by: z.string(), participant_ids: z.array(z.string()) }, async (input) => {
  const result = createDiscussion(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('add_discussion_participant', 'Add a participant to an existing discussion', { discussion_id: z.string(), member_id: z.string() }, async (input) => {
  const result = addDiscussionParticipant(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('add_discussion_message', 'Post a message to a discussion (must be participant)', { discussion_id: z.string(), member_id: z.string(), content: z.string() }, async (input) => {
  const result = addDiscussionMessage(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('update_discussion_summary', 'Update the summary of a discussion', { discussion_id: z.string(), summary: z.string() }, async (input) => {
  const result = updateDiscussionSummary(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('get_discussion', 'Get full discussion with participants and messages', { discussion_id: z.string() }, async (input) => {
  const result = getDiscussion(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('list_discussions', 'List discussions in a project', { project_id: z.string(), participant_id: z.string().optional() }, async (input) => {
  const result = listDiscussions(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

// --- Decisions ---
server.tool('log_decision', 'Record a key decision with rationale', { project_id: z.string(), member_id: z.string(), title: z.string(), rationale: z.string(), context: z.string().optional() }, async (input) => {
  const result = logDecision(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('list_decisions', 'List all decisions for a project', { project_id: z.string() }, async (input) => {
  const result = listDecisions(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('get_decision', 'Get full decision details', { decision_id: z.string() }, async (input) => {
  const result = getDecision(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

// --- Shared Artifacts ---
server.tool('share_artifact', 'Share a deliverable with the team', { project_id: z.string(), member_id: z.string(), title: z.string(), artifact_type: z.string(), content: z.string() }, async (input) => {
  const result = shareArtifact(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('update_artifact', 'Update a shared artifact', { artifact_id: z.string(), content: z.string(), title: z.string().optional() }, async (input) => {
  const result = updateArtifact(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('list_artifacts', 'List shared artifacts for a project', { project_id: z.string(), artifact_type: z.string().optional() }, async (input) => {
  const result = listArtifacts(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

server.tool('get_artifact', 'Get full artifact details', { artifact_id: z.string() }, async (input) => {
  const result = getArtifact(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

// --- Start Server ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

Note: The MCP SDK uses `zod` for schema validation. Add `zod` to dependencies:

```bash
cd mcp-server && npm install zod
```

- [ ] **Step 2: Build the server**

Run: `cd mcp-server && npx tsc`
Expected: No compilation errors

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/index.ts mcp-server/package.json mcp-server/package-lock.json
git commit -m "feat: add MCP server entry point with all 35 tools registered"
```

---

## Task 14: Full Test Suite and Build Verification

**Files:** None new — verification only

- [ ] **Step 1: Run full test suite**

Run: `cd mcp-server && npx vitest run`
Expected: All tests pass (50+ tests across 9 test files)

- [ ] **Step 2: Clean build**

Run: `cd mcp-server && rm -rf dist && npx tsc`
Expected: `dist/` created with compiled JS files, no errors

- [ ] **Step 3: Verify server starts**

Run: `cd mcp-server && echo '{}' | timeout 3 node dist/index.js || true`
Expected: Server starts without crash (will timeout since it waits for MCP messages — that's expected)

- [ ] **Step 4: Commit any fixes if needed, tag release**

```bash
git tag -a v1.0.0 -m "AgentTeam MCP server v1.0.0 - 35 tools, SQLite-backed"
```

---

## Task 15: Agent Definition Files

**Files:**
- Create: all 13 files in `agents/`

Each agent file follows the 3-layer template from the spec. The role identity is drawn from `docs/software_development_team_guide.md`.

- [ ] **Step 1: Create agents/project-manager.md**

The PM gets the full orchestration layer plus the shared team protocol. Write the complete prompt per the spec: Role Identity (from guide) + Team Protocol + Role-Specific Constraints + PM Orchestration Layer.

- [ ] **Step 2: Create the remaining 12 agent files**

Each follows the same template: Role Identity + Team Protocol + Role-Specific Constraints. Files to create:
- `agents/product-manager.md`
- `agents/ux-ui-designer.md`
- `agents/ux-researcher.md`
- `agents/frontend-developer.md`
- `agents/backend-developer.md`
- `agents/full-stack-developer.md`
- `agents/mobile-developer.md`
- `agents/devops-engineer.md`
- `agents/qa-engineer.md`
- `agents/security-engineer.md`
- `agents/data-engineer.md`
- `agents/data-scientist.md`

- [ ] **Step 3: Commit**

```bash
git add agents/
git commit -m "feat: add 13 agent definition files with role identity, team protocol, and constraints"
```

- [ ] **Step 4: Tag final release**

```bash
git tag -a v1.0.0 -m "AgentTeam v1.0.0 - MCP server with 35 tools and 13 agent definitions"
git push origin main --tags
```
