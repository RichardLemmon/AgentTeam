import { randomUUID } from 'crypto';
import { validateRequired, notFound } from '../validation.js';
export function requestTeamExpansion(db, input) {
    const projErr = validateRequired(input.project_id, 'project_id');
    if (projErr)
        return projErr;
    const byErr = validateRequired(input.requested_by, 'requested_by');
    if (byErr)
        return byErr;
    const roleErr = validateRequired(input.role_needed, 'role_needed');
    if (roleErr)
        return roleErr;
    const justErr = validateRequired(input.justification, 'justification');
    if (justErr)
        return justErr;
    const id = randomUUID();
    db.prepare('INSERT INTO expansion_requests (id, project_id, requested_by, role_needed, justification) VALUES (?, ?, ?, ?, ?)').run(id, input.project_id, input.requested_by, input.role_needed, input.justification);
    return { id, project_id: input.project_id, requested_by: input.requested_by, role_needed: input.role_needed, justification: input.justification, status: 'pending' };
}
export function listExpansionRequests(db, input) {
    const projErr = validateRequired(input.project_id, 'project_id');
    if (projErr)
        return projErr;
    if (input.status) {
        return db.prepare('SELECT * FROM expansion_requests WHERE project_id = ? AND status = ? ORDER BY created_at ASC').all(input.project_id, input.status);
    }
    return db.prepare('SELECT * FROM expansion_requests WHERE project_id = ? ORDER BY created_at ASC').all(input.project_id);
}
export function resolveExpansionRequest(db, input) {
    const idErr = validateRequired(input.request_id, 'request_id');
    if (idErr)
        return idErr;
    const row = db.prepare('SELECT * FROM expansion_requests WHERE id = ?').get(input.request_id);
    if (!row)
        return notFound('ExpansionRequest', input.request_id);
    const now = new Date().toISOString();
    db.prepare('UPDATE expansion_requests SET status = ?, resolution_note = ?, resolved_at = ? WHERE id = ?').run(input.status, input.resolution_note ?? null, now, input.request_id);
    return { id: input.request_id, status: input.status, resolution_note: input.resolution_note ?? null, resolved_at: now };
}
//# sourceMappingURL=expansion-requests.js.map