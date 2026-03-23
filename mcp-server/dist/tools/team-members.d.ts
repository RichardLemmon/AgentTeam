import type Database from 'better-sqlite3';
export declare function addTeamMember(db: Database.Database, input: {
    project_id: string;
    role: string;
}): import("../validation.js").ToolError | {
    id: `${string}-${string}-${string}-${string}-${string}`;
    project_id: string;
    role: string;
    joined_at: string;
};
export declare function removeTeamMember(db: Database.Database, input: {
    member_id: string;
}): import("../validation.js").ToolError | {
    id: string;
    removed_at: string;
};
export declare function listTeamMembers(db: Database.Database, input: {
    project_id: string;
    active_only?: boolean;
}): unknown[] | import("../validation.js").ToolError;
