export const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const ROLES = ['OWNER', 'ADMIN', 'MEMBER'];

export const STATUS_LABELS = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

export const STATUS_STYLES = {
  TODO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  IN_REVIEW: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  DONE: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
};

export const PRIORITY_STYLES = {
  LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  HIGH: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

export const ROLE_STYLES = {
  OWNER: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  ADMIN: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  MEMBER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};
