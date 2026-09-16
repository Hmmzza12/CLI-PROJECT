import * as ctrl from '../controllers/project.controller.js';
import { authenticate } from '../middleware/auth.js';

export default async function projectRoutes(app) {
  app.post('/orgs/:orgId/projects', { preHandler: authenticate }, ctrl.create);
  app.get('/orgs/:orgId/projects', { preHandler: authenticate }, ctrl.list);
  app.get('/projects/:projectId', { preHandler: authenticate }, ctrl.get);
  app.patch('/projects/:projectId', { preHandler: authenticate }, ctrl.update);
  app.delete('/projects/:projectId', { preHandler: authenticate }, ctrl.remove);
}
