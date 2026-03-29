import type Database from 'better-sqlite3';
export declare function createProject(db: Database.Database, input: {
    name: string;
    description: string;
}): import("../validation.js").ToolError | {
    id: `${string}-${string}-${string}-${string}-${string}`;
    name: string;
    description: string;
    status: string;
    created_at: string;
};
export declare function getProject(db: Database.Database, input: {
    project_id: string;
}): import("../validation.js").ToolError | {
    id: any;
    name: any;
    description: any;
    status: any;
    created_at: any;
    updated_at: any;
};
export declare function updateProjectStatus(db: Database.Database, input: {
    project_id: string;
    status: string;
}): import("../validation.js").ToolError | {
    id: string;
    status: string;
    updated_at: string;
};
export declare function listProjects(db: Database.Database, input: {
    status?: string;
}): unknown[] | import("../validation.js").ToolError;
export declare function deleteProject(db: Database.Database, input: {
    project_id: string;
}): import("../validation.js").ToolError | {
    deleted: boolean;
    project_id: string;
    name: any;
    counts: Record<string, number>;
};
