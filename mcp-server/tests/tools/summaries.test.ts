import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { getProjectSummary, updateProjectSummary, getSummaryVersion, listSummaryHistory } from '../../src/tools/summaries.js';

describe('Summaries Tools', () => {
  let db: Database.Database;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
  });
  afterEach(() => { db.close(); });

  describe('update_project_summary', () => {
    it('creates first summary with version 1', () => {
      const result = updateProjectSummary(db, { project_id: projectId, content: 'Initial summary' });
      expect(result.version).toBe(1);
      expect(result.project_id).toBe(projectId);
    });

    it('increments version on subsequent updates', () => {
      updateProjectSummary(db, { project_id: projectId, content: 'V1' });
      const result = updateProjectSummary(db, { project_id: projectId, content: 'V2' });
      expect(result.version).toBe(2);
    });
  });

  describe('get_project_summary', () => {
    it('returns latest version', () => {
      updateProjectSummary(db, { project_id: projectId, content: 'V1' });
      updateProjectSummary(db, { project_id: projectId, content: 'V2' });
      const result = getProjectSummary(db, { project_id: projectId });
      expect(result.content).toBe('V2');
      expect(result.version).toBe(2);
    });

    it('returns NOT_FOUND when no summary exists', () => {
      const result = getProjectSummary(db, { project_id: projectId });
      expect(result.code).toBe('NOT_FOUND');
    });
  });

  describe('get_summary_version', () => {
    it('retrieves a specific historical version', () => {
      const v1 = updateProjectSummary(db, { project_id: projectId, content: 'V1' });
      updateProjectSummary(db, { project_id: projectId, content: 'V2' });
      const result = getSummaryVersion(db, { summary_id: v1.id });
      expect(result.content).toBe('V1');
      expect(result.version).toBe(1);
    });
  });

  describe('list_summary_history', () => {
    it('returns all versions ordered by version desc', () => {
      updateProjectSummary(db, { project_id: projectId, content: 'V1' });
      updateProjectSummary(db, { project_id: projectId, content: 'V2' });
      updateProjectSummary(db, { project_id: projectId, content: 'V3' });
      const result = listSummaryHistory(db, { project_id: projectId });
      expect(result.length).toBe(3);
      expect(result[0].version).toBe(3);
      expect(result[2].version).toBe(1);
    });
  });
});
