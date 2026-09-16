import { verifyAccessToken } from '../utils/tokens.js';
import { errors } from '../utils/errors.js';

/**
 * Fastify preHandler that authenticates a request from its Bearer token and
 * attaches `req.user = { id, email, name }`. Throws 401 on any failure.
 */
export async function authenticate(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw errors.unauthorized('Missing or malformed Authorization header', 'NO_TOKEN');
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
  } catch {
    throw errors.unauthorized('Invalid or expired access token', 'INVALID_TOKEN');
  }
}
