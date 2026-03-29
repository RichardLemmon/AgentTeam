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
