import crypto from 'crypto';
import { validateRequired, validateRole, notFound } from '../validation.js';
export function addTeamMember(db, input) {
    const idErr = validateRequired(input.project_id, 'project_id');
    if (idErr)
        return idErr;
    const roleErr = validateRole(input.role);
    if (roleErr)
        return roleErr;
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(input.project_id);
    if (!project)
        return notFound('Project', input.project_id);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO team_members (id, project_id, role, joined_at) VALUES (?, ?, ?, ?)').run(id, input.project_id, input.role, now);
    return { id, project_id: input.project_id, role: input.role, joined_at: now };
}
export function removeTeamMember(db, input) {
    const err = validateRequired(input.member_id, 'member_id');
    if (err)
        return err;
    const member = db.prepare('SELECT id FROM team_members WHERE id = ?').get(input.member_id);
    if (!member)
        return notFound('Team member', input.member_id);
    const now = new Date().toISOString();
    db.prepare('UPDATE team_members SET removed_at = ? WHERE id = ?').run(now, input.member_id);
    return { id: input.member_id, removed_at: now };
}
export function listTeamMembers(db, input) {
    const err = validateRequired(input.project_id, 'project_id');
    if (err)
        return err;
    const activeOnly = input.active_only !== false;
    if (activeOnly) {
        return db.prepare('SELECT id, role, joined_at, removed_at FROM team_members WHERE project_id = ? AND removed_at IS NULL ORDER BY joined_at').all(input.project_id);
    }
    return db.prepare('SELECT id, role, joined_at, removed_at FROM team_members WHERE project_id = ? ORDER BY joined_at').all(input.project_id);
}
//# sourceMappingURL=team-members.js.map