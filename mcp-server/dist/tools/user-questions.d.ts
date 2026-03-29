import type Database from 'better-sqlite3';
export declare function askUserQuestion(db: Database.Database, input: {
    project_id: string;
    member_id: string;
    question: string;
    context?: string;
}): import("../validation.js").ToolError | {
    id: `${string}-${string}-${string}-${string}-${string}`;
    project_id: string;
    member_id: string;
    question: string;
    context: string | null;
    status: string;
};
export declare function listUserQuestions(db: Database.Database, input: {
    project_id: string;
    status?: string;
}): unknown[] | import("../validation.js").ToolError;
export declare function answerUserQuestion(db: Database.Database, input: {
    question_id: string;
    answer: string;
}): import("../validation.js").ToolError | {
    id: string;
    status: string;
    answer: string;
    answered_at: string;
};
