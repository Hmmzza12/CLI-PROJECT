import { and, eq, desc, or, like, count, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { db } from '../db/index.js';
import { tasks, projects, users, orgMembers, labels, taskLabels } from '../db/schema.js';
import { getProjectForUser } from './project.service.js';
import { requireMembership } from './access.service.js';
import { errors } from '../utils/errors.js';
import { paginated } from '../utils/pagination.js';

// Two aliased joins onto users so a task can carry both its assignee and its
// reporter in a single query.
const assignee = alias(users, 'assignee');
const reporter = alias(users, 'reporter');

const taskSelection = {
  id: tasks.id,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  projectId: tasks.projectId,
  dueDate: tasks.dueDate,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  orgId: projects.orgId, // internal — used for access checks, stripped on output
  assignee: { id: assignee.id, email: assignee.email, name: assignee.name },
  reporter: { id: reporter.id, email: reporter.email, name: reporter.name },
};

function baseQuery() {
  return db
    .select(taskSelection)
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(assignee, eq(tasks.assigneeId, assignee.id))
    .leftJoin(reporter, eq(tasks.reporterId, reporter.id));
}

/** Shape a raw joined row into the public task DTO. */
function mapTask(row) {
  const { orgId, ...rest } = row;
  return {
    ...rest,
    assignee: rest.assignee?.id ? rest.assignee : null,
    reporter: rest.reporter?.id ? rest.reporter : null,
  };
}

/** The labels currently attached to a task. */
async function getTaskLabels(taskId) {
  return db
    .select({ id: labels.id, name: labels.name, color: labels.color })
    .from(taskLabels)
    .innerJoin(labels, eq(taskLabels.labelId, labels.id))
    .where(eq(taskLabels.taskId, taskId))
    .orderBy(labels.name);
}

/**
 * Resolve who a task should be assigned to and verify they belong to the org.
 * Accepts an explicit id or an email. Returns a userId, or null to unassign.
 */
async function resolveAssignee(orgId, { assigneeId, assigneeEmail }) {
  let targetId = assigneeId ?? null;

  if (!targetId && assigneeEmail) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, assigneeEmail.toLowerCase()))
      .limit(1);
    if (!u) throw errors.notFound('No user with that email', 'USER_NOT_FOUND');
    targetId = u.id;
  }

  if (targetId) {
    const [member] = await db
      .select({ userId: orgMembers.userId })
      .from(orgMembers)
      .where(and(eq(orgMembers.userId, targetId), eq(orgMembers.orgId, orgId)))
      .limit(1);
    if (!member) {
      throw errors.badRequest(
        'Assignee must be a member of the organization',
        'ASSIGNEE_NOT_MEMBER',
      );
    }
  }

  return targetId;
}

export async function createTask(user, projectId, data) {
  const { project } = await getProjectForUser(user, projectId);

  const assigneeId = await resolveAssignee(project.orgId, {
    assigneeId: data.assigneeId,
    assigneeEmail: data.assigneeEmail,
  });

  const [created] = await db
    .insert(tasks)
    .values({
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'TODO',
      priority: data.priority ?? 'MEDIUM',
      projectId: project.id,
      assigneeId,
      reporterId: user.id,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      updatedAt: new Date(),
    })
    .returning({ id: tasks.id });

  return getTask(user, created.id);
}

export async function listTasks(user, projectId, filters = {}) {
  const { project } = await getProjectForUser(user, projectId);
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;

  const conditions = [eq(tasks.projectId, project.id)];
  if (filters.status) conditions.push(eq(tasks.status, filters.status));
  if (filters.priority) conditions.push(eq(tasks.priority, filters.priority));

  if (filters.assignee) {
    let assigneeId = filters.assignee;
    if (assigneeId === 'me') {
      assigneeId = user.id;
    } else if (assigneeId.includes('@')) {
      const [u] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, assigneeId.toLowerCase()))
        .limit(1);
      assigneeId = u?.id ?? '__no_such_user__';
    }
    conditions.push(eq(tasks.assigneeId, assigneeId));
  }

  if (filters.label) {
    const rows = await db
      .select({ id: taskLabels.taskId })
      .from(taskLabels)
      .where(eq(taskLabels.labelId, filters.label));
    const ids = rows.map((r) => r.id);
    // inArray with an empty list would produce invalid SQL — use a sentinel.
    conditions.push(inArray(tasks.id, ids.length ? ids : ['__no_such_task__']));
  }

  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(like(tasks.title, term), like(tasks.description, term)));
  }

  const where = and(...conditions);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(tasks)
    .where(where);

  const rows = await baseQuery()
    .where(where)
    .orderBy(desc(tasks.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return paginated(rows.map(mapTask), { page, limit, total });
}

export async function getTask(user, taskId) {
  const [row] = await baseQuery().where(eq(tasks.id, taskId)).limit(1);
  if (!row) throw errors.notFound('Task not found', 'TASK_NOT_FOUND');
  await requireMembership(user.id, row.orgId);
  const task = mapTask(row);
  task.labels = await getTaskLabels(taskId);
  return task;
}

/** Fetch the minimal task+org context needed to authorize a mutation. */
async function loadTaskContext(taskId) {
  const [row] = await db
    .select({ id: tasks.id, projectId: tasks.projectId, orgId: projects.orgId })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.id, taskId))
    .limit(1);
  if (!row) throw errors.notFound('Task not found', 'TASK_NOT_FOUND');
  return row;
}

/**
 * Assert the caller can act on a task (is a member of its org) and return the
 * task's { id, projectId, orgId }. Reused by comments and labels.
 */
export async function requireTaskAccess(user, taskId) {
  const ctx = await loadTaskContext(taskId);
  await requireMembership(user.id, ctx.orgId);
  return ctx;
}

export async function updateTask(user, taskId, patch) {
  const ctx = await loadTaskContext(taskId);
  await requireMembership(user.id, ctx.orgId);

  const fields = { updatedAt: new Date() };
  if (patch.title !== undefined) fields.title = patch.title;
  if (patch.description !== undefined) fields.description = patch.description;
  if (patch.status !== undefined) fields.status = patch.status;
  if (patch.priority !== undefined) fields.priority = patch.priority;
  if (patch.dueDate !== undefined) {
    fields.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
  }

  if ('assigneeEmail' in patch && patch.assigneeEmail) {
    fields.assigneeId = await resolveAssignee(ctx.orgId, { assigneeEmail: patch.assigneeEmail });
  } else if ('assigneeId' in patch) {
    fields.assigneeId = patch.assigneeId
      ? await resolveAssignee(ctx.orgId, { assigneeId: patch.assigneeId })
      : null;
  }

  await db.update(tasks).set(fields).where(eq(tasks.id, taskId));
  return getTask(user, taskId);
}

export async function assignTask(user, taskId, { email, assigneeId }) {
  const patch =
    email !== undefined
      ? { assigneeEmail: email }
      : { assigneeId: assigneeId ?? null };
  return updateTask(user, taskId, patch);
}

export async function deleteTask(user, taskId) {
  const ctx = await loadTaskContext(taskId);
  await requireMembership(user.id, ctx.orgId);
  await db.delete(tasks).where(eq(tasks.id, taskId));
}
