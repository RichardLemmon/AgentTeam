import type Database from 'better-sqlite3';
export declare function logWork(db: Database.Database, input: {
    task_id: string;
    member_id: string;
    entry_type: string;
    content: string;
}): import("../validation.js").ToolError | {
    id: `${string}-${string}-${string}-${string}-${string}`;
    task_id: string;
    member_id: string;
    entry_type: string;
    created_at: string;
};
export declare function getMyWork(db: Database.Database, input: {
    member_id: string;
    task_id?: string;
}): unknown[] | import("../validation.js").ToolError;
export declare function getWorkHistory(db: Database.Database, input: {
    member_id: string;
    project_id: string;
}): unknown[] | import("../validation.js").ToolError;
