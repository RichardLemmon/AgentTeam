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
