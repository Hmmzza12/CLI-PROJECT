const awsLambdaFastify = require('@fastify/aws-lambda');
const { buildApp } = require('../../api/src/app.js');

/**
 * Single catch-all Netlify Function that wraps the existing Fastify app.
 *
 * Netlify Functions run on AWS Lambda. @fastify/aws-lambda adapts the Lambda
 * event/response contract to Fastify without touching any route logic.
 *
 * This file uses CommonJS (netlify/functions/package.json sets "type":"commonjs")
 * so esbuild outputs a CJS bundle. Node.js CJS resolution finds api.js without
 * requiring an explicit extension — fixing the ESM directory-import crash.
 *
 * Cold-start reuse: module-level `app` is created once per cold start and
 * reused across warm invocations.
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
const FN_PREFIX = '/.netlify/functions/api';

module.exports.handler = async function handler(event, context) {
  if (event.path?.startsWith(FN_PREFIX)) {
    event.path = `/api${event.path.slice(FN_PREFIX.length)}` || '/api';
  }
  context.callbackWaitsForEmptyEventLoop = false;
  return proxy(event, context);
};
