import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { labels, taskLabels, projects } from '../db/schema.js';
import { getProjectForUser } from './project.service.js';
import { requireTaskAccess } from './task.service.js';
import { requireRole } from './access.service.js';
import { errors } from '../utils/errors.js';

export async function createLabel(user, projectId, { name, color }) {
  const { project } = await getProjectForUser(user, projectId);

  // Label names are unique within a project.
  const [dupe] = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.projectId, project.id), eq(labels.name, name)))
    .limit(1);
  if (dupe) {
    throw errors.conflict('A label with that name already exists in this project', 'LABEL_EXISTS');
  }

  const [created] = await db
    .insert(labels)
    .values({ name, projectId: project.id, ...(color ? { color } : {}) })
    .returning();
  return created;
}

export async function listLabels(user, projectId) {
  const { project } = await getProjectForUser(user, projectId);
  return db.select().from(labels).where(eq(labels.projectId, project.id)).orderBy(labels.name);
}

async function loadLabel(labelId) {
  const [label] = await db.select().from(labels).where(eq(labels.id, labelId)).limit(1);
  if (!label) throw errors.notFound('Label not found', 'LABEL_NOT_FOUND');
  return label;
}

export async function deleteLabel(user, labelId) {
  const label = await loadLabel(labelId);
  const [project] = await db
    .select({ orgId: projects.orgId })
    .from(projects)
    .where(eq(projects.id, label.projectId))
    .limit(1);

  await requireRole(user.id, project.orgId, ['OWNER', 'ADMIN']);
  // FK onDelete: cascade removes the task_labels join rows automatically.
  await db.delete(labels).where(eq(labels.id, labelId));
}

export async function attachLabel(user, taskId, labelId) {
  const ctx = await requireTaskAccess(user, taskId);
  const label = await loadLabel(labelId);

  if (label.projectId !== ctx.projectId) {
    throw errors.badRequest(
      'Label belongs to a different project than the task',
      'LABEL_PROJECT_MISMATCH',
    );
  }

  // Attaching an already-attached label is a no-op (no duplicate, no error).
  await db.insert(taskLabels).values({ taskId, labelId }).onConflictDoNothing();
  return { taskId, label };
}

export async function detachLabel(user, taskId, labelId) {
  await requireTaskAccess(user, taskId);
  await db
    .delete(taskLabels)
    .where(and(eq(taskLabels.taskId, taskId), eq(taskLabels.labelId, labelId)));
}
