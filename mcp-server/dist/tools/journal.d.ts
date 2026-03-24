import type Database from 'better-sqlite3';
export declare function logJournalEntry(db: Database.Database, input: {
    project_id?: string;
    entry: string;
    author?: string;
}): {
    id: `${string}-${string}-${string}-${string}-${string}`;
    project_id: string | null;
    author: string;
    entry: string;
};
export declare function listJournalEntries(db: Database.Database, input: {
    project_id?: string;
}): unknown[];
