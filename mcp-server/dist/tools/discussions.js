import crypto from 'crypto';
import { validateRequired, notFound } from '../validation.js';
import { ERROR_CODES } from '../constants.js';
export function createDiscussion(db, input) {
    const projErr = validateRequired(input.project_id, 'project_id');
    if (projErr)
        return projErr;
    const topicErr = validateRequired(input.topic, 'topic');
    if (topicErr)
        return topicErr;
    const creatorErr = validateRequired(input.created_by, 'created_by');
    if (creatorErr)
        return creatorErr;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const insertDiscussion = db.transaction(() => {
        db.prepare('INSERT INTO discussions (id, project_id, topic, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, input.project_id, input.topic, input.created_by, now, now);
        db.prepare('INSERT INTO discussion_participants (discussion_id, member_id, joined_at) VALUES (?, ?, ?)').run(id, input.created_by, now);
        const allIds = new Set(input.participant_ids);
        allIds.delete(input.created_by);
        for (const memberId of allIds) {
            db.prepare('INSERT INTO discussion_participants (discussion_id, member_id, joined_at) VALUES (?, ?, ?)').run(id, memberId, now);
        }
    });
    insertDiscussion();
    return { id, project_id: input.project_id, topic: input.topic, created_at: now };
}
export function addDiscussionParticipant(db, input) {
    const discErr = validateRequired(input.discussion_id, 'discussion_id');
    if (discErr)
        return discErr;
    const memberErr = validateRequired(input.member_id, 'member_id');
    if (memberErr)
        return memberErr;
    const disc = db.prepare('SELECT id FROM discussions WHERE id = ?').get(input.discussion_id);
    if (!disc)
        return notFound('Discussion', input.discussion_id);
    const now = new Date().toISOString();
    db.prepare('INSERT OR IGNORE INTO discussion_participants (discussion_id, member_id, joined_at) VALUES (?, ?, ?)').run(input.discussion_id, input.member_id, now);
    return { discussion_id: input.discussion_id, member_id: input.member_id, joined_at: now };
}
export function addDiscussionMessage(db, input) {
    const discErr = validateRequired(input.discussion_id, 'discussion_id');
    if (discErr)
        return discErr;
    const memberErr = validateRequired(input.member_id, 'member_id');
    if (memberErr)
        return memberErr;
    const contentErr = validateRequired(input.content, 'content');
    if (contentErr)
        return contentErr;
    const participant = db.prepare('SELECT member_id FROM discussion_participants WHERE discussion_id = ? AND member_id = ?').get(input.discussion_id, input.member_id);
    if (!participant) {
        return { error: `Member ${input.member_id} is not a participant of discussion ${input.discussion_id}`, code: ERROR_CODES.INVALID_INPUT };
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO discussion_messages (id, discussion_id, member_id, content, created_at) VALUES (?, ?, ?, ?, ?)').run(id, input.discussion_id, input.member_id, input.content, now);
    db.prepare('UPDATE discussions SET updated_at = ? WHERE id = ?').run(now, input.discussion_id);
    return { id, discussion_id: input.discussion_id, member_id: input.member_id, created_at: now };
}
export function updateDiscussionSummary(db, input) {
    const discErr = validateRequired(input.discussion_id, 'discussion_id');
    if (discErr)
        return discErr;
    const summaryErr = validateRequired(input.summary, 'summary');
    if (summaryErr)
        return summaryErr;
    const disc = db.prepare('SELECT id FROM discussions WHERE id = ?').get(input.discussion_id);
    if (!disc)
        return notFound('Discussion', input.discussion_id);
    const now = new Date().toISOString();
    db.prepare('UPDATE discussions SET summary = ?, updated_at = ? WHERE id = ?').run(input.summary, now, input.discussion_id);
    return { discussion_id: input.discussion_id, updated_at: now };
}
export function getDiscussion(db, input) {
    const err = validateRequired(input.discussion_id, 'discussion_id');
    if (err)
        return err;
    const disc = db.prepare('SELECT * FROM discussions WHERE id = ?').get(input.discussion_id);
    if (!disc)
        return notFound('Discussion', input.discussion_id);
    const participants = db.prepare('SELECT member_id, joined_at FROM discussion_participants WHERE discussion_id = ? ORDER BY joined_at').all(input.discussion_id);
    const messages = db.prepare('SELECT id, member_id, content, created_at FROM discussion_messages WHERE discussion_id = ? ORDER BY created_at').all(input.discussion_id);
    return {
        id: disc.id, topic: disc.topic, summary: disc.summary, created_by: disc.created_by,
        participants, messages, created_at: disc.created_at, updated_at: disc.updated_at,
    };
}
export function listDiscussions(db, input) {
    const err = validateRequired(input.project_id, 'project_id');
    if (err)
        return err;
    if (input.participant_id) {
        return db.prepare(`SELECT d.id, d.topic, d.created_by, d.created_at, d.updated_at
       FROM discussions d
       JOIN discussion_participants dp ON d.id = dp.discussion_id
       WHERE d.project_id = ? AND dp.member_id = ?
       ORDER BY d.updated_at DESC`).all(input.project_id, input.participant_id);
    }
    return db.prepare('SELECT id, topic, created_by, created_at, updated_at FROM discussions WHERE project_id = ? ORDER BY updated_at DESC').all(input.project_id);
}
//# sourceMappingURL=discussions.js.map