import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired, notFound } from '../validation.js';

export function logDecision(db: Database.Database, input: {
  project_id: string; member_id: string; title: string; rationale: string; context?: string;
}) {
  const projErr = validateRequired(input.project_id, 'project_id');
  if (projErr) return projErr;
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;
  const titleErr = validateRequired(input.title, 'title');
  if (titleErr) return titleErr;
  const ratErr = validateRequired(input.rationale, 'rationale');
  if (ratErr) return ratErr;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO decisions (id, project_id, member_id, title, rationale, context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.project_id, input.member_id, input.title, input.rationale, input.context ?? null, now);

  return { id, project_id: input.project_id, title: input.title, created_at: now };
}

export function listDecisions(db: Database.Database, input: { project_id: string }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  return db.prepare(
    'SELECT id, title, member_id, created_at FROM decisions WHERE project_id = ? ORDER BY created_at DESC'
  ).all(input.project_id);
}

export function getDecision(db: Database.Database, input: { decision_id: string }) {
  const err = validateRequired(input.decision_id, 'decision_id');
  if (err) return err;

  const row = db.prepare('SELECT * FROM decisions WHERE id = ?').get(input.decision_id) as any;
  if (!row) return notFound('Decision', input.decision_id);

  return { id: row.id, project_id: row.project_id, member_id: row.member_id, title: row.title, rationale: row.rationale, context: row.context, created_at: row.created_at };
}
