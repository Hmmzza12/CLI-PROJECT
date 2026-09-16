import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Provision an isolated app instance backed by a throwaway SQLite file.
 *
 * Env is set BEFORE any src module is imported (dynamic imports below) so that
 * config.js / db/index.js pick up the test database. dotenv never overrides an
 * already-set var, so the real .env is ignored here.
 */
export async function setupTestApp(appOptions = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-test-'));
  process.env.DATABASE_URL = join(dir, 'test.db');
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.JWT_ACCESS_TTL = '15m';
  process.env.NODE_ENV = 'test';

  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
  const { db, sqlite } = await import('../src/db/index.js');
  migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') });

  const { buildApp } = await import('../src/app.js');
  // Rate limiting is off by default in tests so bulk request flows aren't
  // throttled; the rate-limit test opts back in with { rateLimit: true }.
  const app = buildApp({ rateLimit: false, ...appOptions });
  await app.ready();

  return { app, db, sqlite };
}

/** Register a user and return { user, accessToken, refreshToken }. */
export async function registerUser(app, overrides = {}) {
  const payload = {
    email: `user-${Math.random().toString(36).slice(2, 8)}@forge.test`,
    password: 'password123',
    name: 'Test User',
    ...overrides,
  };
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload });
  return res.json();
}

export function auth(token) {
  return { authorization: `Bearer ${token}` };
}
