import crypto from 'crypto';
import { validateRequired, validateProjectStatus, validateProjectTransition, notFound, } from '../validation.js';
export function createProject(db, input) {
    const nameErr = validateRequired(input.name, 'name');
    if (nameErr)
        return nameErr;
    const descErr = validateRequired(input.description, 'description');
    if (descErr)
        return descErr;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO projects (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, input.name, input.description, 'active', now, now);
    return { id, name: input.name, description: input.description, status: 'active', created_at: now };
}
export function getProject(db, input) {
    const err = validateRequired(input.project_id, 'project_id');
    if (err)
        return err;
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(input.project_id);
    if (!row)
        return notFound('Project', input.project_id);
    return { id: row.id, name: row.name, description: row.description, status: row.status, created_at: row.created_at, updated_at: row.updated_at };
}
export function updateProjectStatus(db, input) {
    const idErr = validateRequired(input.project_id, 'project_id');
    if (idErr)
        return idErr;
    const statusErr = validateProjectStatus(input.status);
    if (statusErr)
        return statusErr;
    const project = db.prepare('SELECT status FROM projects WHERE id = ?').get(input.project_id);
    if (!project)
        return notFound('Project', input.project_id);
    const transErr = validateProjectTransition(project.status, input.status);
    if (transErr)
        return transErr;
    const now = new Date().toISOString();
    db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run(input.status, now, input.project_id);
    return { id: input.project_id, status: input.status, updated_at: now };
}
export function listProjects(db, input) {
    if (input.status !== undefined) {
        const statusErr = validateProjectStatus(input.status);
        if (statusErr)
            return statusErr;
        return db.prepare('SELECT id, name, status, created_at, updated_at FROM projects WHERE status = ? ORDER BY created_at DESC').all(input.status);
    }
    return db.prepare('SELECT id, name, status, created_at, updated_at FROM projects ORDER BY created_at DESC').all();
}
//# sourceMappingURL=projects.js.map