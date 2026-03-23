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

---

## Database Schema

### Tables

**`projects`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| name | TEXT | Project name |
| description | TEXT | Brief description |
| status | TEXT | active, paused, archived, closed |
| created_at | DATETIME | Auto-set |
| updated_at | DATETIME | Auto-updated |

**`project_summaries`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| project_id | TEXT | FK → projects |
| content | TEXT | The living summary document |
| version | INTEGER | Auto-incremented on update |
| created_at | DATETIME | When this version was written |

One active summary per project. Updating creates a new version; old versions are preserved for history.

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
| assignee_id | TEXT | FK → team_members |
| title | TEXT | Short description |
| description | TEXT | Full task details |
| status | TEXT | pending, in_progress, completed, blocked |
| created_at | DATETIME | Auto-set |
| updated_at | DATETIME | Auto-updated |

**`work_entries`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| task_id | TEXT | FK → tasks |
| member_id | TEXT | FK → team_members |
| entry_type | TEXT | decision, code, note, status_update |
| content | TEXT | The work entry content |
| created_at | DATETIME | Auto-set |

Private to the agent who wrote them. Queries filter by member_id to enforce isolation.

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

Replaces both meetings and direct messages. A meeting is a discussion with many participants. A DM is a discussion with two.

**`discussion_participants`**
| Column | Type | Notes |
|---|---|---|
| discussion_id | TEXT | FK → discussions |
| member_id | TEXT | FK → team_members |
| joined_at | DATETIME | When added to discussion |

Join table. Composite primary key on (discussion_id, member_id).

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

Deliverables that one agent produces and others need to consume.

---

## MCP Tool Surface (28 tools)

### Projects (4 tools)
- **`create_project`** — name, description → returns project UUID
- **`get_project`** — by ID → project details + status
- **`update_project_status`** — change status (active/paused/archived/closed)
- **`list_projects`** — filter by status

### Project Summaries (3 tools)
- **`get_project_summary`** — latest summary for a project
- **`update_project_summary`** — PM writes/updates the living document (auto-versions)
- **`get_summary_history`** — view past versions

### Team Members (3 tools)
- **`add_team_member`** — assign a role to a project
- **`remove_team_member`** — remove from project
- **`list_team_members`** — who is on this project

### Tasks (4 tools)
- **`create_task`** — assign work to a team member
- **`update_task`** — change status, description
- **`get_task`** — task details
- **`list_tasks`** — filter by project, assignee, status

### Work Entries (3 tools)
- **`log_work`** — agent writes a private entry against a task
- **`get_my_work`** — agent retrieves their own entries (filtered by member_id)
- **`get_work_history`** — agent's full history on a project

### Task Comments (3 tools)
- **`add_task_comment`** — post a comment on a task (visible to project members)
- **`get_task_comments`** — all comments on a task
- **`list_my_comments`** — comments an agent has written across a project

### Discussions (5 tools)
- **`create_discussion`** — topic, participants
- **`add_discussion_message`** — post to the thread
- **`update_discussion_summary`** — keep the summary current
- **`get_discussion`** — full thread + summary
- **`list_discussions`** — filter by project, participant

### Decisions (3 tools)
- **`log_decision`** — record a decision with rationale and context
- **`get_decisions`** — all decisions for a project
- **`get_decision`** — single decision details

### Shared Artifacts (3 tools)
- **`share_artifact`** — publish a deliverable (type, content)
- **`get_artifacts`** — list artifacts for a project, optionally filtered by type
- **`get_artifact`** — single artifact details

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

### Prompt Structure (all agents)

Each agent prompt has three layers:

1. **Role Identity** — Who the agent is, drawn from the software development team guide. Defines expertise, behaviors, and output formats.

2. **Team Protocol** — Shared across all agents:
   - Read the project summary when joining a project
   - Log work entries as you progress
   - Use task comments for task-level communication with others
   - Use discussions for cross-functional collaboration
   - Check the decisions log for context on past choices
   - Check shared artifacts for deliverables from other agents
   - Stay in your lane — do not perform work outside your role

3. **Role-Specific Constraints** — What the agent can and cannot do:
   - Only the PM can update the project summary
   - Only the PM can change project status or recruit/remove team members
   - Any agent can create discussions
   - Agents do not perform work outside their defined role

### PM Orchestration Layer

The Project Manager agent has an additional orchestration section:

- Create projects and assign unique IDs
- Write and maintain the project summary
- Recruit team members based on project needs
- Break work into tasks and assign to specialists
- Create discussions when cross-functional alignment is needed
- Log key decisions to the decisions table
- Update project status through its lifecycle (active → paused → archived → closed)
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
│   │   └── connection.ts     # SQLite connection management
│   └── tools/
│       ├── projects.ts       # create, get, update_status, list
│       ├── summaries.ts      # get, update, history
│       ├── team-members.ts   # add, remove, list
│       ├── tasks.ts          # create, update, get, list
│       ├── work-entries.ts   # log, get_my_work, get_history
│       ├── task-comments.ts  # add, get, list_mine
│       ├── discussions.ts    # create, add_message, update_summary, get, list
│       ├── decisions.ts      # log, get, list
│       └── artifacts.ts      # share, get, list
```

- **Runtime:** Node.js with TypeScript
- **Database:** SQLite via `better-sqlite3`
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Database location:** `~/.agent-team/team.db` (configurable)
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

4. **Work entry isolation** — Each agent's work entries are private, filtered by member_id. Prevents context pollution between specialists while still allowing shared communication through task comments, discussions, and artifacts.

5. **All 13 roles from day one** — Agent definitions are cheap (prompt files). The PM decides who to recruit per project, so unused agents have zero cost.

6. **Versioned project summaries** — The PM's living document is the primary shared context. Versioning preserves history so decisions can be traced.

---

## Inspiration

Architecture inspired by the AutoResearch family of projects (Sibyl, AutoResearchClaw) on GitHub, adapted for software development teams with a database-backed persistence layer instead of filesystem-based state management.
