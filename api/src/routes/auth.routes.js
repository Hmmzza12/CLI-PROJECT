import * as ctrl from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';

/**
 * @param app  Fastify instance
 * @param opts Plugin options; `opts.rateLimit` (bool) enables the persistent,
 *             DB-backed limiter on the credential endpoints. Tests default it off.
 */
export default async function authRoutes(app, opts) {
  // 10 requests / minute / IP across the credential endpoints, enforced via a
  // shared DB-backed store so the limit survives serverless cold starts.
  const limited = opts.rateLimit
    ? { preHandler: rateLimit({ max: 10, windowMs: 60_000, bucket: 'auth' }) }
    : {};

  // Public (rate-limited)
  app.post('/auth/register', limited, ctrl.register);
  app.post('/auth/login', limited, ctrl.login);
  app.post('/auth/refresh', limited, ctrl.refresh);
  // Public (not rate-limited)
  app.post('/auth/logout', ctrl.logout);
  // Authenticated: identity of the current token holder
  app.get('/auth/me', { preHandler: authenticate }, ctrl.me);
}
