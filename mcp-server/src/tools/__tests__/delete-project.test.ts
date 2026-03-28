import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../../db/schema.js';
import { createProject, deleteProject } from '../projects.js';

function setupDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);
  return db;
}

describe('deleteProject', () => {
  it('deletes a project and all associated records', () => {
    const db = setupDb();
    const project = createProject(db, { name: 'Test', description: 'desc' }) as any;
    const pid = project.id;

    // seed related records
    db.prepare("INSERT INTO team_members (id, project_id, role) VALUES ('m1', ?, 'backend_developer')").run(pid);
    db.prepare("INSERT INTO tasks (id, project_id, assignee_id, title, description) VALUES ('t1', ?, 'm1', 'Task', 'desc')").run(pid);
    db.prepare("INSERT INTO work_entries (id, task_id, member_id, entry_type, content) VALUES ('w1', 't1', 'm1', 'note', 'work')").run();
    db.prepare("INSERT INTO task_comments (id, task_id, member_id, content) VALUES ('c1', 't1', 'm1', 'comment')").run();
    db.prepare("INSERT INTO discussions (id, project_id, topic, created_by) VALUES ('d1', ?, 'topic', 'm1')").run(pid);
    db.prepare("INSERT INTO discussion_participants (discussion_id, member_id) VALUES ('d1', 'm1')").run();
    db.prepare("INSERT INTO discussion_messages (id, discussion_id, member_id, content) VALUES ('dm1', 'd1', 'm1', 'msg')").run();
    db.prepare("INSERT INTO decisions (id, project_id, member_id, title, rationale) VALUES ('dec1', ?, 'm1', 'Dec', 'Why')").run(pid);
    db.prepare("INSERT INTO shared_artifacts (id, project_id, member_id, title, artifact_type, content) VALUES ('a1', ?, 'm1', 'Art', 'research', '{}')").run(pid);
    db.prepare("INSERT INTO project_summaries (id, project_id, content, version) VALUES ('s1', ?, 'summary', 1)").run(pid);
    db.prepare("INSERT INTO user_journal (id, project_id, author, entry) VALUES ('j1', ?, 'pm', 'entry')").run(pid);
    db.prepare("INSERT INTO user_questions (id, project_id, member_id, question) VALUES ('q1', ?, 'm1', 'question')").run(pid);
    db.prepare("INSERT INTO expansion_requests (id, project_id, requested_by, role_needed, justification) VALUES ('e1', ?, 'm1', 'data_engineer', 'need help')").run(pid);

    const result = deleteProject(db, { project_id: pid }) as any;
    expect(result).toHaveProperty('deleted', true);
    expect(result.counts.projects).toBe(1);

    // verify everything is gone
    expect(db.prepare('SELECT * FROM projects WHERE id = ?').get(pid)).toBeUndefined();
    expect(db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(pid)).toHaveLength(0);
    expect(db.prepare('SELECT * FROM team_members WHERE project_id = ?').all(pid)).toHaveLength(0);
  });

  it('returns not found for invalid id', () => {
    const db = setupDb();
    const result = deleteProject(db, { project_id: 'nope' });
    expect(result).toHaveProperty('error');
  });
});
