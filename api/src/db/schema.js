import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { randomUUID } from 'node:crypto';

// Shared column helpers -------------------------------------------------------
const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID());

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());

// Enumerations ----------------------------------------------------------------
export const ORG_ROLES = ['OWNER', 'ADMIN', 'MEMBER'];
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// Users -----------------------------------------------------------------------
export const users = sqliteTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // bcrypt hash
  name: text('name').notNull(),
  createdAt: createdAt(),
});

// Organizations (workspaces) --------------------------------------------------
export const organizations = sqliteTable('organizations', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: createdAt(),
});

// Org membership (join table with role) ---------------------------------------
export const orgMembers = sqliteTable(
  'org_members',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ORG_ROLES }).notNull().default('MEMBER'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId] })],
);

// Projects --------------------------------------------------------------------
export const projects = sqliteTable('projects', {
  id: id(),
  name: text('name').notNull(),
  description: text('description'),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
});

// Tasks -----------------------------------------------------------------------
export const tasks = sqliteTable('tasks', {
  id: id(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: TASK_STATUSES }).notNull().default('TODO'),
  priority: text('priority', { enum: TASK_PRIORITIES }).notNull().default('MEDIUM'),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  reporterId: text('reporter_id')
    .notNull()
    .references(() => users.id),
  dueDate: integer('due_date', { mode: 'timestamp_ms' }),
  createdAt: createdAt(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Comments --------------------------------------------------------------------
export const comments = sqliteTable('comments', {
  id: id(),
  body: text('body').notNull(),
  taskId: text('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  authorId: text('author_id')
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

// Labels ----------------------------------------------------------------------
export const labels = sqliteTable('labels', {
  id: id(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6b7280'),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
});

// Task ↔ Label (many-to-many) -------------------------------------------------
export const taskLabels = sqliteTable(
  'task_labels',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.labelId] })],
);

// Refresh tokens (opaque, stored as SHA-256 hashes; enables logout/rotation) --
export const refreshTokens = sqliteTable('refresh_tokens', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  createdAt: createdAt(),
});
