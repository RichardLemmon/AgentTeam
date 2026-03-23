import type Database from 'better-sqlite3';
export declare function createTask(db: Database.Database, input: {
    project_id: string;
    title: string;
    description: string;
    assignee_id?: string;
}): import("../validation.js").ToolError | {
    id: `${string}-${string}-${string}-${string}-${string}`;
    project_id: string;
    assignee_id: string | null;
    title: string;
    status: string;
    created_at: string;
};
export declare function updateTask(db: Database.Database, input: {
    task_id: string;
    status?: string;
    description?: string;
    assignee_id?: string;
}): import("../validation.js").ToolError | {
    id: string;
    status: any;
    assignee_id: any;
    updated_at: string;
};
export declare function getTask(db: Database.Database, input: {
    task_id: string;
}): import("../validation.js").ToolError | {
    id: any;
    project_id: any;
    assignee_id: any;
    title: any;
    description: any;
    status: any;
    created_at: any;
    updated_at: any;
};
export declare function listTasks(db: Database.Database, input: {
    project_id: string;
    assignee_id?: string;
    status?: string;
}): unknown[] | import("../validation.js").ToolError;
