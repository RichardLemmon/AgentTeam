import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember } from '../../src/tools/team-members.js';
import { logDecision, listDecisions, getDecision } from '../../src/tools/decisions.js';

describe('Decisions Tools', () => {
  let db: Database.Database;
  let projectId: string;
  let memberId: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
    const member = addTeamMember(db, { project_id: projectId, role: 'project_manager' });
    memberId = member.id;
  });
  afterEach(() => { db.close(); });

  describe('log_decision', () => {
    it('records a decision with rationale', () => {
      const result = logDecision(db, {
        project_id: projectId, member_id: memberId,
        title: 'Use REST over GraphQL',
        rationale: 'Simpler for our use case',
        context: 'Considered GraphQL but team has more REST experience',
      });
      expect(result.title).toBe('Use REST over GraphQL');
    });

    it('allows optional context', () => {
      const result = logDecision(db, {
        project_id: projectId, member_id: memberId,
        title: 'Use TypeScript', rationale: 'Type safety',
      });
      expect(result.title).toBe('Use TypeScript');
    });
  });

  describe('list_decisions', () => {
    it('lists all decisions for a project', () => {
      logDecision(db, { project_id: projectId, member_id: memberId, title: 'D1', rationale: 'R1' });
      logDecision(db, { project_id: projectId, member_id: memberId, title: 'D2', rationale: 'R2' });
      const result = listDecisions(db, { project_id: projectId });
      expect(result.length).toBe(2);
    });
  });

  describe('get_decision', () => {
    it('returns full decision details', () => {
      const dec = logDecision(db, {
        project_id: projectId, member_id: memberId,
        title: 'Use REST', rationale: 'Simplicity', context: 'Considered GraphQL',
      });
      const result = getDecision(db, { decision_id: dec.id });
      expect(result.rationale).toBe('Simplicity');
      expect(result.context).toBe('Considered GraphQL');
    });

    it('returns NOT_FOUND for missing decision', () => {
      const result = getDecision(db, { decision_id: 'nonexistent' });
      expect(result.code).toBe('NOT_FOUND');
    });
  });
});
