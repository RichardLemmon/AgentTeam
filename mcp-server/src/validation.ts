import {
  VALID_ROLES,
  VALID_PROJECT_STATUSES,
  VALID_TASK_STATUSES,
  VALID_ENTRY_TYPES,
  PROJECT_TRANSITIONS,
  ERROR_CODES,
} from './constants.js';

export interface ToolError {
  error: string;
  code: string;
}

export function validateRequired(value: unknown, fieldName: string): ToolError | null {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return { error: `${fieldName} is required`, code: ERROR_CODES.INVALID_INPUT };
  }
  return null;
}

export function validateRole(role: string): ToolError | null {
  if (!VALID_ROLES.includes(role as any)) {
    return { error: `Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`, code: ERROR_CODES.INVALID_INPUT };
  }
  return null;
}

export function validateProjectStatus(status: string): ToolError | null {
  if (!VALID_PROJECT_STATUSES.includes(status as any)) {
    return { error: `Invalid status: ${status}. Must be one of: ${VALID_PROJECT_STATUSES.join(', ')}`, code: ERROR_CODES.INVALID_INPUT };
  }
  return null;
}

export function validateProjectTransition(currentStatus: string, newStatus: string): ToolError | null {
  const allowed = PROJECT_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    return { error: `Cannot transition from ${currentStatus} to ${newStatus}`, code: ERROR_CODES.INVALID_TRANSITION };
  }
  return null;
}

export function validateTaskStatus(status: string): ToolError | null {
  if (!VALID_TASK_STATUSES.includes(status as any)) {
    return { error: `Invalid task status: ${status}. Must be one of: ${VALID_TASK_STATUSES.join(', ')}`, code: ERROR_CODES.INVALID_INPUT };
  }
  return null;
}

export function validateEntryType(entryType: string): ToolError | null {
  if (!VALID_ENTRY_TYPES.includes(entryType as any)) {
    return { error: `Invalid entry type: ${entryType}. Must be one of: ${VALID_ENTRY_TYPES.join(', ')}`, code: ERROR_CODES.INVALID_INPUT };
  }
  return null;
}

export function notFound(entity: string, id: string): ToolError {
  return { error: `${entity} not found: ${id}`, code: ERROR_CODES.NOT_FOUND };
}
