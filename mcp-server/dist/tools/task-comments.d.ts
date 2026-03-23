import type Database from 'better-sqlite3';
export declare function addTaskComment(db: Database.Database, input: {
    task_id: string;
    member_id: string;
    content: string;
}): import("../validation.js").ToolError | {
    id: `${string}-${string}-${string}-${string}-${string}`;
    task_id: string;
    member_id: string;
    created_at: string;
};
export declare function listTaskComments(db: Database.Database, input: {
    task_id: string;
}): unknown[] | import("../validation.js").ToolError;
export declare function listMyComments(db: Database.Database, input: {
    member_id: string;
    project_id: string;
}): unknown[] | import("../validation.js").ToolError;
