# Token Reduction Design Spec

**Date:** 2026-03-24
**Goal:** Reduce per-agent token consumption by eliminating boilerplate duplication across 13 agent prompt files.

## Problem

All 12 specialist agents share ~530 words of identical boilerplate (Team Protocol, Constraints, Efficiency Protocol, Artifact Schema). Only ~60-120 words per agent (the Identity section) are unique. When a full team is spawned, this wastes ~6,000+ words of context window on duplicated instructions.

## Changes

### 1. Extract shared boilerplate into `agents/_base-protocol.md`

Create a single file containing the shared Team Protocol, Constraints, and Efficiency Protocol. Condense Efficiency Protocol from ~240 words to ~80 words (remove verbose examples, keep the 5 rules as terse directives).

### 2. Add `get_team_protocol` MCP tool

New tool in the MCP server that reads and returns `_base-protocol.md`. Agents call this on startup only if needed — lazy loading instead of pre-loading into every agent prompt.

### 3. Slim down specialist agent files to identity-only

Each specialist `.md` file retains only:
- `# Role: [Name]`
- `## Identity` section (unique content)
- A one-line instruction: "Call `get_team_protocol` to load team rules, constraints, and efficiency protocol."

**Before:** ~600 words per specialist, ~7,200 words for 12 specialists.
**After:** ~100 words per specialist, ~1,200 words for 12 specialists.

### 4. Move artifact schema into `share_artifact` tool description

The JSON schema for research artifacts is currently repeated in every agent's Efficiency Protocol. Move it into the `share_artifact` tool description in `index.ts` so agents discover it from the tool itself.

### 5. Update PM dispatch manifest to pre-load decisions and discussions

The PM already pre-loads artifact summaries into the `context` field. Extend this to also summarize recent decisions (via `list_decisions`) and active discussions (via `list_discussions`) so specialists don't need to query them individually on startup.

### 6. Update PM agent file

PM keeps its unique sections (Identity, Orchestration, Dispatch Manifest) plus the same one-line protocol reference. PM's Constraints section differs from specialists, so it stays inline but condensed.

## File Changes

| File | Action |
|------|--------|
| `agents/_base-protocol.md` | **Create** — condensed shared protocol |
| `agents/backend-developer.md` | **Rewrite** — identity only + protocol reference |
| `agents/data-engineer.md` | Same |
| `agents/data-scientist.md` | Same |
| `agents/devops-engineer.md` | Same |
| `agents/frontend-developer.md` | Same |
| `agents/full-stack-developer.md` | Same |
| `agents/mobile-developer.md` | Same |
| `agents/product-manager.md` | Same |
| `agents/qa-engineer.md` | Same |
| `agents/security-engineer.md` | Same |
| `agents/ux-researcher.md` | Same |
| `agents/ux-ui-designer.md` | Same |
| `agents/project-manager.md` | **Rewrite** — keep PM-specific sections, replace shared with reference |
| `mcp-server/src/index.ts` | **Edit** — add `get_team_protocol` tool, update `share_artifact` description |
| `README.md` | **Edit** — document new architecture |

## Token Savings Estimate

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| 1 specialist spawned | ~600 words | ~100 words + ~80 words (if protocol loaded) | ~420 words (70%) |
| 12 specialists spawned | ~7,200 words | ~1,200 words + ~80 words shared | ~5,920 words (82%) |
| Full team (PM + 12) | ~8,100 words | ~1,400 words + ~80 words shared | ~6,620 words (82%) |

The `get_team_protocol` tool result (~80 words) is loaded once per agent only if the agent actually calls it, enabling further savings for simple tasks where agents don't need the full protocol.
