import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember } from '../../src/tools/team-members.js';
import { shareArtifact, updateArtifact, listArtifacts, getArtifact } from '../../src/tools/artifacts.js';

describe('Artifacts Tools', () => {
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

  describe('share_artifact', () => {
    it('creates a shared artifact', () => {
      const result = shareArtifact(db, {
        project_id: projectId, member_id: memberId,
        title: 'User API Spec', artifact_type: 'api_spec',
        content: 'GET /users - returns list of users',
      });
      expect(result.title).toBe('User API Spec');
      expect(result.artifact_type).toBe('api_spec');
    });
  });

  describe('update_artifact', () => {
    it('updates content', () => {
      const art = shareArtifact(db, {
        project_id: projectId, member_id: memberId,
        title: 'Spec', artifact_type: 'api_spec', content: 'V1',
      });
      const result = updateArtifact(db, { artifact_id: art.id, content: 'V2' });
      expect(result.updated_at).toBeTruthy();

      const full = getArtifact(db, { artifact_id: art.id });
      expect(full.content).toBe('V2');
    });

    it('updates title optionally', () => {
      const art = shareArtifact(db, {
        project_id: projectId, member_id: memberId,
        title: 'Old Title', artifact_type: 'api_spec', content: 'Content',
      });
      updateArtifact(db, { artifact_id: art.id, content: 'Content', title: 'New Title' });
      const full = getArtifact(db, { artifact_id: art.id });
      expect(full.title).toBe('New Title');
    });
  });

  describe('list_artifacts', () => {
    it('lists all artifacts for a project', () => {
      shareArtifact(db, { project_id: projectId, member_id: memberId, title: 'A1', artifact_type: 'api_spec', content: 'C1' });
      shareArtifact(db, { project_id: projectId, member_id: memberId, title: 'A2', artifact_type: 'test_plan', content: 'C2' });
      const result = listArtifacts(db, { project_id: projectId });
      expect(result.length).toBe(2);
    });

    it('filters by artifact_type', () => {
      shareArtifact(db, { project_id: projectId, member_id: memberId, title: 'A1', artifact_type: 'api_spec', content: 'C1' });
      shareArtifact(db, { project_id: projectId, member_id: memberId, title: 'A2', artifact_type: 'test_plan', content: 'C2' });
      const result = listArtifacts(db, { project_id: projectId, artifact_type: 'api_spec' });
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('A1');
    });
  });

  describe('get_artifact', () => {
    it('returns full artifact details', () => {
      const art = shareArtifact(db, {
        project_id: projectId, member_id: memberId,
        title: 'Spec', artifact_type: 'api_spec', content: 'Full content here',
      });
      const result = getArtifact(db, { artifact_id: art.id });
      expect(result.content).toBe('Full content here');
      expect(result.member_id).toBe(memberId);
    });

    it('returns NOT_FOUND for missing artifact', () => {
      const result = getArtifact(db, { artifact_id: 'nonexistent' });
      expect(result.code).toBe('NOT_FOUND');
    });
  });
});
