import * as ctrl from '../controllers/org.controller.js';
import { authenticate } from '../middleware/auth.js';

export default async function orgRoutes(app) {
  app.post('/orgs', { preHandler: authenticate }, ctrl.create);
  app.get('/orgs', { preHandler: authenticate }, ctrl.list);
  // Member management (invite / change role / remove) lands in the next phase.
}
