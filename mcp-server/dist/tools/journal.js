import { randomUUID } from 'crypto';
export function logJournalEntry(db, input) {
    const id = randomUUID();
    const author = input.author ?? 'user';
    const project_id = input.project_id ?? null;
    db.prepare('INSERT INTO user_journal (id, project_id, author, entry) VALUES (?, ?, ?, ?)').run(id, project_id, author, input.entry);
    return { id, project_id, author, entry: input.entry };
}
export function listJournalEntries(db, input) {
    if (input.project_id) {
        return db
            .prepare('SELECT * FROM user_journal WHERE project_id = ? ORDER BY created_at ASC')
            .all(input.project_id);
    }
    return db
        .prepare('SELECT * FROM user_journal ORDER BY created_at ASC')
        .all();
}
//# sourceMappingURL=journal.js.map