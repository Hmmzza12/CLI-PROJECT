import * as ctrl from '../controllers/comment.controller.js';
import { authenticate } from '../middleware/auth.js';

export default async function commentRoutes(app) {
  app.post('/tasks/:taskId/comments', { preHandler: authenticate }, ctrl.create);
  app.get('/tasks/:taskId/comments', { preHandler: authenticate }, ctrl.list);
  app.delete('/comments/:commentId', { preHandler: authenticate }, ctrl.remove);
}
