import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { validateRequired, notFound } from '../validation.js';

export function shareArtifact(db: Database.Database, input: {
  project_id: string; member_id: string; title: string; artifact_type: string; content: string;
}) {
  const projErr = validateRequired(input.project_id, 'project_id');
  if (projErr) return projErr;
  const memberErr = validateRequired(input.member_id, 'member_id');
  if (memberErr) return memberErr;
  const titleErr = validateRequired(input.title, 'title');
  if (titleErr) return titleErr;
  const typeErr = validateRequired(input.artifact_type, 'artifact_type');
  if (typeErr) return typeErr;
  const contentErr = validateRequired(input.content, 'content');
  if (contentErr) return contentErr;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO shared_artifacts (id, project_id, member_id, title, artifact_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.project_id, input.member_id, input.title, input.artifact_type, input.content, now, now);

  return { id, project_id: input.project_id, title: input.title, artifact_type: input.artifact_type, created_at: now };
}

export function updateArtifact(db: Database.Database, input: { artifact_id: string; content: string; title?: string }) {
  const idErr = validateRequired(input.artifact_id, 'artifact_id');
  if (idErr) return idErr;
  const contentErr = validateRequired(input.content, 'content');
  if (contentErr) return contentErr;

  const artifact = db.prepare('SELECT * FROM shared_artifacts WHERE id = ?').get(input.artifact_id) as any;
  if (!artifact) return notFound('Artifact', input.artifact_id);

  const now = new Date().toISOString();
  const title = input.title ?? artifact.title;

  db.prepare(
    'UPDATE shared_artifacts SET content = ?, title = ?, updated_at = ? WHERE id = ?'
  ).run(input.content, title, now, input.artifact_id);

  return { id: input.artifact_id, title, updated_at: now };
}

export function listArtifacts(db: Database.Database, input: { project_id: string; artifact_type?: string }) {
  const err = validateRequired(input.project_id, 'project_id');
  if (err) return err;

  if (input.artifact_type) {
    return db.prepare(
      'SELECT id, title, artifact_type, member_id, created_at, updated_at FROM shared_artifacts WHERE project_id = ? AND artifact_type = ? ORDER BY created_at DESC'
    ).all(input.project_id, input.artifact_type);
  }
  return db.prepare(
    'SELECT id, title, artifact_type, member_id, created_at, updated_at FROM shared_artifacts WHERE project_id = ? ORDER BY created_at DESC'
  ).all(input.project_id);
}

export function getArtifact(db: Database.Database, input: { artifact_id: string }) {
  const err = validateRequired(input.artifact_id, 'artifact_id');
  if (err) return err;

  const row = db.prepare('SELECT * FROM shared_artifacts WHERE id = ?').get(input.artifact_id) as any;
  if (!row) return notFound('Artifact', input.artifact_id);

  return { id: row.id, project_id: row.project_id, member_id: row.member_id, title: row.title, artifact_type: row.artifact_type, content: row.content, created_at: row.created_at, updated_at: row.updated_at };
}
