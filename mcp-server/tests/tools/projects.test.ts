import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject, getProject, updateProjectStatus, listProjects } from '../../src/tools/projects.js';

describe('Projects Tools', () => {
  let db: Database.Database;

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  describe('create_project', () => {
    it('creates a project with active status', () => {
      const result = createProject(db, { name: 'Test Project', description: 'A test' });
      expect(result.name).toBe('Test Project');
      expect(result.description).toBe('A test');
      expect(result.status).toBe('active');
      expect(result.id).toBeTruthy();
      expect(result.created_at).toBeTruthy();
    });

    it('rejects empty name', () => {
      const result = createProject(db, { name: '', description: 'A test' });
      expect(result.code).toBe('INVALID_INPUT');
    });
  });

  describe('get_project', () => {
    it('returns a project by ID', () => {
      const created = createProject(db, { name: 'Test', description: 'Desc' });
      const result = getProject(db, { project_id: created.id });
      expect(result.name).toBe('Test');
    });

    it('returns NOT_FOUND for missing project', () => {
      const result = getProject(db, { project_id: 'nonexistent' });
      expect(result.code).toBe('NOT_FOUND');
    });
  });

  describe('update_project_status', () => {
    it('transitions active to paused', () => {
      const created = createProject(db, { name: 'Test', description: 'Desc' });
      const result = updateProjectStatus(db, { project_id: created.id, status: 'paused' });
      expect(result.status).toBe('paused');
    });

    it('rejects invalid transition from closed', () => {
      const created = createProject(db, { name: 'Test', description: 'Desc' });
      updateProjectStatus(db, { project_id: created.id, status: 'closed' });
      const result = updateProjectStatus(db, { project_id: created.id, status: 'active' });
      expect(result.code).toBe('INVALID_TRANSITION');
    });

    it('allows archived to active (reopen)', () => {
      const created = createProject(db, { name: 'Test', description: 'Desc' });
      updateProjectStatus(db, { project_id: created.id, status: 'archived' });
      const result = updateProjectStatus(db, { project_id: created.id, status: 'active' });
      expect(result.status).toBe('active');
    });
  });

  describe('list_projects', () => {
    it('lists all projects', () => {
      createProject(db, { name: 'P1', description: 'D1' });
      createProject(db, { name: 'P2', description: 'D2' });
      const result = listProjects(db, {});
      expect(result.length).toBe(2);
    });

    it('filters by status', () => {
      createProject(db, { name: 'P1', description: 'D1' });
      const p2 = createProject(db, { name: 'P2', description: 'D2' });
      updateProjectStatus(db, { project_id: p2.id, status: 'paused' });
      const result = listProjects(db, { status: 'active' });
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('P1');
    });
  });
});
