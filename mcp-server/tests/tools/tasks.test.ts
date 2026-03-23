import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember } from '../../src/tools/team-members.js';
import { createTask, updateTask, getTask, listTasks } from '../../src/tools/tasks.js';

describe('Tasks Tools', () => {
  let db: Database.Database;
  let projectId: string;
  let memberId: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
    const member = addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
    memberId = member.id;
  });
  afterEach(() => { db.close(); });

  describe('create_task', () => {
    it('creates an assigned task', () => {
      const result = createTask(db, { project_id: projectId, title: 'Build API', description: 'REST endpoints', assignee_id: memberId });
      expect(result.title).toBe('Build API');
      expect(result.status).toBe('pending');
      expect(result.assignee_id).toBe(memberId);
    });

    it('creates an unassigned task', () => {
      const result = createTask(db, { project_id: projectId, title: 'Build API', description: 'REST endpoints' });
      expect(result.assignee_id).toBeNull();
    });
  });

  describe('update_task', () => {
    it('updates status', () => {
      const task = createTask(db, { project_id: projectId, title: 'T', description: 'D', assignee_id: memberId });
      const result = updateTask(db, { task_id: task.id, status: 'in_progress' });
      expect(result.status).toBe('in_progress');
    });

    it('reassigns task', () => {
      const member2 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      const task = createTask(db, { project_id: projectId, title: 'T', description: 'D', assignee_id: memberId });
      const result = updateTask(db, { task_id: task.id, assignee_id: member2.id });
      expect(result.assignee_id).toBe(member2.id);
    });

    it('rejects invalid status', () => {
      const task = createTask(db, { project_id: projectId, title: 'T', description: 'D' });
      const result = updateTask(db, { task_id: task.id, status: 'done' });
      expect(result.code).toBe('INVALID_INPUT');
    });
  });

  describe('get_task', () => {
    it('returns full task details', () => {
      const task = createTask(db, { project_id: projectId, title: 'Build API', description: 'REST endpoints', assignee_id: memberId });
      const result = getTask(db, { task_id: task.id });
      expect(result.title).toBe('Build API');
      expect(result.description).toBe('REST endpoints');
    });
  });

  describe('list_tasks', () => {
    it('filters by assignee', () => {
      const member2 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      createTask(db, { project_id: projectId, title: 'T1', description: 'D', assignee_id: memberId });
      createTask(db, { project_id: projectId, title: 'T2', description: 'D', assignee_id: member2.id });
      const result = listTasks(db, { project_id: projectId, assignee_id: memberId });
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('T1');
    });

    it('filters by status', () => {
      const t1 = createTask(db, { project_id: projectId, title: 'T1', description: 'D' });
      createTask(db, { project_id: projectId, title: 'T2', description: 'D' });
      updateTask(db, { task_id: t1.id, status: 'completed' });
      const result = listTasks(db, { project_id: projectId, status: 'pending' });
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('T2');
    });
  });
});
