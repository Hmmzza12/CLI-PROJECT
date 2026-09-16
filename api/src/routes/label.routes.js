import * as ctrl from '../controllers/label.controller.js';
import { authenticate } from '../middleware/auth.js';

export default async function labelRoutes(app) {
  app.post('/projects/:projectId/labels', { preHandler: authenticate }, ctrl.create);
  app.get('/projects/:projectId/labels', { preHandler: authenticate }, ctrl.list);
  app.delete('/labels/:labelId', { preHandler: authenticate }, ctrl.remove);
  app.post('/tasks/:taskId/labels/:labelId', { preHandler: authenticate }, ctrl.attach);
  app.delete('/tasks/:taskId/labels/:labelId', { preHandler: authenticate }, ctrl.detach);
}
