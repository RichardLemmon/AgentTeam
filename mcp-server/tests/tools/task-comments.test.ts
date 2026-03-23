import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember } from '../../src/tools/team-members.js';
import { createTask } from '../../src/tools/tasks.js';
import { addTaskComment, listTaskComments, listMyComments } from '../../src/tools/task-comments.js';

describe('Task Comments Tools', () => {
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

  describe('add_task_comment', () => {
    it('adds a comment to a task', () => {
      const result = addTaskComment(db, { task_id: taskId, member_id: memberId, content: 'Found an edge case' });
      expect(result.task_id).toBe(taskId);
      expect(result.member_id).toBe(memberId);
    });
  });

  describe('list_task_comments', () => {
    it('returns all comments on a task', () => {
      const member2 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      addTaskComment(db, { task_id: taskId, member_id: memberId, content: 'C1' });
      addTaskComment(db, { task_id: taskId, member_id: member2.id, content: 'C2' });
      const result = listTaskComments(db, { task_id: taskId });
      expect(result.length).toBe(2);
    });
  });

  describe('list_my_comments', () => {
    it('returns only my comments across a project', () => {
      const task2 = createTask(db, { project_id: projectId, title: 'T2', description: 'D' });
      const member2 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      addTaskComment(db, { task_id: taskId, member_id: memberId, content: 'Mine' });
      addTaskComment(db, { task_id: task2.id, member_id: memberId, content: 'Also mine' });
      addTaskComment(db, { task_id: taskId, member_id: member2.id, content: 'Not mine' });

      const result = listMyComments(db, { member_id: memberId, project_id: projectId });
      expect(result.length).toBe(2);
    });
  });
});
