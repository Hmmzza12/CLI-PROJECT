const awsLambdaFastify = require('@fastify/aws-lambda');
const { buildApp } = require('../../api/src/app.js');

/**
 * Single catch-all Netlify Function that wraps the existing Fastify app.
 *
 * CommonJS: Netlify's function runtime loads handlers with require(), so a CJS
 * bundle is what actually loads (an .mjs handler fails with "require() of ES
 * Module not supported"). This works because the shared API code was made
 * CJS-bundle-safe — no top-level await (db/index.js) and a guarded
 * import.meta.url (app.js) — so esbuild can emit a self-contained CJS bundle.
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

module.exports.handler = async function handler(event, context) {
  if (event.path?.startsWith(FN_PREFIX)) {
    event.path = `/api${event.path.slice(FN_PREFIX.length)}` || '/api';
  }
  context.callbackWaitsForEmptyEventLoop = false;
  return proxy(event, context);
};
