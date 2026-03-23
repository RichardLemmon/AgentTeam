import type Database from 'better-sqlite3';
export declare function updateProjectSummary(db: Database.Database, input: {
    project_id: string;
    content: string;
}): import("../validation.js").ToolError | {
    id: `${string}-${string}-${string}-${string}-${string}`;
    project_id: string;
    version: number;
    created_at: string;
};
export declare function getProjectSummary(db: Database.Database, input: {
    project_id: string;
}): import("../validation.js").ToolError | {
    id: any;
    project_id: any;
    content: any;
    version: any;
    created_at: any;
};
export declare function getSummaryVersion(db: Database.Database, input: {
    summary_id: string;
}): import("../validation.js").ToolError | {
    id: any;
    project_id: any;
    content: any;
    version: any;
    created_at: any;
};
export declare function listSummaryHistory(db: Database.Database, input: {
    project_id: string;
}): unknown[] | import("../validation.js").ToolError;
