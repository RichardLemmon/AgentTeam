import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../../db/schema.js';
import { askUserQuestion, listUserQuestions, answerUserQuestion } from '../user-questions.js';
function setupDb() {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
    // seed a project and team member
    db.prepare("INSERT INTO projects (id, name, description) VALUES ('p1', 'Test', 'desc')").run();
    db.prepare("INSERT INTO team_members (id, project_id, role) VALUES ('m1', 'p1', 'backend_developer')").run();
    return db;
}
describe('askUserQuestion', () => {
    it('creates a pending question', () => {
        const db = setupDb();
        const result = askUserQuestion(db, { project_id: 'p1', member_id: 'm1', question: 'Which framework?', context: 'Choosing between Express and Fastify' });
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('status', 'pending');
        expect(result).toHaveProperty('question', 'Which framework?');
    });
});
describe('listUserQuestions', () => {
    it('filters by status', () => {
        const db = setupDb();
        askUserQuestion(db, { project_id: 'p1', member_id: 'm1', question: 'Q1' });
        askUserQuestion(db, { project_id: 'p1', member_id: 'm1', question: 'Q2' });
        const pending = listUserQuestions(db, { project_id: 'p1', status: 'pending' });
        expect(pending).toHaveLength(2);
        const answered = listUserQuestions(db, { project_id: 'p1', status: 'answered' });
        expect(answered).toHaveLength(0);
    });
    it('returns all when no status filter', () => {
        const db = setupDb();
        askUserQuestion(db, { project_id: 'p1', member_id: 'm1', question: 'Q1' });
        const all = listUserQuestions(db, { project_id: 'p1' });
        expect(all).toHaveLength(1);
    });
});
describe('answerUserQuestion', () => {
    it('sets answer and status to answered', () => {
        const db = setupDb();
        const q = askUserQuestion(db, { project_id: 'p1', member_id: 'm1', question: 'Q1' });
        const result = answerUserQuestion(db, { question_id: q.id, answer: 'Use Express' });
        expect(result).toHaveProperty('status', 'answered');
        expect(result).toHaveProperty('answer', 'Use Express');
        expect(result).toHaveProperty('answered_at');
    });
    it('returns not found for invalid id', () => {
        const db = setupDb();
        const result = answerUserQuestion(db, { question_id: 'nope', answer: 'test' });
        expect(result).toHaveProperty('error');
    });
});
//# sourceMappingURL=user-questions.test.js.map