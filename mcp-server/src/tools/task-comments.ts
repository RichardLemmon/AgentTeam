import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired } from '../validation.js';

export function addTaskComment(db: Database.Database, input: { task_id: string; member_id: string; content: string }) {
  const taskErr = validateRequired(input.task_id, 'task_id');
  if (taskErr) return taskErr;
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;
  const contentErr = validateRequired(input.content, 'content');
  if (contentErr) return contentErr;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO task_comments (id, task_id, member_id, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.task_id, input.member_id, input.content, now);

  return { id, task_id: input.task_id, member_id: input.member_id, created_at: now };
}

export function listTaskComments(db: Database.Database, input: { task_id: string }) {
  const err = validateRequired(input.task_id, 'task_id');
  if (err) return err;

  return db.prepare(
    'SELECT id, member_id, content, created_at FROM task_comments WHERE task_id = ? ORDER BY created_at'
  ).all(input.task_id);
}

export function listMyComments(db: Database.Database, input: { member_id: string; project_id: string }) {
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;
  const projectErr = validateRequired(input.project_id, 'project_id');
  if (projectErr) return projectErr;

  return db.prepare(
    `SELECT tc.id, tc.task_id, tc.content, tc.created_at
     FROM task_comments tc
     JOIN tasks t ON tc.task_id = t.id
     WHERE tc.member_id = ? AND t.project_id = ?
     ORDER BY tc.created_at DESC`
  ).all(input.member_id, input.project_id);
}
