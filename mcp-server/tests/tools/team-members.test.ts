import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember, removeTeamMember, listTeamMembers } from '../../src/tools/team-members.js';

describe('Team Members Tools', () => {
  let db: Database.Database;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
  });
  afterEach(() => { db.close(); });

  describe('add_team_member', () => {
    it('adds a member with a valid role', () => {
      const result = addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
      expect(result.role).toBe('backend_developer');
      expect(result.id).toBeTruthy();
      expect(result.project_id).toBe(projectId);
    });

    it('rejects invalid role', () => {
      const result = addTeamMember(db, { project_id: projectId, role: 'wizard' });
      expect(result.code).toBe('INVALID_INPUT');
    });
  });

  describe('remove_team_member', () => {
    it('sets removed_at timestamp', () => {
      const member = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      const result = removeTeamMember(db, { member_id: member.id });
      expect(result.removed_at).toBeTruthy();
    });

    it('returns NOT_FOUND for missing member', () => {
      const result = removeTeamMember(db, { member_id: 'nonexistent' });
      expect(result.code).toBe('NOT_FOUND');
    });
  });

  describe('list_team_members', () => {
    it('lists active members by default', () => {
      addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
      const removed = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      removeTeamMember(db, { member_id: removed.id });

      const result = listTeamMembers(db, { project_id: projectId });
      expect(result.length).toBe(1);
      expect(result[0].role).toBe('backend_developer');
    });

    it('lists all members when active_only is false', () => {
      addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
      const removed = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      removeTeamMember(db, { member_id: removed.id });

      const result = listTeamMembers(db, { project_id: projectId, active_only: false });
      expect(result.length).toBe(2);
    });
  });
});
