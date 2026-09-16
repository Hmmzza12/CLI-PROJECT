import awsLambdaFastify from '@fastify/aws-lambda';
import { buildApp } from '../../api/src/app.js';

/**
 * Single catch-all Netlify Function that wraps the existing Fastify app.
 *
 * Netlify Functions run on AWS Lambda, so @fastify/aws-lambda adapts the Lambda
 * event/response contract to Fastify without touching any route, validation, or
 * permission logic — the same `buildApp()` used by the standalone server and the
 * tests is reused verbatim.
 *
 * Cold-start reuse: this module is evaluated once per cold start and cached for
 * subsequent warm invocations. `app` (and the module-level DB client in
 * api/src/db/index.js) are therefore created once and reused, not per request.
 */
const app = buildApp({
  // Structured logs to stdout, which Netlify captures as function logs. No file
  // or stream transport applies in serverless; keep the redaction of secrets.
  logger: {
    redact: ['req.headers.authorization', 'body.password', 'body.refreshToken'],
  },
  // Enforce the persistent, Turso-backed limiter on the credential endpoints so
  // the limit holds across stateless invocations.
  rateLimit: true,
});

const proxy = awsLambdaFastify(app);

// Netlify rewrites `/api/*` to this function (see netlify.toml), so requests
// arrive with the function path prefix. Strip it back to the `/api/...` path
// that the Fastify routes are registered under.
const FN_PREFIX = '/.netlify/functions/api';

export async function handler(event, context) {
  if (event.path?.startsWith(FN_PREFIX)) {
    event.path = `/api${event.path.slice(FN_PREFIX.length)}` || '/api';
  }
  // Don't hold the function open waiting for an idle event loop.
  context.callbackWaitsForEmptyEventLoop = false;
  return proxy(event, context);
}
