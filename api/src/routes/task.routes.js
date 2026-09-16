import * as ctrl from '../controllers/task.controller.js';
import { authenticate } from '../middleware/auth.js';

export default async function taskRoutes(app) {
  app.post('/projects/:projectId/tasks', { preHandler: authenticate }, ctrl.create);
  app.get('/projects/:projectId/tasks', { preHandler: authenticate }, ctrl.list);
  app.get('/tasks/:taskId', { preHandler: authenticate }, ctrl.get);
  app.patch('/tasks/:taskId', { preHandler: authenticate }, ctrl.update);
  app.patch('/tasks/:taskId/assign', { preHandler: authenticate }, ctrl.assign);
  app.delete('/tasks/:taskId', { preHandler: authenticate }, ctrl.remove);
}
