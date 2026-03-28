# /team Skill & UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/team` skill for seamless invocation, plus MCP tools for user questions, team expansion requests, project deletion, and ad-hoc specialists.

**Architecture:** Seven new MCP tools added to the existing server (new tool files for user-questions, expansion-requests; extend projects). Two new DB tables added as migration V3. PM and base protocol prompts updated. A `/team` skill file orchestrates the full pipeline. A CLAUDE.md provides fallback instructions for non-Claude-Code clients.

**Tech Stack:** TypeScript, better-sqlite3, Vitest, MCP SDK, Claude Code skills (Markdown)

---

### Task 1: Database Migration V3 — user_questions and expansion_requests tables

**Files:**
- Modify: `mcp-server/src/db/schema.ts`

- [ ] **Step 1: Write the migration function**

Add `migrateToV3` to `schema.ts`. This creates two new tables and bumps the schema version.

```typescript
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
```

- [ ] **Step 2: Wire up the migration**

Update `CURRENT_VERSION` to `3` and add the call in `applyMigrations`:

```typescript
const CURRENT_VERSION = 3;
```

In `applyMigrations`:
```typescript
function applyMigrations(db: Database.Database, fromVersion: number): void {
  if (fromVersion < 1) migrateToV1(db);
  if (fromVersion < 2) migrateToV2(db);
  if (fromVersion < 3) migrateToV3(db);
}
```

- [ ] **Step 3: Verify the migration applies cleanly**

Run: `cd mcp-server && npm run build`
Expected: Clean compile, no errors.

- [ ] **Step 4: Commit**

```bash
git add mcp-server/src/db/schema.ts
git commit -m "feat: add V3 migration — user_questions and expansion_requests tables"
```

---

### Task 2: User Questions MCP Tools

**Files:**
- Create: `mcp-server/src/tools/user-questions.ts`
- Modify: `mcp-server/src/index.ts`

- [ ] **Step 1: Write the test file**

Create: `mcp-server/src/tools/__tests__/user-questions.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../../db/schema.js';
import { askUserQuestion, listUserQuestions, answerUserQuestion } from '../user-questions.js';

function setupDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);
  // seed a project and team member
  db.prepare("INSERT INTO projects (id, name, description) VALUES ('p1', 'Test', 'desc')").run();
  db.prepare("INSERT INTO team_members (id, project_id, role) VALUES ('m1', 'p1', 'backend_developer')").run();
  return db;
}

describe('askUserQuestion', () => {
  it('creates a pending question', () => {
    const db = setupDb();
    const result = askUserQuestion(db, { project_id: 'p1', member_id: 'm1', question: 'Which framework?', context: 'Choosing between Express and Fastify' });
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('status', 'pending');
    expect(result).toHaveProperty('question', 'Which framework?');
  });
});

describe('listUserQuestions', () => {
  it('filters by status', () => {
    const db = setupDb();
    askUserQuestion(db, { project_id: 'p1', member_id: 'm1', question: 'Q1' });
    askUserQuestion(db, { project_id: 'p1', member_id: 'm1', question: 'Q2' });
    const pending = listUserQuestions(db, { project_id: 'p1', status: 'pending' });
    expect(pending).toHaveLength(2);
    const answered = listUserQuestions(db, { project_id: 'p1', status: 'answered' });
    expect(answered).toHaveLength(0);
  });

  it('returns all when no status filter', () => {
    const db = setupDb();
    askUserQuestion(db, { project_id: 'p1', member_id: 'm1', question: 'Q1' });
    const all = listUserQuestions(db, { project_id: 'p1' });
    expect(all).toHaveLength(1);
  });
});

describe('answerUserQuestion', () => {
  it('sets answer and status to answered', () => {
    const db = setupDb();
    const q = askUserQuestion(db, { project_id: 'p1', member_id: 'm1', question: 'Q1' });
    const result = answerUserQuestion(db, { question_id: q.id, answer: 'Use Express' });
    expect(result).toHaveProperty('status', 'answered');
    expect(result).toHaveProperty('answer', 'Use Express');
    expect(result).toHaveProperty('answered_at');
  });

  it('returns not found for invalid id', () => {
    const db = setupDb();
    const result = answerUserQuestion(db, { question_id: 'nope', answer: 'test' });
    expect(result).toHaveProperty('error');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npx vitest run src/tools/__tests__/user-questions.test.ts`
Expected: FAIL — module `../user-questions.js` not found.

- [ ] **Step 3: Write the implementation**

Create `mcp-server/src/tools/user-questions.ts`:

```typescript
import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { validateRequired, notFound } from '../validation.js';

export function askUserQuestion(
  db: Database.Database,
  input: { project_id: string; member_id: string; question: string; context?: string }
) {
  const projErr = validateRequired(input.project_id, 'project_id');
  if (projErr) return projErr;
  const memErr = validateRequired(input.member_id, 'member_id');
  if (memErr) return memErr;
  const qErr = validateRequired(input.question, 'question');
  if (qErr) return qErr;

  const id = randomUUID();
  db.prepare(
    'INSERT INTO user_questions (id, project_id, member_id, question, context) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.project_id, input.member_id, input.question, input.context ?? null);

  return { id, project_id: input.project_id, member_id: input.member_id, question: input.question, context: input.context ?? null, status: 'pending' };
}

export function listUserQuestions(
  db: Database.Database,
  input: { project_id: string; status?: string }
) {
  const projErr = validateRequired(input.project_id, 'project_id');
  if (projErr) return projErr;

  if (input.status) {
    return db.prepare(
      'SELECT * FROM user_questions WHERE project_id = ? AND status = ? ORDER BY created_at ASC'
    ).all(input.project_id, input.status);
  }
  return db.prepare(
    'SELECT * FROM user_questions WHERE project_id = ? ORDER BY created_at ASC'
  ).all(input.project_id);
}

export function answerUserQuestion(
  db: Database.Database,
  input: { question_id: string; answer: string }
) {
  const idErr = validateRequired(input.question_id, 'question_id');
  if (idErr) return idErr;
  const ansErr = validateRequired(input.answer, 'answer');
  if (ansErr) return ansErr;

  const row = db.prepare('SELECT * FROM user_questions WHERE id = ?').get(input.question_id) as any;
  if (!row) return notFound('UserQuestion', input.question_id);

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE user_questions SET answer = ?, status = ?, answered_at = ? WHERE id = ?'
  ).run(input.answer, 'answered', now, input.question_id);

  return { id: input.question_id, status: 'answered', answer: input.answer, answered_at: now };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run src/tools/__tests__/user-questions.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Register tools in index.ts**

Add the import and three tool registrations to `mcp-server/src/index.ts`:

Import:
```typescript
import { askUserQuestion, listUserQuestions, answerUserQuestion } from './tools/user-questions.js';
```

Tool registrations (add after the User Journal section):
```typescript
// --- User Questions (3) ---

server.tool(
  'ask_user_question',
  'Log a question for the user. The orchestrating skill will surface it after dispatch. Include context about why this question matters or what is blocked.',
  {
    project_id: z.string(),
    member_id: z.string(),
    question: z.string(),
    context: z.string().optional(),
  },
  async (input) => {
    const result = askUserQuestion(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

server.tool(
  'list_user_questions',
  'List questions logged by specialists for the user. Filter by status (pending, answered) to find unanswered questions.',
  { project_id: z.string(), status: z.string().optional() },
  async (input) => {
    const result = listUserQuestions(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

server.tool(
  'answer_user_question',
  'Write the user\'s answer to a previously asked question',
  { question_id: z.string(), answer: z.string() },
  async (input) => {
    const result = answerUserQuestion(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);
```

- [ ] **Step 6: Build and verify**

Run: `cd mcp-server && npm run build`
Expected: Clean compile.

- [ ] **Step 7: Commit**

```bash
git add mcp-server/src/tools/user-questions.ts mcp-server/src/tools/__tests__/user-questions.test.ts mcp-server/src/index.ts
git commit -m "feat: add user questions MCP tools — ask, list, answer"
```

---

### Task 3: Expansion Requests MCP Tools

**Files:**
- Create: `mcp-server/src/tools/expansion-requests.ts`
- Modify: `mcp-server/src/index.ts`

- [ ] **Step 1: Write the test file**

Create: `mcp-server/src/tools/__tests__/expansion-requests.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../../db/schema.js';
import { requestTeamExpansion, listExpansionRequests, resolveExpansionRequest } from '../expansion-requests.js';

function setupDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);
  db.prepare("INSERT INTO projects (id, name, description) VALUES ('p1', 'Test', 'desc')").run();
  db.prepare("INSERT INTO team_members (id, project_id, role) VALUES ('m1', 'p1', 'backend_developer')").run();
  return db;
}

describe('requestTeamExpansion', () => {
  it('creates a pending expansion request', () => {
    const db = setupDb();
    const result = requestTeamExpansion(db, {
      project_id: 'p1',
      requested_by: 'm1',
      role_needed: 'data_engineer',
      justification: 'Database migration is more complex than expected',
    });
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('status', 'pending');
    expect(result).toHaveProperty('role_needed', 'data_engineer');
  });
});

describe('listExpansionRequests', () => {
  it('filters by status', () => {
    const db = setupDb();
    requestTeamExpansion(db, { project_id: 'p1', requested_by: 'm1', role_needed: 'data_engineer', justification: 'Need help' });
    const pending = listExpansionRequests(db, { project_id: 'p1', status: 'pending' });
    expect(pending).toHaveLength(1);
    const approved = listExpansionRequests(db, { project_id: 'p1', status: 'approved' });
    expect(approved).toHaveLength(0);
  });
});

describe('resolveExpansionRequest', () => {
  it('approves a request', () => {
    const db = setupDb();
    const req = requestTeamExpansion(db, { project_id: 'p1', requested_by: 'm1', role_needed: 'data_engineer', justification: 'Need help' });
    const result = resolveExpansionRequest(db, { request_id: req.id, status: 'approved', resolution_note: 'Good call' });
    expect(result).toHaveProperty('status', 'approved');
    expect(result).toHaveProperty('resolved_at');
  });

  it('denies a request', () => {
    const db = setupDb();
    const req = requestTeamExpansion(db, { project_id: 'p1', requested_by: 'm1', role_needed: 'data_engineer', justification: 'Need help' });
    const result = resolveExpansionRequest(db, { request_id: req.id, status: 'denied', resolution_note: 'Covered by existing scope' });
    expect(result).toHaveProperty('status', 'denied');
  });

  it('returns not found for invalid id', () => {
    const db = setupDb();
    const result = resolveExpansionRequest(db, { request_id: 'nope', status: 'approved' });
    expect(result).toHaveProperty('error');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npx vitest run src/tools/__tests__/expansion-requests.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `mcp-server/src/tools/expansion-requests.ts`:

```typescript
import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { validateRequired, notFound } from '../validation.js';

export function requestTeamExpansion(
  db: Database.Database,
  input: { project_id: string; requested_by: string; role_needed: string; justification: string }
) {
  const projErr = validateRequired(input.project_id, 'project_id');
  if (projErr) return projErr;
  const byErr = validateRequired(input.requested_by, 'requested_by');
  if (byErr) return byErr;
  const roleErr = validateRequired(input.role_needed, 'role_needed');
  if (roleErr) return roleErr;
  const justErr = validateRequired(input.justification, 'justification');
  if (justErr) return justErr;

  const id = randomUUID();
  db.prepare(
    'INSERT INTO expansion_requests (id, project_id, requested_by, role_needed, justification) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.project_id, input.requested_by, input.role_needed, input.justification);

  return { id, project_id: input.project_id, requested_by: input.requested_by, role_needed: input.role_needed, justification: input.justification, status: 'pending' };
}

export function listExpansionRequests(
  db: Database.Database,
  input: { project_id: string; status?: string }
) {
  const projErr = validateRequired(input.project_id, 'project_id');
  if (projErr) return projErr;

  if (input.status) {
    return db.prepare(
      'SELECT * FROM expansion_requests WHERE project_id = ? AND status = ? ORDER BY created_at ASC'
    ).all(input.project_id, input.status);
  }
  return db.prepare(
    'SELECT * FROM expansion_requests WHERE project_id = ? ORDER BY created_at ASC'
  ).all(input.project_id);
}

export function resolveExpansionRequest(
  db: Database.Database,
  input: { request_id: string; status: string; resolution_note?: string }
) {
  const idErr = validateRequired(input.request_id, 'request_id');
  if (idErr) return idErr;

  const row = db.prepare('SELECT * FROM expansion_requests WHERE id = ?').get(input.request_id) as any;
  if (!row) return notFound('ExpansionRequest', input.request_id);

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE expansion_requests SET status = ?, resolution_note = ?, resolved_at = ? WHERE id = ?'
  ).run(input.status, input.resolution_note ?? null, now, input.request_id);

  return { id: input.request_id, status: input.status, resolution_note: input.resolution_note ?? null, resolved_at: now };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run src/tools/__tests__/expansion-requests.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Register tools in index.ts**

Import:
```typescript
import { requestTeamExpansion, listExpansionRequests, resolveExpansionRequest } from './tools/expansion-requests.js';
```

Tool registrations:
```typescript
// --- Expansion Requests (3) ---

server.tool(
  'request_team_expansion',
  'Request additional team members when your assigned work grows beyond expected scope. The PM will evaluate and approve or deny.',
  {
    project_id: z.string(),
    requested_by: z.string(),
    role_needed: z.string(),
    justification: z.string(),
  },
  async (input) => {
    const result = requestTeamExpansion(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

server.tool(
  'list_expansion_requests',
  'List team expansion requests for a project, optionally filtered by status (pending, approved, denied)',
  { project_id: z.string(), status: z.string().optional() },
  async (input) => {
    const result = listExpansionRequests(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

server.tool(
  'resolve_expansion_request',
  'Approve or deny a team expansion request (PM only)',
  {
    request_id: z.string(),
    status: z.enum(['approved', 'denied']),
    resolution_note: z.string().optional(),
  },
  async (input) => {
    const result = resolveExpansionRequest(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);
```

- [ ] **Step 6: Build and verify**

Run: `cd mcp-server && npm run build`
Expected: Clean compile.

- [ ] **Step 7: Commit**

```bash
git add mcp-server/src/tools/expansion-requests.ts mcp-server/src/tools/__tests__/expansion-requests.test.ts mcp-server/src/index.ts
git commit -m "feat: add expansion requests MCP tools — request, list, resolve"
```

---

### Task 4: Delete Project MCP Tool (Cascading)

**Files:**
- Modify: `mcp-server/src/tools/projects.ts`
- Modify: `mcp-server/src/index.ts`

- [ ] **Step 1: Write the test**

Create: `mcp-server/src/tools/__tests__/delete-project.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../../db/schema.js';
import { createProject, deleteProject } from '../projects.js';

function setupDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);
  return db;
}

describe('deleteProject', () => {
  it('deletes a project and all associated records', () => {
    const db = setupDb();
    const project = createProject(db, { name: 'Test', description: 'desc' });
    const pid = project.id;

    // seed related records
    db.prepare("INSERT INTO team_members (id, project_id, role) VALUES ('m1', ?, 'backend_developer')").run(pid);
    db.prepare("INSERT INTO tasks (id, project_id, assignee_id, title, description) VALUES ('t1', ?, 'm1', 'Task', 'desc')").run(pid);
    db.prepare("INSERT INTO work_entries (id, task_id, member_id, entry_type, content) VALUES ('w1', 't1', 'm1', 'note', 'work')").run();
    db.prepare("INSERT INTO task_comments (id, task_id, member_id, content) VALUES ('c1', 't1', 'm1', 'comment')").run();
    db.prepare("INSERT INTO discussions (id, project_id, topic, created_by) VALUES ('d1', ?, 'topic', 'm1')").run(pid);
    db.prepare("INSERT INTO discussion_participants (discussion_id, member_id) VALUES ('d1', 'm1')").run();
    db.prepare("INSERT INTO discussion_messages (id, discussion_id, member_id, content) VALUES ('dm1', 'd1', 'm1', 'msg')").run();
    db.prepare("INSERT INTO decisions (id, project_id, member_id, title, rationale) VALUES ('dec1', ?, 'm1', 'Dec', 'Why')").run(pid);
    db.prepare("INSERT INTO shared_artifacts (id, project_id, member_id, title, artifact_type, content) VALUES ('a1', ?, 'm1', 'Art', 'research', '{}')").run(pid);
    db.prepare("INSERT INTO project_summaries (id, project_id, content, version) VALUES ('s1', ?, 'summary', 1)").run(pid);
    db.prepare("INSERT INTO user_journal (id, project_id, author, entry) VALUES ('j1', ?, 'pm', 'entry')").run(pid);
    db.prepare("INSERT INTO user_questions (id, project_id, member_id, question) VALUES ('q1', ?, 'm1', 'question')").run(pid);
    db.prepare("INSERT INTO expansion_requests (id, project_id, requested_by, role_needed, justification) VALUES ('e1', ?, 'm1', 'data_engineer', 'need help')").run(pid);

    const result = deleteProject(db, { project_id: pid });
    expect(result).toHaveProperty('deleted', true);
    expect(result.counts.projects).toBe(1);

    // verify everything is gone
    expect(db.prepare('SELECT * FROM projects WHERE id = ?').get(pid)).toBeUndefined();
    expect(db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(pid)).toHaveLength(0);
    expect(db.prepare('SELECT * FROM team_members WHERE project_id = ?').all(pid)).toHaveLength(0);
  });

  it('returns not found for invalid id', () => {
    const db = setupDb();
    const result = deleteProject(db, { project_id: 'nope' });
    expect(result).toHaveProperty('error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-server && npx vitest run src/tools/__tests__/delete-project.test.ts`
Expected: FAIL — `deleteProject` is not exported.

- [ ] **Step 3: Write the implementation**

Add to `mcp-server/src/tools/projects.ts`:

```typescript
export function deleteProject(db: Database.Database, input: { project_id: string }) {
  const idErr = validateRequired(input.project_id, 'project_id');
  if (idErr) return idErr;

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(input.project_id) as any;
  if (!project) return notFound('Project', input.project_id);

  const counts: Record<string, number> = {};

  const deleteInTransaction = db.transaction(() => {
    // Get task IDs and discussion IDs for this project
    const taskIds = (db.prepare('SELECT id FROM tasks WHERE project_id = ?').all(input.project_id) as any[]).map(r => r.id);
    const discIds = (db.prepare('SELECT id FROM discussions WHERE project_id = ?').all(input.project_id) as any[]).map(r => r.id);

    // Delete in dependency order
    for (const tid of taskIds) {
      counts.work_entries = (counts.work_entries ?? 0) + db.prepare('DELETE FROM work_entries WHERE task_id = ?').run(tid).changes;
      counts.task_comments = (counts.task_comments ?? 0) + db.prepare('DELETE FROM task_comments WHERE task_id = ?').run(tid).changes;
    }

    for (const did of discIds) {
      counts.discussion_messages = (counts.discussion_messages ?? 0) + db.prepare('DELETE FROM discussion_messages WHERE discussion_id = ?').run(did).changes;
      counts.discussion_participants = (counts.discussion_participants ?? 0) + db.prepare('DELETE FROM discussion_participants WHERE discussion_id = ?').run(did).changes;
    }

    counts.tasks = db.prepare('DELETE FROM tasks WHERE project_id = ?').run(input.project_id).changes;
    counts.discussions = db.prepare('DELETE FROM discussions WHERE project_id = ?').run(input.project_id).changes;
    counts.decisions = db.prepare('DELETE FROM decisions WHERE project_id = ?').run(input.project_id).changes;
    counts.shared_artifacts = db.prepare('DELETE FROM shared_artifacts WHERE project_id = ?').run(input.project_id).changes;
    counts.project_summaries = db.prepare('DELETE FROM project_summaries WHERE project_id = ?').run(input.project_id).changes;
    counts.user_journal = db.prepare('DELETE FROM user_journal WHERE project_id = ?').run(input.project_id).changes;
    counts.user_questions = db.prepare('DELETE FROM user_questions WHERE project_id = ?').run(input.project_id).changes;
    counts.expansion_requests = db.prepare('DELETE FROM expansion_requests WHERE project_id = ?').run(input.project_id).changes;
    counts.team_members = db.prepare('DELETE FROM team_members WHERE project_id = ?').run(input.project_id).changes;
    counts.projects = db.prepare('DELETE FROM projects WHERE id = ?').run(input.project_id).changes;
  });

  deleteInTransaction();

  return { deleted: true, project_id: input.project_id, name: project.name, counts };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run src/tools/__tests__/delete-project.test.ts`
Expected: All 2 tests PASS.

- [ ] **Step 5: Register tool in index.ts**

Update the import line:
```typescript
import { createProject, getProject, updateProjectStatus, listProjects, deleteProject } from './tools/projects.js';
```

Add tool registration:
```typescript
server.tool(
  'delete_project',
  'Permanently delete a project and ALL associated data (tasks, work entries, discussions, artifacts, etc.). This is irreversible.',
  { project_id: z.string() },
  async (input) => {
    const result = deleteProject(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);
```

- [ ] **Step 6: Build and verify**

Run: `cd mcp-server && npm run build`
Expected: Clean compile.

- [ ] **Step 7: Commit**

```bash
git add mcp-server/src/tools/projects.ts mcp-server/src/tools/__tests__/delete-project.test.ts mcp-server/src/index.ts
git commit -m "feat: add delete_project MCP tool with cascading delete"
```

---

### Task 5: Update Agent Prompts — Base Protocol and PM

**Files:**
- Modify: `agents/_base-protocol.md`
- Modify: `agents/project-manager.md`

- [ ] **Step 1: Update base protocol with new tools**

Add to `agents/_base-protocol.md`, after the existing bullet about `update_task`:

```markdown
- Use `ask_user_question` to log questions for the user when you need clarification. Include context about what is blocked. The orchestrating skill will surface your question — you do not need to wait for the answer.
- Use `request_team_expansion` if your assigned work grows beyond expected scope and you need additional specialists. The PM will evaluate your request.
```

- [ ] **Step 2: Update PM prompt — ad-hoc specialists in dispatch manifest**

In `agents/project-manager.md`, in the Dispatch Manifest section, update the JSON example to show both `agent_prompt_file` and `agent_prompt` options:

```json
[
  {
    "role": "backend_developer",
    "member_id": "<UUID from add_team_member>",
    "project_id": "<project UUID>",
    "agent_prompt_file": "/path/to/AgentTeam/agents/backend-developer.md",
    "tasks": [
      {
        "task_id": "<UUID from create_task>",
        "title": "Short task title",
        "description": "Full task description"
      }
    ],
    "context": "Any additional context this agent needs."
  },
  {
    "role": "graphql_specialist",
    "member_id": "<UUID from add_team_member>",
    "project_id": "<project UUID>",
    "agent_prompt": "You are an expert GraphQL API designer and developer. You design schemas, write resolvers, optimize queries, and implement federation patterns. Always prioritize type safety and efficient data fetching.",
    "tasks": [...],
    "context": "Ad-hoc specialist — no predefined agent file."
  }
]
```

Add this rule to the Rules section:
```markdown
- For predefined roles, use `agent_prompt_file`. For ad-hoc specialists not in the 13 predefined roles, use `agent_prompt` with an inline role identity prompt. Never include both — use one or the other.
- Ad-hoc specialist prompts should follow the same structure as predefined role files: a short Identity section describing expertise and behaviors. The base team protocol is loaded separately via `get_team_protocol`.
```

- [ ] **Step 3: Update PM prompt — expansion request handling**

Add to the PM's Orchestration section:

```markdown
- After specialists complete, check `list_expansion_requests` for pending requests. Evaluate each — approve via `resolve_expansion_request` if justified, deny with a note if not. For approved requests, include the new specialists in a supplemental dispatch manifest.
```

- [ ] **Step 4: Update PM constraints**

Add to the PM's Constraints section:

```markdown
- You are the ONLY agent that can call `resolve_expansion_request`.
```

- [ ] **Step 5: Commit**

```bash
git add agents/_base-protocol.md agents/project-manager.md
git commit -m "feat: update agent prompts for user questions, expansion requests, and ad-hoc specialists"
```

---

### Task 6: Create the /team Skill File

**Files:**
- Create: `agents/skills/team.md`

- [ ] **Step 1: Create the skills directory**

Run: `mkdir -p agents/skills`

- [ ] **Step 2: Write the skill file**

Create `agents/skills/team.md`:

```markdown
---
name: team
description: Spin up an AgentTeam — spawns the Project Manager, displays the dispatch manifest, and launches all specialists in parallel. Use /team <goal> for fast lane, /team for conversational, /team --review to pause before dispatch, /team --projects to manage projects.
user-invocable: true
---

# /team — AgentTeam Orchestrator

Parse the user's input to determine the mode:

## Mode Detection

1. If args start with `--projects` → **Project Management Mode**
2. If args contain `--review` → set REVIEW_MODE=true, strip the flag, remaining text is the goal
3. If args have text (after flag removal) → **Fast Lane Mode** with that text as the goal
4. If no args → **Conversational Mode** — ask: "What would you like the team to work on?"

---

## Project Management Mode (`--projects`)

Parse the subcommand after `--projects`:

- **No subcommand** → call `list_projects` via MCP, display grouped by status:

```
📁 Projects:

   Active
   • <id-prefix>  <name>     (<date>)

   Paused
   • <id-prefix>  <name>     (<date>)

   Archived
   • <id-prefix>  <name>     (<date>)
```

If empty: "No projects found."

- **`active` / `paused` / `archived` / `closed`** → call `list_projects` with status filter, display the same format but only the matching group.

- **`delete <name-or-id>`** → resolve the project:
  1. Call `list_projects` and match by name (case-insensitive substring) or UUID prefix
  2. If ambiguous, show matches and ask the user to clarify
  3. Call `get_project` for details
  4. Call `list_tasks` and `list_team_members` for counts
  5. Display confirmation:
  ```
  ⚠️  Delete "<project name>" and all associated data?
      (<N> tasks, <N> team members, ...)
      Type "yes" to confirm.
  ```
  6. On "yes", call `delete_project`. Display: "Deleted."
  7. On anything else: "Cancelled."

- **`archive` / `pause` / `resume` / `close` followed by `<name-or-id>`** → resolve the project, then call `update_project_status` with the appropriate status (`resume` maps to `active`). Display: "Updated <name> → <new status>."

**STOP after project management. Do not proceed to dispatch.**

---

## Dispatch Mode (Fast Lane or Conversational)

Once you have the goal text:

### Step 1: Spawn the Project Manager

Read the file `agents/project-manager.md` from the AgentTeam repository.

Spawn an agent with:
- **Prompt:** The contents of `agents/project-manager.md`
- **Task:** The user's goal text
- **Tools:** All `agent-team` MCP tools

Wait for the PM to complete.

### Step 2: Parse the Dispatch Manifest

Find the `## DISPATCH_MANIFEST` header in the PM's response. Extract the JSON array from the fenced code block immediately following it.

If no manifest is found, display the PM's response to the user and stop.

### Step 3: Display the Manifest

Format and display:

```
📋 Project: <project name>
   ID: <project_id>

👥 Team assembled:
   • <Role> — <N> tasks (<task titles>)
   • <Role> — <N> tasks (<task titles>)
   ...

Dispatching team. Ask for a review anytime by typing /team --review.
```

### Step 4: Review Gate (if --review)

If REVIEW_MODE is true:
- Display the manifest as above but replace the last line with: "Review the team above. Type 'go' to dispatch or describe changes."
- Wait for user input
- On "go" or similar affirmative → proceed to Step 5
- On other input → relay feedback to a new PM agent to adjust, then re-parse and re-display

### Step 5: Dispatch All Specialists

For each entry in the manifest, spawn an agent in parallel:

- If the entry has `agent_prompt_file`: read that file for the agent's prompt
- If the entry has `agent_prompt`: use the inline text as the agent's prompt
- Pass to each agent:
  - Their role identity prompt
  - `project_id` and `member_id`
  - Their assigned tasks (task_id, title, description)
  - The `context` field from the manifest
  - Instruction: "Call `get_team_protocol` first to load the shared team protocol."

Wait for all specialists to complete.

### Step 6: Handle User Questions

After all specialists finish:

1. Call `list_user_questions` with `project_id` and `status=pending`
2. If no pending questions, skip to Step 7
3. Display:

```
❓ Questions from your team:

   <Role>:
   "<question text>"
    Context: <context text>

   <Role>:
   "<question text>"
    Context: <context text>
```

4. Collect the user's answers for each question
5. Call `answer_user_question` for each with the user's response

### Step 7: Handle Expansion Requests

1. Call `list_expansion_requests` with `project_id` and `status=pending`
2. If no pending requests, skip to completion
3. Re-spawn the PM agent with context about the expansion requests
4. PM evaluates each request and calls `resolve_expansion_request` for each
5. PM returns a supplemental dispatch manifest for approved requests
6. Display:

```
🔄 Team expansion:
   • <Role> requested a <new role> — approved/denied
   ...
```

7. If approved expansions exist, dispatch the new specialists (repeat from Step 5 with the supplemental manifest)

### Completion

Display a brief summary of what was accomplished. Do not ask "is this okay?" or similar.
```

- [ ] **Step 3: Commit**

```bash
git add agents/skills/team.md
git commit -m "feat: add /team skill — full orchestration from goal to dispatch"
```

---

### Task 7: Create CLAUDE.md Fallback

**Files:**
- Create: `CLAUDE.md` (project root)

- [ ] **Step 1: Write the CLAUDE.md**

Create `/Users/rlemmon/Documents/workhg/AgentTeam/CLAUDE.md`:

```markdown
# AgentTeam — How to Use

When the user asks to spin up a team, build something with the team, or use AgentTeam:

1. Read `agents/project-manager.md` from this repository
2. Spawn the PM agent with the user's goal as the task
3. The PM will return a `## DISPATCH_MANIFEST` JSON block at the end of its response
4. For each entry in the manifest:
   - If `agent_prompt_file` is set: read that file for the agent's prompt
   - If `agent_prompt` is set: use the inline prompt (ad-hoc specialist)
   - Spawn the specialist with their `project_id`, `member_id`, and tasks
   - Tell each specialist to call `get_team_protocol` first to load the shared team protocol
5. Run specialists in parallel
6. After completion, call `list_user_questions` with `status=pending` — if any exist, present them to the user and write answers back via `answer_user_question`
7. Check `list_expansion_requests` with `status=pending` — if any exist, re-run the PM to evaluate and dispatch approved expansions
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md fallback instructions for non-Claude-Code clients"
```

---

### Task 8: Update README with New Features

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the MCP Tool Domains table**

Add the two new domains to the table in `README.md`:

```markdown
| User Questions | `ask_user_question`, `list_user_questions`, `answer_user_question` |
| Expansion Requests | `request_team_expansion`, `list_expansion_requests`, `resolve_expansion_request` |
```

Update the intro paragraph tool count from "37 MCP tools across 10 domains" to "44 MCP tools across 12 domains".

- [ ] **Step 2: Update the Example section**

Replace the existing Example section with:

```markdown
## Quick Start

**With the `/team` skill (Claude Code):**

```
/team build me a REST API for task management
```

**Without the skill:**

"Spin up the Project Manager and ask them to investigate [subject]"

**Manage projects:**

```
/team --projects              # list all projects
/team --projects active       # filter by status
/team --projects delete <name> # delete a project
```
```

- [ ] **Step 3: Add the Projects section to the existing Projects domain row**

Update the Projects row in the tool domain table:

```markdown
| Projects | `create_project`, `get_project`, `update_project_status`, `list_projects`, `delete_project` |
```

- [ ] **Step 4: Update the Getting Started section**

Add after the MCP config step:

```markdown
### 3. Install the /team skill (Claude Code only)

Add the skill path to your Claude Code settings or project `.claude/settings.json`:

```json
{
  "skills": [
    "/path/to/AgentTeam/agents/skills/team.md"
  ]
}
```

Then use `/team <goal>` to spin up a full team.
```

Renumber the old step 3 ("Invoke the Project Manager") to step 4 and label it "Alternative: Manual invocation".

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: update README with /team skill, new tools, and project management"
```

---

### Task 9: Build, Test, Tag, and Push

- [ ] **Step 1: Run full test suite**

Run: `cd mcp-server && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Build**

Run: `cd mcp-server && npm run build`
Expected: Clean compile.

- [ ] **Step 3: Push all commits**

Run: `git push origin main`

- [ ] **Step 4: Tag the release**

```bash
git tag -a v1.1.0 -m "v1.1.0 - /team skill, user questions, expansion requests, project deletion, ad-hoc specialists"
git push origin v1.1.0
```
