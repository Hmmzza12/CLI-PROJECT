import { z } from 'zod';
import { TASK_STATUSES, TASK_PRIORITIES, ORG_ROLES } from '../db/schema.js';

// A string that Date can parse (ISO-8601 recommended). Kept permissive so the
// CLI can pass values like "2026-09-01" or a full ISO timestamp.
const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' });

// ── Auth ─────────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(120),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

// ── Organizations ────────────────────────────────────────────────────────────
export const createOrgSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(60).optional(),
});

// ── Projects ─────────────────────────────────────────────────────────────────
export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

// ── Tasks ────────────────────────────────────────────────────────────────────
export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().min(1).optional(),
  assigneeEmail: z.email().optional(),
  dueDate: z.union([isoDate, z.null()]).optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).nullable().optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    assigneeEmail: z.email().optional(),
    dueDate: z.union([isoDate, z.null()]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const assignTaskSchema = z
  .object({
    email: z.email().optional(),
    assigneeId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => v.email !== undefined || v.assigneeId !== undefined, {
    message: 'Provide an email or assigneeId (or assigneeId: null to unassign)',
  });

// ── Pagination ───────────────────────────────────────────────────────────────
// page defaults to 1, limit defaults to 20 and is clamped to a max of 100.
const pageField = z.coerce.number().int().min(1).default(1);
const limitField = z.coerce
  .number()
  .int()
  .min(1)
  .default(20)
  .transform((n) => Math.min(n, 100));

export const paginationQuerySchema = z.object({ page: pageField, limit: limitField });

export const listTasksQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignee: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  search: z.string().min(1).max(200).optional(),
  page: pageField,
  limit: limitField,
});

// ── Members ──────────────────────────────────────────────────────────────────
export const inviteMemberSchema = z.object({
  email: z.email(),
});

export const changeRoleSchema = z.object({
  role: z.enum(ORG_ROLES),
});

// ── Comments ─────────────────────────────────────────────────────────────────
export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

// ── Labels ───────────────────────────────────────────────────────────────────
export const createLabelSchema = z.object({
  name: z.string().min(1).max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #FF5733')
    .optional(),
});
