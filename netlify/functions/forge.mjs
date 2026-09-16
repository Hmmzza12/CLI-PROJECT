import awsLambdaFastify from '@fastify/aws-lambda';
import { buildApp } from '../../api/src/app.js';

/**
 * Single catch-all Netlify Function that wraps the existing Fastify app.
 *
 * `.mjs` on purpose: the API code is ESM-native (top-level await in
 * db/index.js, import.meta.url in app.js), which can't be bundled to CommonJS.
 * AWS Lambda (Netlify's function runtime) always loads a `.mjs` handler as an ES
 * module regardless of the repo's package.json, so esbuild bundles this to a
 * self-contained ESM module that Lambda loads cleanly.
 *
 * Named `forge` (not `api`) so the handler path can't collide with the bundled
 * `api/` directory. The public path stays `/api/*` via netlify.toml.
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
