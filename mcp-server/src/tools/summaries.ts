import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired, notFound } from '../validation.js';

export function updateProjectSummary(db: Database.Database, input: { project_id: string; content: string }) {
  const idErr = validateRequired(input.project_id, 'project_id');
  if (idErr) return idErr;
  const contentErr = validateRequired(input.content, 'content');
  if (contentErr) return contentErr;

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(input.project_id);
  if (!project) return notFound('Project', input.project_id);

  const lastVersion = db.prepare(
    'SELECT version FROM project_summaries WHERE project_id = ? ORDER BY version DESC LIMIT 1'
  ).get(input.project_id) as { version: number } | undefined;

  const version = (lastVersion?.version ?? 0) + 1;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO project_summaries (id, project_id, content, version, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.project_id, input.content, version, now);

  return { id, project_id: input.project_id, version, created_at: now };
}

export function getProjectSummary(db: Database.Database, input: { project_id: string }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  const row = db.prepare(
    'SELECT * FROM project_summaries WHERE project_id = ? ORDER BY version DESC LIMIT 1'
  ).get(input.project_id) as any;

  if (!row) return notFound('Summary', input.project_id);
  return { id: row.id, project_id: row.project_id, content: row.content, version: row.version, created_at: row.created_at };
}

export function getSummaryVersion(db: Database.Database, input: { summary_id: string }) {
  const err = validateRequired(input.summary_id, 'summary_id');
  if (err) return err;

  const row = db.prepare('SELECT * FROM project_summaries WHERE id = ?').get(input.summary_id) as any;
  if (!row) return notFound('Summary version', input.summary_id);

  return { id: row.id, project_id: row.project_id, content: row.content, version: row.version, created_at: row.created_at };
}

export function listSummaryHistory(db: Database.Database, input: { project_id: string }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  return db.prepare(
    'SELECT id, version, created_at FROM project_summaries WHERE project_id = ? ORDER BY version DESC'
  ).all(input.project_id);
}
