import type Database from 'better-sqlite3';
export declare function createDiscussion(db: Database.Database, input: {
    project_id: string;
    topic: string;
    created_by: string;
    participant_ids: string[];
}): import("../validation.js").ToolError | {
    id: `${string}-${string}-${string}-${string}-${string}`;
    project_id: string;
    topic: string;
    created_at: string;
};
export declare function addDiscussionParticipant(db: Database.Database, input: {
    discussion_id: string;
    member_id: string;
}): import("../validation.js").ToolError | {
    discussion_id: string;
    member_id: string;
    joined_at: string;
};
export declare function addDiscussionMessage(db: Database.Database, input: {
    discussion_id: string;
    member_id: string;
    content: string;
}): import("../validation.js").ToolError | {
    id: `${string}-${string}-${string}-${string}-${string}`;
    discussion_id: string;
    member_id: string;
    created_at: string;
};
export declare function updateDiscussionSummary(db: Database.Database, input: {
    discussion_id: string;
    summary: string;
}): import("../validation.js").ToolError | {
    discussion_id: string;
    updated_at: string;
};
export declare function getDiscussion(db: Database.Database, input: {
    discussion_id: string;
}): import("../validation.js").ToolError | {
    id: any;
    topic: any;
    summary: any;
    created_by: any;
    participants: unknown[];
    messages: unknown[];
    created_at: any;
    updated_at: any;
};
export declare function listDiscussions(db: Database.Database, input: {
    project_id: string;
    participant_id?: string;
}): unknown[] | import("../validation.js").ToolError;
