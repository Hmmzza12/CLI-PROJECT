import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projects } from '../db/schema.js';
import { requireMembership, requireRole } from './access.service.js';
import { errors } from '../utils/errors.js';

/** Load a project by id or throw 404. Does not check access on its own. */
async function loadProject(projectId) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) {
    throw errors.notFound('Project not found', 'PROJECT_NOT_FOUND');
  }
  return project;
}

/**
 * Load a project AND assert the caller is a member of its org. Returns the
 * project plus the caller's membership so callers can do further role checks.
 */
export async function getProjectForUser(user, projectId) {
  const project = await loadProject(projectId);
  const membership = await requireMembership(user.id, project.orgId);
  return { project, membership };
}

export async function createProject(user, orgId, { name, description }) {
  await requireMembership(user.id, orgId);
  const [project] = await db
    .insert(projects)
    .values({ name, description: description ?? null, orgId })
    .returning();
  return project;
}

export async function listProjects(user, orgId) {
  await requireMembership(user.id, orgId);
  return db.select().from(projects).where(eq(projects.orgId, orgId));
}

export async function getProject(user, projectId) {
  const { project } = await getProjectForUser(user, projectId);
  return project;
}

export async function updateProject(user, projectId, patch) {
  const { project } = await getProjectForUser(user, projectId);
  const fields = {};
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.description !== undefined) fields.description = patch.description;
  if (Object.keys(fields).length === 0) return project;

  const [updated] = await db
    .update(projects)
    .set(fields)
    .where(eq(projects.id, project.id))
    .returning();
  return updated;
}

export async function deleteProject(user, projectId) {
  const project = await loadProject(projectId);
  // Only OWNER/ADMIN may delete a project.
  await requireRole(user.id, project.orgId, ['OWNER', 'ADMIN']);
  await db.delete(projects).where(eq(projects.id, project.id));
}
