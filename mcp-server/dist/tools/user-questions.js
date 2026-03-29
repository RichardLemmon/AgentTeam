import { randomUUID } from 'crypto';
import { validateRequired, notFound } from '../validation.js';
export function askUserQuestion(db, input) {
    const projErr = validateRequired(input.project_id, 'project_id');
    if (projErr)
        return projErr;
    const memErr = validateRequired(input.member_id, 'member_id');
    if (memErr)
        return memErr;
    const qErr = validateRequired(input.question, 'question');
    if (qErr)
        return qErr;
    const id = randomUUID();
    db.prepare('INSERT INTO user_questions (id, project_id, member_id, question, context) VALUES (?, ?, ?, ?, ?)').run(id, input.project_id, input.member_id, input.question, input.context ?? null);
    return { id, project_id: input.project_id, member_id: input.member_id, question: input.question, context: input.context ?? null, status: 'pending' };
}
export function listUserQuestions(db, input) {
    const projErr = validateRequired(input.project_id, 'project_id');
    if (projErr)
        return projErr;
    if (input.status) {
        return db.prepare('SELECT * FROM user_questions WHERE project_id = ? AND status = ? ORDER BY created_at ASC').all(input.project_id, input.status);
    }
    return db.prepare('SELECT * FROM user_questions WHERE project_id = ? ORDER BY created_at ASC').all(input.project_id);
}
export function answerUserQuestion(db, input) {
    const idErr = validateRequired(input.question_id, 'question_id');
    if (idErr)
        return idErr;
    const ansErr = validateRequired(input.answer, 'answer');
    if (ansErr)
        return ansErr;
    const row = db.prepare('SELECT * FROM user_questions WHERE id = ?').get(input.question_id);
    if (!row)
        return notFound('UserQuestion', input.question_id);
    const now = new Date().toISOString();
    db.prepare('UPDATE user_questions SET answer = ?, status = ?, answered_at = ? WHERE id = ?').run(input.answer, 'answered', now, input.question_id);
    return { id: input.question_id, status: 'answered', answer: input.answer, answered_at: now };
}
//# sourceMappingURL=user-questions.js.map