import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestApp, registerUser, auth } from './helpers.js';

let app;
let owner;
let member;
let orgId;
let projectId;
let taskId;

beforeAll(async () => {
  ({ app } = await setupTestApp());
  owner = await registerUser(app, { email: 'owner@forge.test', name: 'Owner' });
  member = await registerUser(app, { email: 'member@forge.test', name: 'Member' });

  const org = await app.inject({
    method: 'POST',
    url: '/api/v1/orgs',
    headers: auth(owner.accessToken),
    payload: { name: 'Acme Inc' },
  });
  orgId = org.json().id;

  await app.inject({
    method: 'POST',
    url: `/api/v1/orgs/${orgId}/members`,
    headers: auth(owner.accessToken),
    payload: { email: 'member@forge.test' },
  });

  const proj = await app.inject({
    method: 'POST',
    url: `/api/v1/orgs/${orgId}/projects`,
    headers: auth(owner.accessToken),
    payload: { name: 'Website' },
  });
  projectId = proj.json().id;

  const task = await app.inject({
    method: 'POST',
    url: `/api/v1/projects/${projectId}/tasks`,
    headers: auth(owner.accessToken),
    payload: { title: 'Build login page' },
  });
  taskId = task.json().id;
});

const createLabel = (token, name, color) =>
  app.inject({
    method: 'POST',
    url: `/api/v1/projects/${projectId}/labels`,
    headers: auth(token),
    payload: color ? { name, color } : { name },
  });

const getTask = () =>
  app.inject({ method: 'GET', url: `/api/v1/tasks/${taskId}`, headers: auth(owner.accessToken) });

describe('labels', () => {
  let bugId;

  it('creates a label', async () => {
    const res = await createLabel(owner.accessToken, 'bug', '#FF5733');
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: 'bug', color: '#FF5733' });
    bugId = res.json().id;
  });

  it('rejects a duplicate label name in the same project (409)', async () => {
    const res = await createLabel(owner.accessToken, 'bug');
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('LABEL_EXISTS');
  });

  it('rejects an invalid hex color (400)', async () => {
    const res = await createLabel(owner.accessToken, 'weird', 'notacolor');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('lists labels for the project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/labels`,
      headers: auth(owner.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().some((l) => l.name === 'bug')).toBe(true);
  });

  it('attaches a label to a task and shows it on the task', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${taskId}/labels/${bugId}`,
      headers: auth(owner.accessToken),
    });
    expect(res.statusCode).toBe(201);

    const task = await getTask();
    expect(task.json().labels).toHaveLength(1);
    expect(task.json().labels[0]).toMatchObject({ name: 'bug', color: '#FF5733' });
  });

  it('attaching the same label again is a no-op (no duplicate)', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${taskId}/labels/${bugId}`,
      headers: auth(owner.accessToken),
    });
    const task = await getTask();
    expect(task.json().labels).toHaveLength(1);
  });

  it('detaches a label from a task', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/tasks/${taskId}/labels/${bugId}`,
      headers: auth(owner.accessToken),
    });
    expect(res.statusCode).toBe(204);
    const task = await getTask();
    expect(task.json().labels).toHaveLength(0);
  });

  it('rejects attaching a label from another project (400)', async () => {
    const otherProj = await app.inject({
      method: 'POST',
      url: `/api/v1/orgs/${orgId}/projects`,
      headers: auth(owner.accessToken),
      payload: { name: 'Mobile' },
    });
    const otherLabel = await createLabelIn(otherProj.json().id, 'urgent');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${taskId}/labels/${otherLabel}`,
      headers: auth(owner.accessToken),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('LABEL_PROJECT_MISMATCH');
  });

  it('forbids a non-admin member from deleting a label', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/labels/${bugId}`,
      headers: auth(member.accessToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it('deletes a label (OWNER) and cascades the task_label join rows', async () => {
    // attach, then delete the label — the task should end up with no labels
    await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${taskId}/labels/${bugId}`,
      headers: auth(owner.accessToken),
    });
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/labels/${bugId}`,
      headers: auth(owner.accessToken),
    });
    expect(del.statusCode).toBe(204);

    const task = await getTask();
    expect(task.json().labels).toHaveLength(0);
  });

  // helper hoisted below
  async function createLabelIn(pid, name) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${pid}/labels`,
      headers: auth(owner.accessToken),
      payload: { name },
    });
    return res.json().id;
  }
});
