import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember } from '../../src/tools/team-members.js';
import { createTask } from '../../src/tools/tasks.js';
import { logWork, getMyWork, getWorkHistory } from '../../src/tools/work-entries.js';

describe('Work Entries Tools', () => {
  let db: Database.Database;
  let projectId: string;
  let memberId: string;
  let taskId: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
    const member = addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
    memberId = member.id;
    const task = createTask(db, { project_id: projectId, title: 'T', description: 'D', assignee_id: memberId });
    taskId = task.id;
  });
  afterEach(() => { db.close(); });

  describe('log_work', () => {
    it('creates a work entry', () => {
      const result = logWork(db, { task_id: taskId, member_id: memberId, entry_type: 'code', content: 'Wrote the API endpoint' });
      expect(result.entry_type).toBe('code');
      expect(result.task_id).toBe(taskId);
    });

    it('rejects invalid entry type', () => {
      const result = logWork(db, { task_id: taskId, member_id: memberId, entry_type: 'decision', content: 'Bad' });
      expect(result.code).toBe('INVALID_INPUT');
    });
  });

  describe('get_my_work', () => {
    it('returns only entries for the specified member', () => {
      const member2 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      const task2 = createTask(db, { project_id: projectId, title: 'T2', description: 'D', assignee_id: member2.id });
      logWork(db, { task_id: taskId, member_id: memberId, entry_type: 'code', content: 'My work' });
      logWork(db, { task_id: task2.id, member_id: member2.id, entry_type: 'note', content: 'Their work' });

      const result = getMyWork(db, { member_id: memberId });
      expect(result.length).toBe(1);
      expect(result[0].content).toBe('My work');
    });

    it('filters by task_id', () => {
      const task2 = createTask(db, { project_id: projectId, title: 'T2', description: 'D', assignee_id: memberId });
      logWork(db, { task_id: taskId, member_id: memberId, entry_type: 'code', content: 'Work 1' });
      logWork(db, { task_id: task2.id, member_id: memberId, entry_type: 'note', content: 'Work 2' });

      const result = getMyWork(db, { member_id: memberId, task_id: taskId });
      expect(result.length).toBe(1);
      expect(result[0].content).toBe('Work 1');
    });
  });

  describe('get_work_history', () => {
    it('returns all work entries for a member across a project', () => {
      const task2 = createTask(db, { project_id: projectId, title: 'T2', description: 'D', assignee_id: memberId });
      logWork(db, { task_id: taskId, member_id: memberId, entry_type: 'code', content: 'W1' });
      logWork(db, { task_id: task2.id, member_id: memberId, entry_type: 'note', content: 'W2' });

      const result = getWorkHistory(db, { member_id: memberId, project_id: projectId });
      expect(result.length).toBe(2);
    });
  });
});
