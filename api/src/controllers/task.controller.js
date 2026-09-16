import * as taskService from '../services/task.service.js';
import {
  createTaskSchema,
  updateTaskSchema,
  assignTaskSchema,
  listTasksQuerySchema,
} from '../validation/schemas.js';

export async function create(req, reply) {
  const body = createTaskSchema.parse(req.body);
  const task = await taskService.createTask(req.user, req.params.projectId, body);
  return reply.code(201).send(task);
}

export async function list(req) {
  const filters = listTasksQuerySchema.parse(req.query ?? {});
  return taskService.listTasks(req.user, req.params.projectId, filters);
}

export async function get(req) {
  return taskService.getTask(req.user, req.params.taskId);
}

export async function update(req) {
  const body = updateTaskSchema.parse(req.body);
  return taskService.updateTask(req.user, req.params.taskId, body);
}

export async function assign(req) {
  const body = assignTaskSchema.parse(req.body);
  return taskService.assignTask(req.user, req.params.taskId, body);
}

export async function remove(req, reply) {
  await taskService.deleteTask(req.user, req.params.taskId);
  return reply.code(204).send();
}
