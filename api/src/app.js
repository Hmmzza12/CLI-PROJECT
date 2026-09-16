import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { config } from './config.js';
import { AppError } from './utils/errors.js';
import authRoutes from './routes/auth.routes.js';
import orgRoutes from './routes/org.routes.js';
import memberRoutes from './routes/member.routes.js';
import projectRoutes from './routes/project.routes.js';
import taskRoutes from './routes/task.routes.js';
import commentRoutes from './routes/comment.routes.js';
import labelRoutes from './routes/label.routes.js';

const healthHandler = async () => ({
  status: 'ok',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
});

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_WEB_DIST = resolve(here, '../../frontend/dist');

/**
 * Build (but do not start) the Fastify app. Kept side-effect free so tests can
 * spin up an instance and drive it with `app.inject()`.
 *
 * opts.rateLimit — enable per-route rate limiting (default true). Tests disable
 * it so bulk request flows aren't throttled.
 */
export function buildApp(opts = {}) {
  const app = Fastify({ logger: opts.logger ?? false });
  const enableRateLimit = opts.rateLimit ?? true;

  // Parse cookies so /auth/refresh can read the httpOnly refresh-token cookie
  // set for the web client.
  app.register(cookie);

  // In production, serve the built web app from the same origin (no CORS, and
  // the httpOnly cookie is first-party). Dev uses the Vite dev server instead.
  const webDist = config.webDist ? resolve(config.webDist) : DEFAULT_WEB_DIST;
  const serveWeb = config.isProd && existsSync(webDist);
  if (serveWeb) {
    app.register(fastifyStatic, { root: webDist, wildcard: false });
  }

  // Rate limiting is registered globally-disabled; individual routes opt in via
  // `config.rateLimit` (see auth.routes.js). Must be registered before routes.
  if (enableRateLimit) {
    app.register(rateLimit, {
      global: false,
      max: 10,
      timeWindow: '1 minute',
      // The plugin throws this value; returning an AppError lets our standard
      // error handler render it as a 429 in the { error: { code, message } } shape.
      errorResponseBuilder: () =>
        new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later.'),
    });
  }

  // Every error leaves the API in the same shape: { error: { code, message } }.
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply
        .status(err.statusCode)
        .send({ error: { code: err.code, message: err.message } });
    }

    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: err.issues.map((i) => ({
            path: i.path.join('.') || '(root)',
            message: i.message,
          })),
        },
      });
    }

    // Fastify's own client errors (bad JSON, unsupported media type, ...).
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.status(err.statusCode).send({
        error: { code: err.code ?? 'BAD_REQUEST', message: err.message },
      });
    }

    // Anything else is an unhandled 500: log it server-side (with stack), but
    // never leak internals to the client.
    req.log.error({ err }, 'Unhandled error');
    return reply
      .status(500)
      .send({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  });

  app.setNotFoundHandler((req, reply) => {
    const isApiOrHealth = req.url.startsWith('/api') || req.url.startsWith('/health');
    // SPA deep links (e.g. /orgs/:id) fall back to index.html in production.
    if (serveWeb && !isApiOrHealth && req.method === 'GET') {
      return reply.sendFile('index.html');
    }
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` },
    });
  });

  app.get('/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  app.register(authRoutes, { prefix: '/api/v1' });
  app.register(orgRoutes, { prefix: '/api/v1' });
  app.register(memberRoutes, { prefix: '/api/v1' });
  app.register(projectRoutes, { prefix: '/api/v1' });
  app.register(taskRoutes, { prefix: '/api/v1' });
  app.register(commentRoutes, { prefix: '/api/v1' });
  app.register(labelRoutes, { prefix: '/api/v1' });

  return app;
}
