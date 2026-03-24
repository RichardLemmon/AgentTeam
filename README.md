# AgentTeam

**AgentTeam** is a reusable AI software development team built on the Model Context Protocol (MCP). Thirteen specialized agents — Product Manager, Project Manager, UX Researcher, UX/UI Designer, Frontend, Backend, Full-Stack, Mobile, DevOps, QA, Security, Data Engineer, and Data Scientist — collaborate on software projects through a shared SQLite database, each constrained strictly to their role.

The Project Manager orchestrates: it creates the project, recruits the specialists it needs, breaks work into tasks, and returns a **dispatch manifest** — a JSON array that the calling session uses to spawn each specialist as an independent parallel agent. Specialists read the project summary on joining, log their work and decisions as they go, and share structured research artifacts so no agent re-researches what another has already found.

All project state is persisted in SQLite (37 MCP tools across 10 domains: projects, summaries, team members, tasks, work entries, task comments, discussions, decisions, artifacts, and a user journal). Projects are UUID-scoped and lifecycle-managed (active → paused → archived → closed), so teams can pause and resume work across sessions without losing context.

**Designed to be called from any Claude Code project via MCP** — point your `claude_desktop_config.json` at the server and any project can spin up a full team.

### User Journal

As the team works, the Project Manager captures your decisions, preferences, and reasoning from the conversation into a persistent **user journal** — things like devices considered and rejected, cost constraints, form factor preferences, and next-step intentions. These are stored as structured entries scoped to the project (or globally, for cross-project preferences) and reviewed at close-out so nothing important is lost between sessions. The journal is queryable via `list_journal_entries` so future agents can read what past conversations established before starting new work.

---

## Project Structure

```
AgentTeam/
├── agents/               # Agent prompt files — one per role
│   ├── _base-protocol.md # Shared team protocol, constraints, efficiency rules
│   ├── project-manager.md
│   ├── product-manager.md
│   ├── backend-developer.md
│   └── ...
├── mcp-server/           # TypeScript MCP server
│   └── src/
│       ├── index.ts      # Server entry — all 37 tools registered
│       ├── db/
│       │   ├── schema.ts # Table definitions and migrations
│       │   └── connection.ts
│       └── tools/        # One file per domain
└── docs/                 # Design specs and reference guides
```

## MCP Tool Domains

| Domain | Tools |
|---|---|
| Projects | `create_project`, `get_project`, `update_project_status`, `list_projects` |
| Summaries | `update_project_summary`, `get_project_summary`, `get_summary_version`, `list_summary_history` |
| Team Members | `add_team_member`, `remove_team_member`, `list_team_members` |
| Tasks | `create_task`, `update_task`, `get_task`, `list_tasks` |
| Work Entries | `log_work`, `get_my_work`, `get_work_history` |
| Task Comments | `add_task_comment`, `list_task_comments`, `list_my_comments` |
| Discussions | `create_discussion`, `add_discussion_participant`, `add_discussion_message`, `update_discussion_summary`, `get_discussion`, `list_discussions` |
| Decisions | `log_decision`, `list_decisions`, `get_decision` |
| Artifacts | `share_artifact`, `update_artifact`, `list_artifacts`, `get_artifact` |
| Team Protocol | `get_team_protocol` |
| User Journal | `log_journal_entry`, `list_journal_entries` |

## Getting Started

### 1. Install dependencies and build

```bash
cd mcp-server
npm install
npm run build
```

### Token-Efficient Architecture

Agent prompt files contain only the role-specific **Identity** section (~100 words each). Shared team protocol, constraints, and efficiency rules live in a single `agents/_base-protocol.md` file, served on demand via the `get_team_protocol` MCP tool. This lazy-loading approach saves ~6,000 words of context when spawning a full team compared to duplicating the protocol in every agent file. The artifact JSON schema is embedded in the `share_artifact` tool description so agents discover it from the tool itself.

### 2. Add to your MCP config

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

### 3. Invoke the Project Manager

Pass the contents of `agents/project-manager.md` as the system prompt for a Claude agent, give it a project goal, and let it set up the project and return a dispatch manifest. Then spawn each specialist from the manifest.

## How It Works

1. **PM sets up the project** — creates the project record, recruits the specialists it needs, creates tasks, writes the project summary, and returns a dispatch manifest.
2. **Calling session spawns specialists** — each specialist in the manifest is launched as an independent agent with its `project_id` and `member_id`.
3. **Specialists work in parallel** — each reads the project summary, logs work entries, shares artifacts, and communicates via task comments and discussions.
4. **State persists across sessions** — any agent can rejoin a project by reading the current summary and picking up where the team left off.
5. **PM closes out** — on completion, the PM writes a close-out summary and logs key user decisions and preferences to the journal for future reference.
