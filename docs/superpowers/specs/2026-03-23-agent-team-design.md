# AgentTeam Design Spec

A reusable AI software development team that can be called from any project via MCP. The team consists of 13 specialized agents orchestrated by a Project Manager, with SQLite-backed persistence for project isolation and cross-session memory.

---

## Architecture Overview

**Option A — MCP as Data Layer Only**

The MCP server owns the SQLite database and exposes tools for reading/writing project state. Agent orchestration happens in the calling Claude Code environment. The PM agent receives a request, creates a project, recruits specialists, and delegates tasks. Each agent calls MCP tools to interact with their data.

```
Calling Project (Claude Code)
    └── PM Agent (subagent)
        ├── calls MCP tools to create project, summary, tasks
        ├── spawns specialist agents as needed
        │   ├── Backend Developer (subagent)
        │   │   └── calls MCP tools to read summary, log work, comment on tasks
        │   ├── QA Engineer (subagent)
        │   │   └── calls MCP tools to read summary, log work, share artifacts
        │   └── ... other specialists
        └── updates project summary as work progresses

MCP Server (TypeScript/Node.js)
    └── SQLite Database (~/.agent-team/team.db)
```

### Trust Model

All agents share the same MCP server with no authentication layer. Work entry privacy is enforced by convention — agents follow their prompts and only query their own data. The MCP layer does not enforce role-based access control. This is an accepted trade-off for simplicity; agents are trusted to follow their role constraints.

### Concurrency

When the PM spawns multiple specialist agents as subagents, they may execute concurrently and hit the SQLite database simultaneously. The MCP server must enable **WAL (Write-Ahead Logging) mode** on the SQLite connection to support concurrent reads and minimize write contention. Agents may run in parallel.

---

## Database Schema

### Migration Strategy

The database uses a `schema_version` table with a single integer version number. On startup, the MCP server checks the current version and applies any pending migrations sequentially. For v1, the schema is created fresh if the database does not exist. Future versions add migration functions keyed to version numbers.

### Tables

**`schema_version`**
| Column | Type | Notes |
|---|---|---|
| version | INTEGER | Current schema version |
| applied_at | DATETIME | When this version was applied |

**`projects`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| name | TEXT | Project name |
| description | TEXT | Brief description |
| status | TEXT | active, paused, archived, closed |
| created_at | DATETIME | Auto-set |
| updated_at | DATETIME | Auto-updated |

**Project lifecycle transitions:**
- `active` → `paused`, `archived`, `closed`
- `paused` → `active`, `archived`, `closed`
- `archived` → `active` (reopen)
- `closed` → no transitions (terminal state)

**`project_summaries`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| project_id | TEXT | FK → projects |
| content | TEXT | The living summary document |
| version | INTEGER | Auto-incremented on update |
| created_at | DATETIME | When this version was written |

One active summary per project. Updating creates a new version; old versions are preserved for history. Summaries accumulate unboundedly — this is an accepted trade-off for full traceability. A future retention policy can be added if storage becomes a concern.

**`team_members`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| project_id | TEXT | FK → projects |
| role | TEXT | One of the 13 defined roles |
| joined_at | DATETIME | When recruited to this project |
| removed_at | DATETIME | Null if still active |

**`tasks`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| project_id | TEXT | FK → projects |
| assignee_id | TEXT | FK → team_members, nullable (unassigned tasks allowed) |
| title | TEXT | Short description |
| description | TEXT | Full task details |
| status | TEXT | pending, in_progress, completed, blocked |
| created_at | DATETIME | Auto-set |
| updated_at | DATETIME | Auto-updated |

Tasks can be created unassigned and assigned later. Reassignment is supported via `update_task`.

**`work_entries`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| task_id | TEXT | FK → tasks |
| member_id | TEXT | FK → team_members |
| entry_type | TEXT | code, note, status_update |
| content | TEXT | The work entry content |
| created_at | DATETIME | Auto-set |

Private to the agent who wrote them. Queries filter by member_id to enforce isolation (see Trust Model above). Decisions are logged to the separate `decisions` table, not as work entries.

**`task_comments`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| task_id | TEXT | FK → tasks |
| member_id | TEXT | FK → team_members |
| content | TEXT | Comment text |
| created_at | DATETIME | Auto-set |

Visible to anyone on the project. Used for task-specific cross-agent communication.

**`discussions`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| project_id | TEXT | FK → projects |
| topic | TEXT | Discussion subject |
| summary | TEXT | Living summary of the discussion |
| created_by | TEXT | FK → team_members |
| created_at | DATETIME | Auto-set |
| updated_at | DATETIME | Auto-updated |

Replaces both meetings and direct messages. A meeting is a discussion with many participants. A DM is a discussion with two. Discussion summaries are overwritten in place (no versioning) — this is an accepted simplification; the full message history serves as the audit trail.

**`discussion_participants`**
| Column | Type | Notes |
|---|---|---|
| discussion_id | TEXT | FK → discussions |
| member_id | TEXT | FK → team_members |
| joined_at | DATETIME | When added to discussion |

Join table. Composite primary key on (discussion_id, member_id). Participants can be added after creation.

**`discussion_messages`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| discussion_id | TEXT | FK → discussions |
| member_id | TEXT | FK → team_members |
| content | TEXT | Message text |
| created_at | DATETIME | Auto-set |

**`decisions`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| project_id | TEXT | FK → projects |
| member_id | TEXT | FK → team_members (who logged it) |
| title | TEXT | Short decision name |
| rationale | TEXT | Why this decision was made |
| context | TEXT | What alternatives were considered |
| created_at | DATETIME | Auto-set |

First-class record of key decisions. Prevents decisions from getting buried in discussion threads.

**`shared_artifacts`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| project_id | TEXT | FK → projects |
| member_id | TEXT | FK → team_members (creator) |
| title | TEXT | Artifact name |
| artifact_type | TEXT | api_spec, data_model, test_plan, design_doc, etc. |
| content | TEXT | The artifact content |
| created_at | DATETIME | Auto-set |
| updated_at | DATETIME | Auto-updated |

Deliverables that one agent produces and others need to consume. Artifacts are mutable — the creator can update them as work evolves.

---

## Validation & Error Handling

### FK Constraints
SQLite foreign key enforcement is enabled (`PRAGMA foreign_keys = ON`). All FK references are validated on insert/update. Invalid references return an error with the constraint name.

### Input Validation
- `project.status` must be one of: `active`, `paused`, `archived`, `closed`
- `project.status` transitions are validated against the lifecycle state machine (see above)
- `team_members.role` must be one of the 13 defined roles
- `tasks.status` must be one of: `pending`, `in_progress`, `completed`, `blocked`
- `work_entries.entry_type` must be one of: `code`, `note`, `status_update`
- UUIDs are validated as non-empty strings
- Required text fields (name, title, content) are validated as non-empty

### Error Responses
All tools return a consistent error shape: `{ error: string, code: string }`. Codes include:
- `NOT_FOUND` — referenced entity does not exist
- `INVALID_INPUT` — validation failure (details in error message)
- `INVALID_TRANSITION` — project status change not allowed
- `CONSTRAINT_ERROR` — FK or uniqueness violation

---

## Agent Identity Flow

When the PM recruits a specialist to a project, the flow is:

1. PM calls `add_team_member` with the project ID and role → receives the `member_id` (UUID)
2. PM spawns the specialist subagent, passing it: the agent prompt, the `project_id`, and the `member_id`
3. The specialist uses its `member_id` for all MCP calls that require identity (logging work, posting comments, sending messages)

The `member_id` is the agent's identity within a project. An agent playing the same role on two different projects has two different `member_id` values. Identity is established at recruitment time and passed through the orchestration layer, not discovered at runtime.

---

## MCP Tool Surface (34 tools)

Naming convention: `list_*` for collections, `get_*` for single records, `create_*`/`add_*`/`log_*` for writes, `update_*` for mutations.

### Projects (4 tools)

**`create_project`**
- Input: `name` (string, required), `description` (string, required)
- Returns: `{ id, name, description, status, created_at }`

**`get_project`**
- Input: `project_id` (string, required)
- Returns: `{ id, name, description, status, created_at, updated_at }`

**`update_project_status`**
- Input: `project_id` (string, required), `status` (string, required)
- Returns: `{ id, status, updated_at }`
- Validates against lifecycle state machine

**`list_projects`**
- Input: `status` (string, optional — filter)
- Returns: `[{ id, name, status, created_at, updated_at }]`

### Project Summaries (3 tools)

**`get_project_summary`**
- Input: `project_id` (string, required)
- Returns: `{ id, project_id, content, version, created_at }` (latest version)

**`update_project_summary`**
- Input: `project_id` (string, required), `content` (string, required)
- Returns: `{ id, project_id, version, created_at }`
- Creates a new version row; previous versions preserved

**`list_summary_history`**
- Input: `project_id` (string, required)
- Returns: `[{ id, version, created_at }]` (content omitted for brevity; use `get_project_summary` with version)

### Team Members (3 tools)

**`add_team_member`**
- Input: `project_id` (string, required), `role` (string, required — must be one of 13 roles)
- Returns: `{ id, project_id, role, joined_at }`

**`remove_team_member`**
- Input: `member_id` (string, required)
- Returns: `{ id, removed_at }`
- Sets `removed_at` timestamp; does not delete the record

**`list_team_members`**
- Input: `project_id` (string, required), `active_only` (boolean, optional — default true)
- Returns: `[{ id, role, joined_at, removed_at }]`

### Tasks (4 tools)

**`create_task`**
- Input: `project_id` (string, required), `title` (string, required), `description` (string, required), `assignee_id` (string, optional)
- Returns: `{ id, project_id, assignee_id, title, status, created_at }`

**`update_task`**
- Input: `task_id` (string, required), `status` (string, optional), `description` (string, optional), `assignee_id` (string, optional)
- Returns: `{ id, status, assignee_id, updated_at }`
- Supports reassignment by passing a new `assignee_id`

**`get_task`**
- Input: `task_id` (string, required)
- Returns: `{ id, project_id, assignee_id, title, description, status, created_at, updated_at }`

**`list_tasks`**
- Input: `project_id` (string, required), `assignee_id` (string, optional), `status` (string, optional)
- Returns: `[{ id, title, assignee_id, status, created_at, updated_at }]`

### Work Entries (3 tools)

**`log_work`**
- Input: `task_id` (string, required), `member_id` (string, required), `entry_type` (string, required), `content` (string, required)
- Returns: `{ id, task_id, member_id, entry_type, created_at }`

**`get_my_work`**
- Input: `member_id` (string, required), `task_id` (string, optional — filter to specific task)
- Returns: `[{ id, task_id, entry_type, content, created_at }]`

**`get_work_history`**
- Input: `member_id` (string, required), `project_id` (string, required)
- Returns: `[{ id, task_id, entry_type, content, created_at }]`

### Task Comments (3 tools)

**`add_task_comment`**
- Input: `task_id` (string, required), `member_id` (string, required), `content` (string, required)
- Returns: `{ id, task_id, member_id, created_at }`

**`list_task_comments`**
- Input: `task_id` (string, required)
- Returns: `[{ id, member_id, content, created_at }]`

**`list_my_comments`**
- Input: `member_id` (string, required), `project_id` (string, required)
- Returns: `[{ id, task_id, content, created_at }]`

### Discussions (6 tools)

**`create_discussion`**
- Input: `project_id` (string, required), `topic` (string, required), `created_by` (string, required), `participant_ids` (string[], required)
- Returns: `{ id, project_id, topic, created_at }`
- Creator is automatically added as a participant

**`add_discussion_participant`**
- Input: `discussion_id` (string, required), `member_id` (string, required)
- Returns: `{ discussion_id, member_id, joined_at }`

**`add_discussion_message`**
- Input: `discussion_id` (string, required), `member_id` (string, required), `content` (string, required)
- Returns: `{ id, discussion_id, member_id, created_at }`

**`update_discussion_summary`**
- Input: `discussion_id` (string, required), `summary` (string, required)
- Returns: `{ discussion_id, updated_at }`

**`get_discussion`**
- Input: `discussion_id` (string, required)
- Returns: `{ id, topic, summary, created_by, participants: [], messages: [], created_at, updated_at }`

**`list_discussions`**
- Input: `project_id` (string, required), `participant_id` (string, optional — filter)
- Returns: `[{ id, topic, created_by, created_at, updated_at }]`

### Decisions (3 tools)

**`log_decision`**
- Input: `project_id` (string, required), `member_id` (string, required), `title` (string, required), `rationale` (string, required), `context` (string, optional)
- Returns: `{ id, project_id, title, created_at }`

**`list_decisions`**
- Input: `project_id` (string, required)
- Returns: `[{ id, title, member_id, created_at }]`

**`get_decision`**
- Input: `decision_id` (string, required)
- Returns: `{ id, project_id, member_id, title, rationale, context, created_at }`

### Shared Artifacts (4 tools)

**`share_artifact`**
- Input: `project_id` (string, required), `member_id` (string, required), `title` (string, required), `artifact_type` (string, required), `content` (string, required)
- Returns: `{ id, project_id, title, artifact_type, created_at }`

**`update_artifact`**
- Input: `artifact_id` (string, required), `content` (string, required), `title` (string, optional)
- Returns: `{ id, title, updated_at }`

**`list_artifacts`**
- Input: `project_id` (string, required), `artifact_type` (string, optional — filter)
- Returns: `[{ id, title, artifact_type, member_id, created_at, updated_at }]`

**`get_artifact`**
- Input: `artifact_id` (string, required)
- Returns: `{ id, project_id, member_id, title, artifact_type, content, created_at, updated_at }`

---

## Agent Definitions

### File Structure

```
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

Role identity content for each agent is drawn from `docs/software_development_team_guide.md`.

### Prompt Structure (all agents)

Each agent prompt has three layers:

1. **Role Identity** — Who the agent is, drawn from `docs/software_development_team_guide.md`. Defines expertise, behaviors, and output formats.

2. **Team Protocol** — Shared across all agents:
   - You are a member of a software development team. Your identity on this project is your `member_id`.
   - When joining a project, call `get_project_summary` to read the current project state.
   - As you work, call `log_work` to record your progress, decisions, and code against your assigned tasks.
   - Use `add_task_comment` for task-specific communication visible to other team members.
   - Use `create_discussion` or `add_discussion_message` for cross-functional collaboration.
   - Check `list_decisions` for context on past choices that affect your domain.
   - Check `list_artifacts` for deliverables from other agents that you may need.
   - Stay in your lane — do not perform work outside your defined role.
   - When you complete a task, call `update_task` to set its status to `completed`.

3. **Role-Specific Constraints** — What the agent can and cannot do:
   - Only the PM can call `update_project_summary`
   - Only the PM can call `update_project_status`, `add_team_member`, or `remove_team_member`
   - Any agent can create discussions, log decisions, and share artifacts
   - Agents do not perform work outside their defined role

### PM Orchestration Layer

The Project Manager agent has an additional orchestration section:

- Create projects via `create_project` and receive the project UUID
- Write and maintain the project summary via `update_project_summary`
- Recruit team members via `add_team_member`, receiving their `member_id`
- Break work into tasks via `create_task` and assign to specialists
- Spawn specialist subagents, passing them their agent prompt, `project_id`, and `member_id`
- Create discussions via `create_discussion` when cross-functional alignment is needed
- Log key decisions via `log_decision`
- Update project status through its lifecycle via `update_project_status`
- Write a close-out summary when archiving or closing a project

### Roles (13 total)

| # | Role | File | Primary Responsibility |
|---|---|---|---|
| 1 | Project Manager / Scrum Master | project-manager.md | Orchestration, delivery, project summary |
| 2 | Product Manager | product-manager.md | Vision, strategy, roadmap, user stories |
| 3 | UX/UI Designer | ux-ui-designer.md | Interface design, user flows, accessibility |
| 4 | UX Researcher | ux-researcher.md | User research, personas, journey maps |
| 5 | Frontend Developer | frontend-developer.md | UI implementation, components, responsiveness |
| 6 | Backend Developer | backend-developer.md | APIs, data models, server-side logic |
| 7 | Full-Stack Developer | full-stack-developer.md | End-to-end feature implementation |
| 8 | Mobile Developer | mobile-developer.md | iOS/Android/cross-platform apps |
| 9 | DevOps / Platform Engineer | devops-engineer.md | Infrastructure, CI/CD, deployment |
| 10 | QA Engineer / SDET | qa-engineer.md | Test strategy, automation, quality |
| 11 | Security Engineer | security-engineer.md | Threat modeling, secure code, compliance |
| 12 | Data Engineer | data-engineer.md | Pipelines, warehousing, data quality |
| 13 | Data Scientist / ML Engineer | data-scientist.md | ML models, analysis, MLOps |

---

## MCP Server Structure

```
mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Server entry, registers all tools
│   ├── db/
│   │   ├── schema.ts         # Table definitions, migrations
│   │   └── connection.ts     # SQLite connection management (WAL mode)
│   └── tools/
│       ├── projects.ts       # create, get, update_status, list
│       ├── summaries.ts      # get, update, list_history
│       ├── team-members.ts   # add, remove, list
│       ├── tasks.ts          # create, update, get, list
│       ├── work-entries.ts   # log, get_my_work, get_history
│       ├── task-comments.ts  # add, list, list_mine
│       ├── discussions.ts    # create, add_participant, add_message, update_summary, get, list
│       ├── decisions.ts      # log, list, get
│       └── artifacts.ts      # share, update, list, get
```

- **Runtime:** Node.js with TypeScript
- **Database:** SQLite via `better-sqlite3` (WAL mode enabled)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Database location:** `~/.agent-team/team.db` (configurable via `AGENT_TEAM_DB_PATH` env var)
- **ID generation:** UUIDs via `crypto.randomUUID()`

### Connection from other projects

Add to any project's Claude Code MCP settings:

```json
{
  "mcpServers": {
    "agent-team": {
      "command": "node",
      "args": ["/path/to/AgentTeam/mcp-server/dist/index.js"]
    }
  }
}
```

---

## Key Design Decisions

1. **MCP as data layer only** — Orchestration stays in Claude Code. Simpler to build, easier to evolve. Upgrade path to full orchestration exists if needed.

2. **SQLite over filesystem** — Structured queries, project isolation via IDs, portable single file. Unlike AutoResearch projects that scatter JSON/JSONL/Markdown across directories.

3. **Discussions replace meetings + DMs** — Virtual agents don't need synchronous meetings. A discussion thread with participants and a summary covers both multi-party and 1:1 communication.

4. **Work entry isolation** — Each agent's work entries are private, filtered by member_id. Prevents context pollution between specialists while still allowing shared communication through task comments, discussions, and artifacts. Isolation is prompt-enforced, not access-controlled (see Trust Model).

5. **All 13 roles from day one** — Agent definitions are cheap (prompt files). The PM decides who to recruit per project, so unused agents have zero cost.

6. **Versioned project summaries** — The PM's living document is the primary shared context. Versioning preserves history so decisions can be traced.

7. **WAL mode for concurrency** — Multiple agents may run in parallel as subagents. WAL mode allows concurrent reads and serialized writes without blocking.

8. **Identity via member_id** — Agent identity is established at recruitment time and passed through the orchestration layer. No runtime discovery or session-level identity management.

---

## Inspiration

Architecture inspired by the AutoResearch family of projects (Sibyl, AutoResearchClaw) on GitHub, adapted for software development teams with a database-backed persistence layer instead of filesystem-based state management.
