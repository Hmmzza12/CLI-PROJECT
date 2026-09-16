import * as ctrl from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

// 10 requests / minute / IP on the credential endpoints.
const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

export default async function authRoutes(app) {
  // Public (rate-limited)
  app.post('/auth/register', authRateLimit, ctrl.register);
  app.post('/auth/login', authRateLimit, ctrl.login);
  app.post('/auth/refresh', authRateLimit, ctrl.refresh);
  // Public (not rate-limited)
  app.post('/auth/logout', ctrl.logout);
  // Authenticated: identity of the current token holder
  app.get('/auth/me', { preHandler: authenticate }, ctrl.me);
}
