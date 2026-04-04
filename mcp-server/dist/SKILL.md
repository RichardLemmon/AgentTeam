---
name: team
description: Spin up an AgentTeam — spawns the Project Manager, displays the dispatch manifest, and launches all specialists in parallel. Use /team <goal> for fast lane, /team for conversational, /team --review to pause before dispatch, /team --projects to manage projects.
user-invocable: true
---

# /team — AgentTeam Orchestrator

Parse the user's input to determine the mode:

## Team Mode State

Team mode uses a state file at `~/.claude/.agent-team-active` to maintain session continuity. When this file exists, ALL user messages are routed through this skill automatically (via CLAUDE.md rule).

The state file is JSON:
```json
{
  "project_id": "uuid",
  "project_name": "My Project"
}
```

## Mode Detection

First, check if `~/.claude/.agent-team-active` exists:
- If it exists AND args start with `--stop` → **Exit Team Mode** (delete the file, display "Exited team mode.", STOP)
- If it exists AND no explicit `/team` invocation (i.e., this was auto-routed by CLAUDE.md) → **Continuation Mode**
- If it exists AND user explicitly typed `/team` with new args → proceed to normal mode detection below (the new command takes priority)

Then for explicit `/team` invocations:

1. If args start with `--projects` → **Project Management Mode**
2. If args contain `--stop` → **Exit Team Mode** (delete state file, display "Exited team mode.", STOP)
3. If args contain `--review` → set REVIEW_MODE=true, strip the flag, remaining text is the goal
4. If args have text (after flag removal) → **Fast Lane Mode** with that text as the goal
5. If no args → **Conversational Mode** — list projects with numbered selection, then ask for goal

---

## Project Management Mode (`--projects`)

Parse the subcommand after `--projects`:

- **No subcommand** → call `list_projects` via MCP, display with numbered selection grouped by status:

```
📁 Projects:

   Active
   [1] <name>     (<date>)
   [2] <name>     (<date>)

   Paused
   [3] <name>     (<date>)

   Archived
   [4] <name>     (<date>)

Type a number to focus the team on that project, or /team <goal> to start a new one.
```

If the user responds with a number, load that project's summary via `get_project_summary` and ask: "What would you like the team to do on this project?"

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

- **`archive` / `pause` / `resume` / `close` followed by `<name-or-id>`** → resolve the project, then call `update_project_status` with the appropriate status (`resume` maps to `active`). If the action is `archive`, `pause`, or `close`, also delete `~/.claude/.agent-team-active` if it references this project. Display: "Updated <name> → <new status>."

**STOP after project management. Do not proceed to dispatch.**

---

## Continuation Mode

When the state file exists and the user's message was auto-routed (not an explicit `/team` command):

1. Read `~/.claude/.agent-team-active` to get `project_id` and `project_name`
2. Call `get_project_summary` with the `project_id` to load current project context
3. Treat the user's message as a follow-up instruction for this project
4. Proceed to **Dispatch Mode** with the goal set to the user's message and the project context included
5. When displaying the manifest, remind the user: "Type `/team --stop` to exit team mode."

This ensures the user continues interacting with "the team" rather than Claude directly.

---

## Conversational Mode (no args)

When invoked with no arguments:

1. Call `list_projects` via MCP
2. If projects exist, display them with numbered selection grouped by status:

```
📁 Projects:

   Active
   [1] <name>     (<date>)
   [2] <name>     (<date>)

   Paused
   [3] <name>     (<date>)

Type a number to focus the team on that project, or /team <goal> to start a new one.
```

3. If the user responds with a number, load that project's summary via `get_project_summary` and ask: "What would you like the team to do on this project?" Then proceed to Dispatch Mode with the project context included in the goal.
4. If no projects exist, ask: "What would you like the team to work on?"

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

### Step 8: Activate Team Mode

After dispatch completes, write the state file to keep team mode active for follow-up messages:

```bash
echo '{"project_id":"<PROJECT_ID>","project_name":"<PROJECT_NAME>"}' > ~/.claude/.agent-team-active
```

### Completion

Display a brief summary of what was accomplished, followed by:
"Team mode active — your next messages will be routed to the team. Type `/team --stop` to exit."

Do not ask "is this okay?" or similar.
