import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../../db/schema.js';
import { requestTeamExpansion, listExpansionRequests, resolveExpansionRequest } from '../expansion-requests.js';
function setupDb() {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
    db.prepare("INSERT INTO projects (id, name, description) VALUES ('p1', 'Test', 'desc')").run();
    db.prepare("INSERT INTO team_members (id, project_id, role) VALUES ('m1', 'p1', 'backend_developer')").run();
    return db;
}
describe('requestTeamExpansion', () => {
    it('creates a pending expansion request', () => {
        const db = setupDb();
        const result = requestTeamExpansion(db, {
            project_id: 'p1',
            requested_by: 'm1',
            role_needed: 'data_engineer',
            justification: 'Database migration is more complex than expected',
        });
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('status', 'pending');
        expect(result).toHaveProperty('role_needed', 'data_engineer');
    });
});
describe('listExpansionRequests', () => {
    it('filters by status', () => {
        const db = setupDb();
        requestTeamExpansion(db, { project_id: 'p1', requested_by: 'm1', role_needed: 'data_engineer', justification: 'Need help' });
        const pending = listExpansionRequests(db, { project_id: 'p1', status: 'pending' });
        expect(pending).toHaveLength(1);
        const approved = listExpansionRequests(db, { project_id: 'p1', status: 'approved' });
        expect(approved).toHaveLength(0);
    });
});
describe('resolveExpansionRequest', () => {
    it('approves a request', () => {
        const db = setupDb();
        const req = requestTeamExpansion(db, { project_id: 'p1', requested_by: 'm1', role_needed: 'data_engineer', justification: 'Need help' });
        const result = resolveExpansionRequest(db, { request_id: req.id, status: 'approved', resolution_note: 'Good call' });
        expect(result).toHaveProperty('status', 'approved');
        expect(result).toHaveProperty('resolved_at');
    });
    it('denies a request', () => {
        const db = setupDb();
        const req = requestTeamExpansion(db, { project_id: 'p1', requested_by: 'm1', role_needed: 'data_engineer', justification: 'Need help' });
        const result = resolveExpansionRequest(db, { request_id: req.id, status: 'denied', resolution_note: 'Covered by existing scope' });
        expect(result).toHaveProperty('status', 'denied');
    });
    it('returns not found for invalid id', () => {
        const db = setupDb();
        const result = resolveExpansionRequest(db, { request_id: 'nope', status: 'approved' });
        expect(result).toHaveProperty('error');
    });
});
//# sourceMappingURL=expansion-requests.test.js.map