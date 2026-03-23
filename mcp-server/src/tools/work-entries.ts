import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired, validateEntryType, notFound } from '../validation.js';

export function logWork(db: Database.Database, input: { task_id: string; member_id: string; entry_type: string; content: string }) {
  const taskErr = validateRequired(input.task_id, 'task_id');
  if (taskErr) return taskErr;
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;
  const typeErr = validateEntryType(input.entry_type);
  if (typeErr) return typeErr;
  const contentErr = validateRequired(input.content, 'content');
  if (contentErr) return contentErr;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO work_entries (id, task_id, member_id, entry_type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, input.task_id, input.member_id, input.entry_type, input.content, now);

  return { id, task_id: input.task_id, member_id: input.member_id, entry_type: input.entry_type, created_at: now };
}

export function getMyWork(db: Database.Database, input: { member_id: string; task_id?: string }) {
  const err = validateRequired(input.member_id, 'member_id');
  if (err) return err;

  if (input.task_id) {
    return db.prepare(
      'SELECT id, task_id, entry_type, content, created_at FROM work_entries WHERE member_id = ? AND task_id = ? ORDER BY created_at DESC'
    ).all(input.member_id, input.task_id);
  }
  return db.prepare(
    'SELECT id, task_id, entry_type, content, created_at FROM work_entries WHERE member_id = ? ORDER BY created_at DESC'
  ).all(input.member_id);
}

export function getWorkHistory(db: Database.Database, input: { member_id: string; project_id: string }) {
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;
  const projectErr = validateRequired(input.project_id, 'project_id');
  if (projectErr) return projectErr;

  return db.prepare(
    `SELECT we.id, we.task_id, we.entry_type, we.content, we.created_at
     FROM work_entries we
     JOIN tasks t ON we.task_id = t.id
     WHERE we.member_id = ? AND t.project_id = ?
     ORDER BY we.created_at DESC`
  ).all(input.member_id, input.project_id);
}
