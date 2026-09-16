import { and, eq, gt, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { rateLimitHits } from '../db/schema.js';
import { AppError } from '../utils/errors.js';

/**
 * A rate limiter backed by the database rather than process memory.
 *
 * Serverless functions are stateless — each cold start gets a fresh process, so
 * an in-memory counter (e.g. @fastify/rate-limit's default store) resets
 * constantly and can't enforce a limit across invocations. Instead we record one
 * row per accepted request and count the rows in the current sliding window.
 * Turso/libSQL is the shared source of truth, so the limit holds regardless of
 * how many function instances are warm.
 *
 * Volume here is tiny (only the credential endpoints are limited), so a
 * count-and-insert per request is perfectly cheap.
 *
 * @param {object}  opts
 * @param {number}  opts.max       Max requests allowed per window (default 10).
 * @param {number}  opts.windowMs  Window length in ms (default 60_000).
 * @param {string}  opts.bucket    Logical bucket name, combined with client IP.
 */
export function rateLimit({ max = 10, windowMs = 60_000, bucket = 'default' } = {}) {
  return async function rateLimitPreHandler(req) {
    const now = Date.now();
    const windowStart = now - windowMs;
    // `req.ip` respects X-Forwarded-For because the app runs with trustProxy on,
    // so behind Netlify's proxy this is the real client IP.
    const key = `${bucket}:${req.ip ?? 'unknown'}`;

    const [{ hits }] = await db
      .select({ hits: sql`count(*)`.mapWith(Number) })
      .from(rateLimitHits)
      .where(and(eq(rateLimitHits.bucket, key), gt(rateLimitHits.createdAt, windowStart)));

    if (hits >= max) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later.');
    }

    await db.insert(rateLimitHits).values({ bucket: key, createdAt: now });

    // Opportunistically prune expired rows so the table stays small without a
    // scheduled job. Cheap and self-healing at this traffic level.
    if (Math.random() < 0.05) {
      await db.delete(rateLimitHits).where(lte(rateLimitHits.createdAt, windowStart));
    }
  };
}
