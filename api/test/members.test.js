import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestApp, registerUser, auth } from './helpers.js';

let app;
let owner;
let alice;
let orgId;

beforeAll(async () => {
  ({ app } = await setupTestApp());
  owner = await registerUser(app, { email: 'owner@forge.test', name: 'Owner' });
  alice = await registerUser(app, { email: 'alice@forge.test', name: 'Alice' });

  const org = await app.inject({
    method: 'POST',
    url: '/api/v1/orgs',
    headers: auth(owner.accessToken),
    payload: { name: 'Acme Inc' },
  });
  orgId = org.json().id;
});

const invite = (token, email) =>
  app.inject({
    method: 'POST',
    url: `/api/v1/orgs/${orgId}/members`,
    headers: auth(token),
    payload: { email },
  });

const setRole = (token, userId, role) =>
  app.inject({
    method: 'PATCH',
    url: `/api/v1/orgs/${orgId}/members/${userId}`,
    headers: auth(token),
    payload: { role },
  });

describe('member management', () => {
  it('invites an existing user as MEMBER', async () => {
    const res = await invite(owner.accessToken, 'alice@forge.test');
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ email: 'alice@forge.test', role: 'MEMBER' });
  });

  it('rejects inviting a user who has no account (404)', async () => {
    const res = await invite(owner.accessToken, 'ghost@forge.test');
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('USER_NOT_FOUND');
  });

  it('rejects inviting an existing member (409)', async () => {
    const res = await invite(owner.accessToken, 'alice@forge.test');
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('ALREADY_MEMBER');
  });

  it('lists members with pagination meta', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/orgs/${orgId}/members`,
      headers: auth(owner.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meta).toMatchObject({ page: 1, limit: 20, total: 2 });
    expect(body.data.map((m) => m.email).sort()).toEqual([
      'alice@forge.test',
      'owner@forge.test',
    ]);
    expect(body.data[0]).toHaveProperty('joinedAt');
  });

  it('lets an OWNER change a member role', async () => {
    const res = await setRole(owner.accessToken, alice.user.id, 'ADMIN');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ email: 'alice@forge.test', role: 'ADMIN' });
  });

  it('forbids a plain MEMBER from managing members', async () => {
    await setRole(owner.accessToken, alice.user.id, 'MEMBER'); // demote back
    const res = await invite(alice.accessToken, 'owner@forge.test');
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('blocks demoting the last OWNER', async () => {
    const res = await setRole(owner.accessToken, owner.user.id, 'ADMIN');
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('LAST_OWNER');
  });

  it('blocks removing the last OWNER', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/orgs/${orgId}/members/${owner.user.id}`,
      headers: auth(owner.accessToken),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('LAST_OWNER');
  });

  it('removes a member', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/orgs/${orgId}/members/${alice.user.id}`,
      headers: auth(owner.accessToken),
    });
    expect(res.statusCode).toBe(204);

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/orgs/${orgId}/members`,
      headers: auth(owner.accessToken),
    });
    expect(list.json().meta.total).toBe(1);
  });
});
