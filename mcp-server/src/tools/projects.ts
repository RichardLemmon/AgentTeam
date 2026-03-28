import type Database from 'better-sqlite3';
import crypto from 'crypto';
import {
  validateRequired,
  validateProjectStatus,
  validateProjectTransition,
  notFound,
} from '../validation.js';

export function createProject(db: Database.Database, input: { name: string; description: string }) {
  const nameErr = validateRequired(input.name, 'name');
  if (nameErr) return nameErr;
  const descErr = validateRequired(input.description, 'description');
  if (descErr) return descErr;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO projects (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, input.name, input.description, 'active', now, now);

  return { id, name: input.name, description: input.description, status: 'active', created_at: now };
}

export function getProject(db: Database.Database, input: { project_id: string }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(input.project_id) as any;
  if (!row) return notFound('Project', input.project_id);

  return { id: row.id, name: row.name, description: row.description, status: row.status, created_at: row.created_at, updated_at: row.updated_at };
}

export function updateProjectStatus(db: Database.Database, input: { project_id: string; status: string }) {
  const idErr = validateRequired(input.project_id, 'project_id');
  if (idErr) return idErr;
  const statusErr = validateProjectStatus(input.status);
  if (statusErr) return statusErr;

  const project = db.prepare('SELECT status FROM projects WHERE id = ?').get(input.project_id) as any;
  if (!project) return notFound('Project', input.project_id);

  const transErr = validateProjectTransition(project.status, input.status);
  if (transErr) return transErr;

  const now = new Date().toISOString();
  db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run(input.status, now, input.project_id);

  return { id: input.project_id, status: input.status, updated_at: now };
}

export function listProjects(db: Database.Database, input: { status?: string }) {
  if (input.status !== undefined) {
    const statusErr = validateProjectStatus(input.status);
    if (statusErr) return statusErr;
    return db.prepare('SELECT id, name, status, created_at, updated_at FROM projects WHERE status = ? ORDER BY created_at DESC').all(input.status);
  }
  return db.prepare('SELECT id, name, status, created_at, updated_at FROM projects ORDER BY created_at DESC').all();
}

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
