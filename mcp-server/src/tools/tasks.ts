import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired, validateTaskStatus, notFound } from '../validation.js';

export function createTask(db: Database.Database, input: { project_id: string; title: string; description: string; assignee_id?: string }) {
  const idErr = validateRequired(input.project_id, 'project_id');
  if (idErr) return idErr;
  const titleErr = validateRequired(input.title, 'title');
  if (titleErr) return titleErr;
  const descErr = validateRequired(input.description, 'description');
  if (descErr) return descErr;

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(input.project_id);
  if (!project) return notFound('Project', input.project_id);

  if (input.assignee_id) {
    const member = db.prepare('SELECT id FROM team_members WHERE id = ?').get(input.assignee_id);
    if (!member) return notFound('Team member', input.assignee_id);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO tasks (id, project_id, assignee_id, title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.project_id, input.assignee_id ?? null, input.title, input.description, 'pending', now, now);

  return { id, project_id: input.project_id, assignee_id: input.assignee_id ?? null, title: input.title, status: 'pending', created_at: now };
}

export function updateTask(db: Database.Database, input: { task_id: string; status?: string; description?: string; assignee_id?: string }) {
  const idErr = validateRequired(input.task_id, 'task_id');
  if (idErr) return idErr;

  if (input.status !== undefined) {
    const statusErr = validateTaskStatus(input.status);
    if (statusErr) return statusErr;
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(input.task_id) as any;
  if (!task) return notFound('Task', input.task_id);

  if (input.assignee_id !== undefined) {
    const member = db.prepare('SELECT id FROM team_members WHERE id = ?').get(input.assignee_id);
    if (!member) return notFound('Team member', input.assignee_id);
  }

  const now = new Date().toISOString();
  const status = input.status !== undefined ? input.status : task.status;
  const description = input.description !== undefined ? input.description : task.description;
  const assigneeId = input.assignee_id !== undefined ? input.assignee_id : task.assignee_id;

  db.prepare(
    'UPDATE tasks SET status = ?, description = ?, assignee_id = ?, updated_at = ? WHERE id = ?'
  ).run(status, description, assigneeId, now, input.task_id);

  return { id: input.task_id, status, assignee_id: assigneeId, updated_at: now };
}

export function getTask(db: Database.Database, input: { task_id: string }) {
  const err = validateRequired(input.task_id, 'task_id');
  if (err) return err;

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(input.task_id) as any;
  if (!row) return notFound('Task', input.task_id);

  return { id: row.id, project_id: row.project_id, assignee_id: row.assignee_id, title: row.title, description: row.description, status: row.status, created_at: row.created_at, updated_at: row.updated_at };
}

export function listTasks(db: Database.Database, input: { project_id: string; assignee_id?: string; status?: string }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  if (input.status !== undefined) {
    const statusErr = validateTaskStatus(input.status);
    if (statusErr) return statusErr;
  }

  let sql = 'SELECT id, title, assignee_id, status, created_at, updated_at FROM tasks WHERE project_id = ?';
  const params: any[] = [input.project_id];

  if (input.assignee_id !== undefined) {
    sql += ' AND assignee_id = ?';
    params.push(input.assignee_id);
  }
  if (input.status !== undefined) {
    sql += ' AND status = ?';
    params.push(input.status);
  }
  sql += ' ORDER BY created_at DESC';

  return db.prepare(sql).all(...params);
}
