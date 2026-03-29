#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getDb } from './db/connection.js';
import { createProject, getProject, updateProjectStatus, listProjects, deleteProject } from './tools/projects.js';
import { getProjectSummary, updateProjectSummary, getSummaryVersion, listSummaryHistory } from './tools/summaries.js';
import { addTeamMember, removeTeamMember, listTeamMembers } from './tools/team-members.js';
import { createTask, updateTask, getTask, listTasks } from './tools/tasks.js';
import { logWork, getMyWork, getWorkHistory } from './tools/work-entries.js';
import { addTaskComment, listTaskComments, listMyComments } from './tools/task-comments.js';
import { createDiscussion, addDiscussionParticipant, addDiscussionMessage, updateDiscussionSummary, getDiscussion, listDiscussions, } from './tools/discussions.js';
import { logDecision, listDecisions, getDecision } from './tools/decisions.js';
import { shareArtifact, updateArtifact, listArtifacts, getArtifact } from './tools/artifacts.js';
import { logJournalEntry, listJournalEntries } from './tools/journal.js';
import { askUserQuestion, listUserQuestions, answerUserQuestion } from './tools/user-questions.js';
import { requestTeamExpansion, listExpansionRequests, resolveExpansionRequest } from './tools/expansion-requests.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const db = getDb();
const __dirname = dirname(fileURLToPath(import.meta.url));
const server = new McpServer({
    name: 'agent-team',
    version: '1.0.0',
});
// --- Projects (5) ---
server.tool('create_project', 'Create a new project with a name and description', { name: z.string(), description: z.string() }, async (input) => {
    const result = createProject(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('get_project', 'Get a project by ID', { project_id: z.string() }, async (input) => {
    const result = getProject(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('update_project_status', 'Update the status of a project (active → paused → completed or archived)', { project_id: z.string(), status: z.string() }, async (input) => {
    const result = updateProjectStatus(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('list_projects', 'List all projects, optionally filtered by status', { status: z.string().optional() }, async (input) => {
    const result = listProjects(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('delete_project', 'Permanently delete a project and ALL associated data (tasks, work entries, discussions, artifacts, etc.). This is irreversible.', { project_id: z.string() }, async (input) => {
    const result = deleteProject(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
// --- Summaries (4) ---
server.tool('get_project_summary', 'Get the latest summary for a project', { project_id: z.string() }, async (input) => {
    const result = getProjectSummary(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('update_project_summary', 'Create a new versioned summary for a project', { project_id: z.string(), content: z.string() }, async (input) => {
    const result = updateProjectSummary(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('get_summary_version', 'Get a specific summary version by its ID', { summary_id: z.string() }, async (input) => {
    const result = getSummaryVersion(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('list_summary_history', 'List all summary versions for a project', { project_id: z.string() }, async (input) => {
    const result = listSummaryHistory(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
// --- Team Members (3) ---
server.tool('add_team_member', 'Add a team member to a project with a role', { project_id: z.string(), role: z.string() }, async (input) => {
    const result = addTeamMember(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('remove_team_member', 'Remove a team member from a project (soft delete)', { member_id: z.string() }, async (input) => {
    const result = removeTeamMember(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('list_team_members', 'List team members for a project, optionally including removed members', { project_id: z.string(), active_only: z.boolean().optional() }, async (input) => {
    const result = listTeamMembers(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
// --- Tasks (4) ---
server.tool('create_task', 'Create a new task in a project', { project_id: z.string(), title: z.string(), description: z.string(), assignee_id: z.string().optional() }, async (input) => {
    const result = createTask(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('update_task', 'Update a task\'s status, description, or assignee', { task_id: z.string(), status: z.string().optional(), description: z.string().optional(), assignee_id: z.string().optional() }, async (input) => {
    const result = updateTask(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('get_task', 'Get a task by ID', { task_id: z.string() }, async (input) => {
    const result = getTask(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('list_tasks', 'List tasks for a project, optionally filtered by assignee or status', { project_id: z.string(), assignee_id: z.string().optional(), status: z.string().optional() }, async (input) => {
    const result = listTasks(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
// --- Work Entries (3) ---
server.tool('log_work', 'Log a work entry for a task by a team member', { task_id: z.string(), member_id: z.string(), entry_type: z.string(), content: z.string() }, async (input) => {
    const result = logWork(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('get_my_work', 'Get work entries for a team member, optionally filtered by task', { member_id: z.string(), task_id: z.string().optional() }, async (input) => {
    const result = getMyWork(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('get_work_history', 'Get all work entries for a member within a project', { member_id: z.string(), project_id: z.string() }, async (input) => {
    const result = getWorkHistory(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
// --- Task Comments (3) ---
server.tool('add_task_comment', 'Add a comment to a task', { task_id: z.string(), member_id: z.string(), content: z.string() }, async (input) => {
    const result = addTaskComment(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('list_task_comments', 'List all comments on a task', { task_id: z.string() }, async (input) => {
    const result = listTaskComments(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('list_my_comments', 'List all comments made by a member within a project', { member_id: z.string(), project_id: z.string() }, async (input) => {
    const result = listMyComments(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
// --- Discussions (6) ---
server.tool('create_discussion', 'Create a new discussion thread in a project', {
    project_id: z.string(),
    topic: z.string(),
    created_by: z.string(),
    participant_ids: z.array(z.string()),
}, async (input) => {
    const result = createDiscussion(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('add_discussion_participant', 'Add a participant to an existing discussion', { discussion_id: z.string(), member_id: z.string() }, async (input) => {
    const result = addDiscussionParticipant(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('add_discussion_message', 'Post a message to a discussion (participant must already be in the discussion)', { discussion_id: z.string(), member_id: z.string(), content: z.string() }, async (input) => {
    const result = addDiscussionMessage(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('update_discussion_summary', 'Update the summary of a discussion', { discussion_id: z.string(), summary: z.string() }, async (input) => {
    const result = updateDiscussionSummary(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('get_discussion', 'Get a discussion including its participants and messages', { discussion_id: z.string() }, async (input) => {
    const result = getDiscussion(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('list_discussions', 'List discussions in a project, optionally filtered by participant', { project_id: z.string(), participant_id: z.string().optional() }, async (input) => {
    const result = listDiscussions(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
// --- Decisions (3) ---
server.tool('log_decision', 'Log a decision made within a project', {
    project_id: z.string(),
    member_id: z.string(),
    title: z.string(),
    rationale: z.string(),
    context: z.string().optional(),
}, async (input) => {
    const result = logDecision(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('list_decisions', 'List all decisions for a project', { project_id: z.string() }, async (input) => {
    const result = listDecisions(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('get_decision', 'Get a decision by ID', { decision_id: z.string() }, async (input) => {
    const result = getDecision(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
// --- Team Protocol (1) ---
server.tool('get_team_protocol', 'Returns the shared team protocol, constraints, and efficiency rules that all specialist agents must follow. Call this once on startup.', {}, async () => {
    // Try bundled location first (npm install), fall back to repo location (local dev)
    const bundledPath = join(__dirname, '_base-protocol.md');
    const repoPath = join(__dirname, '../../agents/_base-protocol.md');
    const protocolPath = existsSync(bundledPath) ? bundledPath : repoPath;
    const content = readFileSync(protocolPath, 'utf-8');
    return { content: [{ type: 'text', text: content }] };
});
// --- Shared Artifacts (4) ---
server.tool('share_artifact', 'Share an artifact (document, code, etc.) within a project. Research artifacts must use structured JSON: { "summary": "one sentence", "findings": [{ "claim": "...", "evidence": "url or source", "confidence": "high|medium|low" }], "recommendations": ["..."], "blockers": ["..."], "open_questions": ["..."] }. Code artifacts are exempt — use the appropriate file format.', {
    project_id: z.string(),
    member_id: z.string(),
    title: z.string(),
    artifact_type: z.string(),
    content: z.string(),
}, async (input) => {
    const result = shareArtifact(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('update_artifact', 'Update the content or title of a shared artifact', { artifact_id: z.string(), content: z.string(), title: z.string().optional() }, async (input) => {
    const result = updateArtifact(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('list_artifacts', 'List shared artifacts in a project, optionally filtered by type', { project_id: z.string(), artifact_type: z.string().optional() }, async (input) => {
    const result = listArtifacts(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('get_artifact', 'Get a shared artifact by ID', { artifact_id: z.string() }, async (input) => {
    const result = getArtifact(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
// --- User Journal (2) ---
server.tool('log_journal_entry', 'Log a user-facing journal entry — captures decisions, preferences, and reasoning from conversations that would otherwise be lost. project_id is optional; omit it for general cross-project conversations.', {
    project_id: z.string().optional(),
    entry: z.string(),
    author: z.string().optional(),
}, async (input) => {
    const result = logJournalEntry(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('list_journal_entries', 'List journal entries in chronological order. Optionally filter by project_id; omit to list all entries across all projects.', { project_id: z.string().optional() }, async (input) => {
    const result = listJournalEntries(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
// --- User Questions (3) ---
server.tool('ask_user_question', 'Log a question for the user. The orchestrating skill will surface it after dispatch. Include context about why this question matters or what is blocked.', {
    project_id: z.string(),
    member_id: z.string(),
    question: z.string(),
    context: z.string().optional(),
}, async (input) => {
    const result = askUserQuestion(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('list_user_questions', 'List questions logged by specialists for the user. Filter by status (pending, answered) to find unanswered questions.', { project_id: z.string(), status: z.string().optional() }, async (input) => {
    const result = listUserQuestions(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('answer_user_question', 'Write the user\'s answer to a previously asked question', { question_id: z.string(), answer: z.string() }, async (input) => {
    const result = answerUserQuestion(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
// --- Expansion Requests (3) ---
server.tool('request_team_expansion', 'Request additional team members when your assigned work grows beyond expected scope. The PM will evaluate and approve or deny.', {
    project_id: z.string(),
    requested_by: z.string(),
    role_needed: z.string(),
    justification: z.string(),
}, async (input) => {
    const result = requestTeamExpansion(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('list_expansion_requests', 'List team expansion requests for a project, optionally filtered by status (pending, approved, denied)', { project_id: z.string(), status: z.string().optional() }, async (input) => {
    const result = listExpansionRequests(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
server.tool('resolve_expansion_request', 'Approve or deny a team expansion request (PM only)', {
    request_id: z.string(),
    status: z.enum(['approved', 'denied']),
    resolution_note: z.string().optional(),
}, async (input) => {
    const result = resolveExpansionRequest(db, input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
// --- Start server ---
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=index.js.map