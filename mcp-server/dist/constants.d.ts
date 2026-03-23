export declare const VALID_ROLES: readonly ["project_manager", "product_manager", "ux_ui_designer", "ux_researcher", "frontend_developer", "backend_developer", "full_stack_developer", "mobile_developer", "devops_engineer", "qa_engineer", "security_engineer", "data_engineer", "data_scientist"];
export type Role = typeof VALID_ROLES[number];
export declare const VALID_PROJECT_STATUSES: readonly ["active", "paused", "archived", "closed"];
export type ProjectStatus = typeof VALID_PROJECT_STATUSES[number];
export declare const PROJECT_TRANSITIONS: Record<string, string[]>;
export declare const VALID_TASK_STATUSES: readonly ["pending", "in_progress", "completed", "blocked"];
export type TaskStatus = typeof VALID_TASK_STATUSES[number];
export declare const VALID_ENTRY_TYPES: readonly ["code", "note", "status_update"];
export type EntryType = typeof VALID_ENTRY_TYPES[number];
export declare const ERROR_CODES: {
    readonly NOT_FOUND: "NOT_FOUND";
    readonly INVALID_INPUT: "INVALID_INPUT";
    readonly INVALID_TRANSITION: "INVALID_TRANSITION";
    readonly CONSTRAINT_ERROR: "CONSTRAINT_ERROR";
};
