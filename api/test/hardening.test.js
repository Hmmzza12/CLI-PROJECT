import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setupTestApp } from './helpers.js';
import { parseEnv } from '../src/env.js';

const VALID_ENV = {
  NODE_ENV: 'production',
  PORT: '3000',
  DATABASE_URL: './forge.db',
  JWT_ACCESS_SECRET: 'a-secret',
  JWT_REFRESH_SECRET: 'another-secret',
};

describe('env validation', () => {
  it('accepts a fully-configured environment', () => {
    expect(parseEnv(VALID_ENV).success).toBe(true);
  });

  it('rejects a missing JWT signing secret', () => {
    const { JWT_ACCESS_SECRET, ...withoutSecret } = VALID_ENV;
    const result = parseEnv(withoutSecret);
    expect(result.success).toBe(false);
    expect(result.error.issues.some((i) => i.path.includes('JWT_ACCESS_SECRET'))).toBe(true);
  });

  it('server process exits 1 when the JWT secret is missing', () => {
    const env = { ...process.env };
    delete env.JWT_ACCESS_SECRET;
    env.NODE_ENV = 'production';
    env.PORT = '3999';
    env.DATABASE_URL = ':memory:';
    env.JWT_REFRESH_SECRET = 'x';
    // Point dotenv at a non-existent file so api/.env can't repopulate the secret.
    env.DOTENV_CONFIG_PATH = join(tmpdir(), `forge-noenv-${Date.now()}`);

    const res = spawnSync(process.execPath, ['src/server.js'], {
      cwd: process.cwd(),
      env,
      encoding: 'utf8',
      timeout: 15000,
    });

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('JWT_ACCESS_SECRET');
  });
});

describe('health endpoint', () => {
  let app;
  beforeAll(async () => {
    ({ app } = await setupTestApp());
  });

  it('GET /api/v1/health returns { status, uptime, timestamp }', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
    // timestamp must be a valid ISO string
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('requires no auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
  });
});

describe('rate limiting (auth routes)', () => {
  let app;
  beforeAll(async () => {
    ({ app } = await setupTestApp({ rateLimit: true }));
  });

  it('returns 429 RATE_LIMITED after 10 login attempts in a window', async () => {
    let last;
    for (let i = 0; i < 11; i += 1) {
      last = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'nobody@forge.test', password: 'wrong-password' },
      });
    }
    expect(last.statusCode).toBe(429);
    expect(last.json().error).toEqual({
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later.',
    });
  });

  it('does not rate-limit non-auth routes', async () => {
    let last;
    for (let i = 0; i < 15; i += 1) {
      last = await app.inject({ method: 'GET', url: '/api/v1/health' });
    }
    expect(last.statusCode).toBe(200);
  });
});
