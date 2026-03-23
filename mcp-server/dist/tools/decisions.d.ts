import type Database from 'better-sqlite3';
export declare function logDecision(db: Database.Database, input: {
    project_id: string;
    member_id: string;
    title: string;
    rationale: string;
    context?: string;
}): import("../validation.js").ToolError | {
    id: `${string}-${string}-${string}-${string}-${string}`;
    project_id: string;
    title: string;
    created_at: string;
};
export declare function listDecisions(db: Database.Database, input: {
    project_id: string;
}): unknown[] | import("../validation.js").ToolError;
export declare function getDecision(db: Database.Database, input: {
    decision_id: string;
}): import("../validation.js").ToolError | {
    id: any;
    project_id: any;
    member_id: any;
    title: any;
    rationale: any;
    context: any;
    created_at: any;
};
