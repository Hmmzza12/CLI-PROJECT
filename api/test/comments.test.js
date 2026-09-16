import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestApp, registerUser, auth } from './helpers.js';

let app;
let owner;
let bob; // member
let carol; // member
let outsider; // not a member
let taskId;

beforeAll(async () => {
  ({ app } = await setupTestApp());
  owner = await registerUser(app, { email: 'owner@forge.test', name: 'Owner' });
  bob = await registerUser(app, { email: 'bob@forge.test', name: 'Bob' });
  carol = await registerUser(app, { email: 'carol@forge.test', name: 'Carol' });
  outsider = await registerUser(app, { email: 'outsider@forge.test', name: 'Outsider' });

  const org = await app.inject({
    method: 'POST',
    url: '/api/v1/orgs',
    headers: auth(owner.accessToken),
    payload: { name: 'Acme Inc' },
  });
  const orgId = org.json().id;

  for (const email of ['bob@forge.test', 'carol@forge.test']) {
    await app.inject({
      method: 'POST',
      url: `/api/v1/orgs/${orgId}/members`,
      headers: auth(owner.accessToken),
      payload: { email },
    });
  }

  const proj = await app.inject({
    method: 'POST',
    url: `/api/v1/orgs/${orgId}/projects`,
    headers: auth(owner.accessToken),
    payload: { name: 'Website' },
  });
  const projectId = proj.json().id;

  const task = await app.inject({
    method: 'POST',
    url: `/api/v1/projects/${projectId}/tasks`,
    headers: auth(owner.accessToken),
    payload: { title: 'Build login page' },
  });
  taskId = task.json().id;
});

const addComment = (token, body) =>
  app.inject({
    method: 'POST',
    url: `/api/v1/tasks/${taskId}/comments`,
    headers: auth(token),
    payload: { body },
  });

describe('comments', () => {
  it('forbids a non-member from commenting', async () => {
    const res = await addComment(outsider.accessToken, 'sneaky');
    expect(res.statusCode).toBe(403);
  });

  it('lets a member create a comment', async () => {
    const res = await addComment(bob.accessToken, 'Looks good to me');
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ body: 'Looks good to me' });
    expect(res.json().author.email).toBe('bob@forge.test');
  });

  it('rejects an empty comment body (400)', async () => {
    const res = await addComment(bob.accessToken, '');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('lists comments newest-first with pagination meta', async () => {
    await addComment(owner.accessToken, 'Second comment');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${taskId}/comments`,
      headers: auth(owner.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meta).toMatchObject({ page: 1, limit: 20, total: 2 });
    expect(body.data[0].body).toBe('Second comment'); // newest first
  });

  it('forbids a non-author member from deleting a comment', async () => {
    const created = (await addComment(bob.accessToken, 'bob owns this')).json();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/comments/${created.id}`,
      headers: auth(carol.accessToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it('lets the author delete their own comment', async () => {
    const created = (await addComment(bob.accessToken, 'delete me')).json();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/comments/${created.id}`,
      headers: auth(bob.accessToken),
    });
    expect(res.statusCode).toBe(204);
  });

  it('lets an org OWNER delete someone else’s comment', async () => {
    const created = (await addComment(bob.accessToken, 'owner will remove this')).json();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/comments/${created.id}`,
      headers: auth(owner.accessToken),
    });
    expect(res.statusCode).toBe(204);
  });
});
