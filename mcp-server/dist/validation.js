import { VALID_ROLES, VALID_PROJECT_STATUSES, VALID_TASK_STATUSES, VALID_ENTRY_TYPES, PROJECT_TRANSITIONS, ERROR_CODES, } from './constants.js';
export function validateRequired(value, fieldName) {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        return { error: `${fieldName} is required`, code: ERROR_CODES.INVALID_INPUT };
    }
    return null;
}
export function validateRole(role) {
    if (!VALID_ROLES.includes(role)) {
        return { error: `Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`, code: ERROR_CODES.INVALID_INPUT };
    }
    return null;
}
export function validateProjectStatus(status) {
    if (!VALID_PROJECT_STATUSES.includes(status)) {
        return { error: `Invalid status: ${status}. Must be one of: ${VALID_PROJECT_STATUSES.join(', ')}`, code: ERROR_CODES.INVALID_INPUT };
    }
    return null;
}
export function validateProjectTransition(currentStatus, newStatus) {
    const allowed = PROJECT_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
        return { error: `Cannot transition from ${currentStatus} to ${newStatus}`, code: ERROR_CODES.INVALID_TRANSITION };
    }
    return null;
}
export function validateTaskStatus(status) {
    if (!VALID_TASK_STATUSES.includes(status)) {
        return { error: `Invalid task status: ${status}. Must be one of: ${VALID_TASK_STATUSES.join(', ')}`, code: ERROR_CODES.INVALID_INPUT };
    }
    return null;
}
export function validateEntryType(entryType) {
    if (!VALID_ENTRY_TYPES.includes(entryType)) {
        return { error: `Invalid entry type: ${entryType}. Must be one of: ${VALID_ENTRY_TYPES.join(', ')}`, code: ERROR_CODES.INVALID_INPUT };
    }
    return null;
}
export function notFound(entity, id) {
    return { error: `${entity} not found: ${id}`, code: ERROR_CODES.NOT_FOUND };
}
//# sourceMappingURL=validation.js.map