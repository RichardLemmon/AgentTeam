export const VALID_ROLES = [
  'project_manager',
  'product_manager',
  'ux_ui_designer',
  'ux_researcher',
  'frontend_developer',
  'backend_developer',
  'full_stack_developer',
  'mobile_developer',
  'devops_engineer',
  'qa_engineer',
  'security_engineer',
  'data_engineer',
  'data_scientist',
] as const;

export type Role = typeof VALID_ROLES[number];

export const VALID_PROJECT_STATUSES = ['active', 'paused', 'archived', 'closed'] as const;
export type ProjectStatus = typeof VALID_PROJECT_STATUSES[number];

export const PROJECT_TRANSITIONS: Record<string, string[]> = {
  active: ['paused', 'archived', 'closed'],
  paused: ['active', 'archived', 'closed'],
  archived: ['active'],
  closed: [],
};

export const VALID_TASK_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'] as const;
export type TaskStatus = typeof VALID_TASK_STATUSES[number];

export const VALID_ENTRY_TYPES = ['code', 'note', 'status_update'] as const;
export type EntryType = typeof VALID_ENTRY_TYPES[number];

export const ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  CONSTRAINT_ERROR: 'CONSTRAINT_ERROR',
} as const;
