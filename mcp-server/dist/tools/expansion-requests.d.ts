import type Database from 'better-sqlite3';
export declare function requestTeamExpansion(db: Database.Database, input: {
    project_id: string;
    requested_by: string;
    role_needed: string;
    justification: string;
}): import("../validation.js").ToolError | {
    id: `${string}-${string}-${string}-${string}-${string}`;
    project_id: string;
    requested_by: string;
    role_needed: string;
    justification: string;
    status: string;
};
export declare function listExpansionRequests(db: Database.Database, input: {
    project_id: string;
    status?: string;
}): unknown[] | import("../validation.js").ToolError;
export declare function resolveExpansionRequest(db: Database.Database, input: {
    request_id: string;
    status: string;
    resolution_note?: string;
}): import("../validation.js").ToolError | {
    id: string;
    status: string;
    resolution_note: string | null;
    resolved_at: string;
};
