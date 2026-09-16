import * as projectService from '../services/project.service.js';
import { createProjectSchema, updateProjectSchema } from '../validation/schemas.js';

export async function create(req, reply) {
  const body = createProjectSchema.parse(req.body);
  const project = await projectService.createProject(req.user, req.params.orgId, body);
  return reply.code(201).send(project);
}

export async function list(req) {
  return projectService.listProjects(req.user, req.params.orgId);
}

export async function get(req) {
  return projectService.getProject(req.user, req.params.projectId);
}

export async function update(req) {
  const body = updateProjectSchema.parse(req.body);
  return projectService.updateProject(req.user, req.params.projectId, body);
}

export async function remove(req, reply) {
  await projectService.deleteProject(req.user, req.params.projectId);
  return reply.code(204).send();
}
