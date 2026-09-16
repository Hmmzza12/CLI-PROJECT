import * as ctrl from '../controllers/member.controller.js';
import { authenticate } from '../middleware/auth.js';

export default async function memberRoutes(app) {
  app.post('/orgs/:orgId/members', { preHandler: authenticate }, ctrl.invite);
  app.get('/orgs/:orgId/members', { preHandler: authenticate }, ctrl.list);
  app.patch('/orgs/:orgId/members/:userId', { preHandler: authenticate }, ctrl.changeRole);
  app.delete('/orgs/:orgId/members/:userId', { preHandler: authenticate }, ctrl.remove);
}
