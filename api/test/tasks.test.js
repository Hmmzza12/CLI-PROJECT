import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestApp, registerUser, auth } from './helpers.js';

let app;
let owner; // { user, accessToken, refreshToken }
let orgId;
let projectId;

beforeAll(async () => {
  ({ app } = await setupTestApp());

  owner = await registerUser(app, { email: 'owner@forge.test', name: 'Owner' });

  const orgRes = await app.inject({
    method: 'POST',
    url: '/api/v1/orgs',
    headers: auth(owner.accessToken),
    payload: { name: 'Acme Inc' },
  });
  orgId = orgRes.json().id;

  const projRes = await app.inject({
    method: 'POST',
    url: `/api/v1/orgs/${orgId}/projects`,
    headers: auth(owner.accessToken),
    payload: { name: 'Website', description: 'Marketing site' },
  });
  projectId = projRes.json().id;
});

describe('org + project setup', () => {
  it('created an org with the creator as OWNER', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/orgs',
      headers: auth(owner.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const orgs = res.json();
    expect(orgs).toHaveLength(1);
    expect(orgs[0]).toMatchObject({ name: 'Acme Inc', role: 'OWNER' });
  });

  it('lists projects in the org', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/orgs/${orgId}/projects`,
      headers: auth(owner.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});

describe('task lifecycle', () => {
  let taskId;

  it('creates a task with reporter defaulted to the creator', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: auth(owner.accessToken),
      payload: { title: 'Build login page', priority: 'HIGH' },
    });
    expect(res.statusCode).toBe(201);
    const task = res.json();
    taskId = task.id;
    expect(task).toMatchObject({ title: 'Build login page', status: 'TODO', priority: 'HIGH' });
    expect(task.reporter.email).toBe('owner@forge.test');
    expect(task.assignee).toBeNull();
  });

  it('lists tasks and filters by status', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: auth(owner.accessToken),
      payload: { title: 'Second task', status: 'DONE' },
    });

    const all = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: auth(owner.accessToken),
    });
    expect(all.json().data.length).toBeGreaterThanOrEqual(2);

    const done = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/tasks?status=DONE`,
      headers: auth(owner.accessToken),
    });
    expect(done.json().data.every((t) => t.status === 'DONE')).toBe(true);
  });

  it('updates a task (status + priority)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      headers: auth(owner.accessToken),
      payload: { status: 'IN_PROGRESS', priority: 'URGENT' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'IN_PROGRESS', priority: 'URGENT' });
  });

  it('assigns a task by email', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}/assign`,
      headers: auth(owner.accessToken),
      payload: { email: 'owner@forge.test' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assignee.email).toBe('owner@forge.test');
  });

  it('rejects assigning to a non-member', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}/assign`,
      headers: auth(owner.accessToken),
      payload: { email: 'stranger@forge.test' },
    });
    expect(res.statusCode).toBe(404); // no such user
  });

  it('marks a task done via update', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      headers: auth(owner.accessToken),
      payload: { status: 'DONE' },
    });
    expect(res.json().status).toBe('DONE');
  });

  it('deletes a task', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/tasks/${taskId}`,
      headers: auth(owner.accessToken),
    });
    expect(del.statusCode).toBe(204);

    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${taskId}`,
      headers: auth(owner.accessToken),
    });
    expect(get.statusCode).toBe(404);
  });
});

describe('cross-tenant isolation', () => {
  it('forbids a non-member from reading another org project', async () => {
    const outsider = await registerUser(app, { email: 'outsider@forge.test', name: 'Outsider' });
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}`,
      headers: auth(outsider.accessToken),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('NOT_A_MEMBER');
  });

  it('forbids a non-member from creating a task', async () => {
    const outsider = await registerUser(app, { email: 'outsider2@forge.test', name: 'Outsider2' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: auth(outsider.accessToken),
      payload: { title: 'sneaky task' },
    });
    expect(res.statusCode).toBe(403);
  });
});
