import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestApp, auth } from './helpers.js';

let app;

beforeAll(async () => {
  ({ app } = await setupTestApp());
});

const register = (payload) =>
  app.inject({ method: 'POST', url: '/api/v1/auth/register', payload });
const login = (payload) =>
  app.inject({ method: 'POST', url: '/api/v1/auth/login', payload });

describe('POST /auth/register', () => {
  it('creates a user and returns tokens', async () => {
    const res = await register({
      email: 'alice@forge.test',
      password: 'password123',
      name: 'Alice',
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user).toMatchObject({ email: 'alice@forge.test', name: 'Alice' });
    // Password hash must never be exposed.
    expect(body.user.password).toBeUndefined();
  });

  it('rejects a duplicate email with 409', async () => {
    await register({ email: 'dupe@forge.test', password: 'password123', name: 'Dupe' });
    const res = await register({ email: 'dupe@forge.test', password: 'password123', name: 'Dupe2' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects invalid input with 400 and a validation error shape', async () => {
    const res = await register({ email: 'not-an-email', password: 'short', name: '' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/login', () => {
  beforeAll(async () => {
    await register({ email: 'bob@forge.test', password: 'password123', name: 'Bob' });
  });

  it('logs in with correct credentials', async () => {
    const res = await login({ email: 'bob@forge.test', password: 'password123' });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTruthy();
  });

  it('rejects a wrong password with 401', async () => {
    const res = await login({ email: 'bob@forge.test', password: 'wrongpass' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unknown email with 401', async () => {
    const res = await login({ email: 'nobody@forge.test', password: 'password123' });
    expect(res.statusCode).toBe(401);
  });
});

describe('auth guard', () => {
  it('rejects protected routes without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/orgs' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('NO_TOKEN');
  });

  it('rejects a garbage token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/orgs',
      headers: auth('not.a.jwt'),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_TOKEN');
  });

  it('accepts a valid token', async () => {
    const { accessToken } = (await login({ email: 'bob@forge.test', password: 'password123' })).json();
    const res = await app.inject({ method: 'GET', url: '/api/v1/orgs', headers: auth(accessToken) });
    expect(res.statusCode).toBe(200);
  });

  it('returns the current user from /auth/me', async () => {
    const { accessToken, user } = (
      await register({ email: 'me-test@forge.test', password: 'password123', name: 'Me Test' })
    ).json();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: auth(accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: user.id, email: 'me-test@forge.test', name: 'Me Test' });
  });
});

describe('refresh + logout', () => {
  it('rotates tokens and invalidates the used refresh token', async () => {
    const { refreshToken } = (
      await register({ email: 'carol@forge.test', password: 'password123', name: 'Carol' })
    ).json();

    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshed.statusCode).toBe(200);
    const fresh = refreshed.json();
    expect(fresh.accessToken).toBeTruthy();
    expect(fresh.refreshToken).not.toBe(refreshToken);

    // The old (rotated) refresh token must no longer work.
    const reused = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(reused.statusCode).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const { refreshToken } = (
      await register({ email: 'dave@forge.test', password: 'password123', name: 'Dave' })
    ).json();

    const out = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken },
    });
    expect(out.statusCode).toBe(200);

    const afterLogout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(afterLogout.statusCode).toBe(401);
  });
});
