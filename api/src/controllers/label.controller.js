import * as labelService from '../services/label.service.js';
import { createLabelSchema } from '../validation/schemas.js';

export async function create(req, reply) {
  const body = createLabelSchema.parse(req.body);
  const label = await labelService.createLabel(req.user, req.params.projectId, body);
  return reply.code(201).send(label);
}

export async function list(req) {
  return labelService.listLabels(req.user, req.params.projectId);
}

export async function remove(req, reply) {
  await labelService.deleteLabel(req.user, req.params.labelId);
  return reply.code(204).send();
}

export async function attach(req, reply) {
  const result = await labelService.attachLabel(req.user, req.params.taskId, req.params.labelId);
  return reply.code(201).send(result);
}

export async function detach(req, reply) {
  await labelService.detachLabel(req.user, req.params.taskId, req.params.labelId);
  return reply.code(204).send();
}
