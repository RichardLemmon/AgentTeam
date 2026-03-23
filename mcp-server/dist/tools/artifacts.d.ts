import type Database from 'better-sqlite3';
export declare function shareArtifact(db: Database.Database, input: {
    project_id: string;
    member_id: string;
    title: string;
    artifact_type: string;
    content: string;
}): import("../validation.js").ToolError | {
    id: `${string}-${string}-${string}-${string}-${string}`;
    project_id: string;
    title: string;
    artifact_type: string;
    created_at: string;
};
export declare function updateArtifact(db: Database.Database, input: {
    artifact_id: string;
    content: string;
    title?: string;
}): import("../validation.js").ToolError | {
    id: string;
    title: any;
    updated_at: string;
};
export declare function listArtifacts(db: Database.Database, input: {
    project_id: string;
    artifact_type?: string;
}): unknown[] | import("../validation.js").ToolError;
export declare function getArtifact(db: Database.Database, input: {
    artifact_id: string;
}): import("../validation.js").ToolError | {
    id: any;
    project_id: any;
    member_id: any;
    title: any;
    artifact_type: any;
    content: any;
    created_at: any;
    updated_at: any;
};
