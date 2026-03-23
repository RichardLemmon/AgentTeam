export interface ToolError {
    error: string;
    code: string;
}
export declare function validateRequired(value: unknown, fieldName: string): ToolError | null;
export declare function validateRole(role: string): ToolError | null;
export declare function validateProjectStatus(status: string): ToolError | null;
export declare function validateProjectTransition(currentStatus: string, newStatus: string): ToolError | null;
export declare function validateTaskStatus(status: string): ToolError | null;
export declare function validateEntryType(entryType: string): ToolError | null;
export declare function notFound(entity: string, id: string): ToolError;
