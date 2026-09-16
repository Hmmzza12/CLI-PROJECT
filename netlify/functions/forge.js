import awsLambdaFastify from '@fastify/aws-lambda';
import { buildApp } from '../../api/src/app.js';

/**
 * Single catch-all Netlify Function that wraps the existing Fastify app.
 *
 * Named `forge` (not `api`) on purpose: the function pulls in ../../api/src, so
 * an `api/` directory ends up next to the handler in the deploy. A handler also
 * named `api` made Lambda resolve `/var/task/api` to that directory instead of
 * the handler file (ERR_UNSUPPORTED_DIR_IMPORT). A distinct name avoids the
 * collision. The public path stays `/api/*` via netlify.toml.
 *
 * Cold-start reuse: module-level `app` is created once per cold start and reused
 * across warm invocations, as is the DB client in api/src/db/index.js.
 */
const app = buildApp({
  logger: {
    redact: ['req.headers.authorization', 'body.password', 'body.refreshToken'],
  },
  rateLimit: true,
});

const proxy = awsLambdaFastify(app);

// Netlify rewrites /api/* to this function. Strip the function path prefix so
// the Fastify routes (registered under /api/...) match correctly.
const FN_PREFIX = '/.netlify/functions/forge';

export async function handler(event, context) {
  if (event.path?.startsWith(FN_PREFIX)) {
    event.path = `/api${event.path.slice(FN_PREFIX.length)}` || '/api';
  }
  context.callbackWaitsForEmptyEventLoop = false;
  return proxy(event, context);
}
