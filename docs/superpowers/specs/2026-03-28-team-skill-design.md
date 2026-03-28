# /team Skill & UX Improvements — Design Spec

**Date:** 2026-03-28
**Status:** Draft

---

## Overview

Make AgentTeam seamless to use by adding a `/team` Claude Code skill that handles the full pipeline from goal to working agents, plus supporting MCP tools and a CLAUDE.md fallback for non-Claude-Code clients.

### Goals

1. Single-command invocation: `/team <goal>` spins up the PM, displays the manifest, and dispatches all specialists — no manual steps.
2. Ad-hoc specialists: PM can define custom roles on the fly, not limited to the 13 predefined agents.
3. User questions: Any specialist can surface questions to the user; the skill mediates the interaction.
4. Team expansion: Specialists can request additional agents via the PM when scope grows unexpectedly.
5. Project management: Users can list, filter, and manage projects via `/team --projects`.

---

## 1. The `/team` Skill

**Location:** `agents/skills/team.md`

### Invocation Patterns

| Command | Behavior |
|---|---|
| `/team build me a REST API` | Fast lane — spawns PM immediately with the goal |
| `/team` (no args) | Conversational — prompts "What would you like the team to work on?" |
| `/team --review redesign auth flow` | Pauses after manifest display, waits for approval before dispatch |
| `/team --projects` | Lists all projects grouped by status |
| `/team --projects active` | Lists projects filtered by status |
| `/team --projects delete <name-or-id>` | Deletes a project (with confirmation) |
| `/team --projects archive <name-or-id>` | Changes project status |

### Internal Flow (Standard Invocation)

1. Parse arguments — extract `--review` flag and goal text
2. If no goal text and no `--projects` flag, prompt the user for a goal
3. Read `agents/project-manager.md`
4. Spawn a PM agent (via the Agent tool) with the user's goal
5. Parse the `## DISPATCH_MANIFEST` JSON block from the PM's response
6. Display the manifest as a formatted summary:

```
📋 Project: WiFi Sensing Hardware Investigation
   ID: a1b2c3d4-...

👥 Team assembled:
   • Backend Developer — 2 tasks (API endpoints, database schema)
   • Data Scientist — 1 task (signal processing pipeline)
   • Security Engineer — 1 task (threat model review)

Dispatching team. Ask for a review anytime by typing /team --review.
```

7. If `--review` flag is set, pause and wait for user approval
8. Spawn all specialists in parallel via the Agent tool:
   - For predefined roles: read the prompt from `agent_prompt_file`
   - For ad-hoc roles: use the inline `agent_prompt` field from the manifest
   - Pass `project_id`, `member_id`, and assigned tasks to each
9. After all specialists complete, check for pending user questions (see Section 3)
10. If there are team expansion requests (see Section 4), process them

### Project Management Flow (`--projects`)

**List projects:**
1. Call `list_projects` MCP tool (optionally filtered by status)
2. Display grouped by status, sorted by creation date descending:

```
📁 Projects:

   Active
   • a1b2c3d4  WiFi Sensing Hardware Investigation     (Mar 21)
   • e5f6g7h8  SnapWorth REST API                      (Mar 25)

   Paused
   • i9j0k1l2  BrainCache Auth Redesign                (Mar 18)

   Archived
   • m3n4o5p6  WavePresence Signal Pipeline             (Mar 12)
```

**Delete project:**
1. Resolve the project by name (fuzzy match against project names) or UUID
2. Call `get_project` to fetch details
3. Call `list_tasks`, `list_team_members` to get counts
4. Display confirmation:

```
⚠️  Delete "BrainCache Auth Redesign" and all associated data?
    (6 tasks, 14 work entries, 3 discussions)
    Type "yes" to confirm.
```

5. On confirmation, call `delete_project` MCP tool (cascading delete)

**Change status (archive, pause, resume, close):**
1. Resolve the project by name or UUID
2. Call `update_project_status` with the new status

---

## 2. Ad-Hoc Specialists

The PM can recruit specialists not in the predefined 13 roles by defining them inline in the dispatch manifest.

### Manifest Entry for Ad-Hoc Roles

```json
{
  "role": "graphql_specialist",
  "member_id": "<UUID from add_team_member>",
  "project_id": "<project UUID>",
  "agent_prompt": "You are an expert GraphQL API designer and developer...",
  "tasks": [...],
  "context": "..."
}
```

**Key differences from predefined roles:**
- Uses `agent_prompt` (inline string) instead of `agent_prompt_file` (file path)
- The PM writes a role identity prompt on the fly tailored to the project's needs
- The base team protocol is still loaded via `get_team_protocol`, so ad-hoc agents follow the same collaboration rules

**Dispatch logic:** The `/team` skill checks for `agent_prompt` first; if present, uses it. Falls back to reading `agent_prompt_file`.

**PM prompt update:** The PM's orchestration instructions need to document that `agent_prompt` is available as an alternative to `agent_prompt_file` for custom roles, and that the inline prompt should follow the same structure as predefined role files (Identity section only — protocol is loaded separately).

---

## 3. User Questions

Any specialist can surface a question for the user. The skill mediates the interaction — specialists don't block waiting for an answer.

### New MCP Tool: `ask_user_question`

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Auto-generated |
| `project_id` | UUID | FK to projects |
| `member_id` | UUID | FK to team_members |
| `question` | TEXT | The question for the user |
| `context` | TEXT | Why this question matters / what's blocked |
| `status` | TEXT | `pending`, `answered` |
| `answer` | TEXT | User's response (null until answered) |
| `created_at` | DATETIME | Auto-generated |
| `answered_at` | DATETIME | When the answer was provided |

### New MCP Tools

- **`ask_user_question`** — Specialist logs a question with context. Sets status to `pending`.
- **`list_user_questions`** — Lists questions for a project, optionally filtered by status.
- **`answer_user_question`** — The skill writes the user's answer back. Sets status to `answered`.

### Skill Behavior

After all specialists in a dispatch round complete:

1. Call `list_user_questions` with `status=pending`
2. If questions exist, display them grouped by role:

```
❓ Questions from your team:

   Security Engineer:
   "Should we prioritize OWASP top 10 or is there a specific
    compliance framework you need?"
    Context: Evaluating auth middleware — framework choice affects scope.

   Data Scientist:
   "Is there a minimum accuracy threshold for the presence
    detection model?"
    Context: Deciding between a simpler threshold model vs. full ML pipeline.
```

3. Collect the user's answers
4. Call `answer_user_question` for each
5. Re-dispatch any specialists whose work was blocked by unanswered questions

### Database Table: `user_questions`

```sql
CREATE TABLE user_questions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  member_id TEXT NOT NULL REFERENCES team_members(id),
  question TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'answered')),
  answer TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (member_id) REFERENCES team_members(id)
);
```

---

## 4. Team Expansion Requests

Specialists can request additional agents when scope grows beyond their assignment. The PM evaluates and decides.

### New MCP Tools

- **`request_team_expansion`** — Specialist logs a request describing what additional help is needed and why.
- **`list_expansion_requests`** — Lists pending expansion requests for a project.
- **`resolve_expansion_request`** — PM marks a request as approved or denied with a reason.

### Database Table: `expansion_requests`

```sql
CREATE TABLE expansion_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  requested_by TEXT NOT NULL REFERENCES team_members(id),
  role_needed TEXT NOT NULL,
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'denied')),
  resolution_note TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (requested_by) REFERENCES team_members(id)
);
```

### Skill Behavior

After all specialists complete:

1. Call `list_expansion_requests` with `status=pending`
2. If requests exist, re-spawn the PM with the expansion requests as context
3. PM evaluates each request, approves or denies, and returns a supplemental dispatch manifest for approved expansions
4. Skill dispatches the new agents
5. Display to user:

```
🔄 Team expansion:
   • Backend Developer requested a Data Engineer for migration support — approved
   • QA Engineer requested a Performance Engineer — denied (covered by existing scope)

   Dispatching 1 additional specialist.
```

---

## 5. Project Deletion (Cascading)

### New MCP Tool: `delete_project`

Cascading delete that removes all records associated with a project:

1. `user_questions` where `project_id` matches
2. `expansion_requests` where `project_id` matches
3. `work_entries` where `project_id` matches
4. `task_comments` where `task_id` in project tasks
5. `tasks` where `project_id` matches
6. `discussion_messages` where `discussion_id` in project discussions
7. `discussion_participants` where `discussion_id` in project discussions
8. `discussions` where `project_id` matches
9. `decisions` where `project_id` matches
10. `artifacts` where `project_id` matches
11. `project_summaries` where `project_id` matches
12. `team_members` where `project_id` matches
13. `journal_entries` where `project_id` matches
14. `projects` where `id` matches

Executed in a single transaction. Returns a summary of what was deleted (record counts per table).

**Note:** SQLite supports `ON DELETE CASCADE` via foreign keys. If FKs are already defined with cascade behavior, the delete simplifies to removing the project row. If not, the tool performs explicit deletes in dependency order within a transaction.

---

## 6. CLAUDE.md Fallback (Non-Claude-Code Clients)

A `CLAUDE.md` in the AgentTeam repo root teaches any Claude-based client the manual equivalent of what the skill automates:

```markdown
# AgentTeam — How to Use

When the user asks to spin up a team, build something with the team, or similar:

1. Read `agents/project-manager.md` from this repository
2. Spawn the PM agent with the user's goal as the task
3. The PM will return a `## DISPATCH_MANIFEST` JSON block
4. For each entry in the manifest:
   - If `agent_prompt_file` is set: read that file for the agent's prompt
   - If `agent_prompt` is set: use the inline prompt (ad-hoc specialist)
   - Spawn the specialist with their `project_id`, `member_id`, and tasks
5. Run specialists in parallel
6. After completion, call `list_user_questions` — if any are pending,
   present them to the user and write answers back via `answer_user_question`
7. Check `list_expansion_requests` — if any are pending, re-run the PM
   to evaluate and dispatch approved expansions
```

This is a best-effort fallback — no `--review` flag, no formatted display, no project management commands. Those are skill-only features.

---

## 7. MCP Server Changes Summary

### New Tables (2)

| Table | Purpose |
|---|---|
| `user_questions` | Specialist questions for the user |
| `expansion_requests` | Specialist requests for additional agents |

### New Tools (6)

| Tool | Domain | Description |
|---|---|---|
| `ask_user_question` | User Questions | Specialist logs a question |
| `list_user_questions` | User Questions | List questions, filter by status |
| `answer_user_question` | User Questions | Write user's answer back |
| `request_team_expansion` | Expansion | Specialist requests more help |
| `list_expansion_requests` | Expansion | List pending requests |
| `resolve_expansion_request` | Expansion | PM approves/denies |
| `delete_project` | Projects | Cascading project deletion |

**Total after changes:** 44 MCP tools across 12 domains.

### PM Prompt Updates

- Document `agent_prompt` as an alternative to `agent_prompt_file` in the dispatch manifest
- Document `ask_user_question` as available to all agents but mediated by the skill
- Document `request_team_expansion` as the escalation path (not direct agent spawning)

### Agent Base Protocol Updates

- Add `ask_user_question` to the team protocol — available to all agents
- Add `request_team_expansion` to the team protocol — available to all agents
- Clarify that agents MUST NOT spawn other agents; escalation goes through the PM

---

## 8. Key Design Decisions

| Decision | Rationale |
|---|---|
| Skill handles dispatch, not MCP | MCP is a data layer; orchestration belongs in the client |
| Non-blocking user questions | Specialists log and continue; no real-time interruption |
| PM evaluates expansion requests | Single orchestrator prevents runaway agent trees and cost |
| Ad-hoc prompts inline, not files | No filesystem writes needed; PM generates on the fly |
| Cascading delete in a transaction | Atomic cleanup; no orphaned records |
| Confirmation only on delete | Destructive action is the one place a gate is justified |
| CLAUDE.md as fallback, not primary | Claude Code gets the best UX; other clients get functional instructions |
