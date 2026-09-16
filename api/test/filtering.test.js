import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestApp, registerUser, auth } from './helpers.js';

let app;
let owner;
let projectId;
let bugId;

const list = (query = '') =>
  app.inject({
    method: 'GET',
    url: `/api/v1/projects/${projectId}/tasks${query}`,
    headers: auth(owner.accessToken),
  });

beforeAll(async () => {
  ({ app } = await setupTestApp());
  owner = await registerUser(app, { email: 'owner@forge.test', name: 'Owner' });

  const org = await app.inject({
    method: 'POST',
    url: '/api/v1/orgs',
    headers: auth(owner.accessToken),
    payload: { name: 'Acme Inc' },
  });
  const orgId = org.json().id;

  const proj = await app.inject({
    method: 'POST',
    url: `/api/v1/orgs/${orgId}/projects`,
    headers: auth(owner.accessToken),
    payload: { name: 'Website' },
  });
  projectId = proj.json().id;

  const me = owner.user.id;
  const tasks = [
    { title: 'Alpha login', status: 'TODO', priority: 'HIGH', assigneeId: me },
    { title: 'Beta logout', status: 'DONE', priority: 'LOW' },
    { title: 'Gamma dashboard', status: 'TODO', priority: 'URGENT', assigneeId: me },
    { title: 'Delta report', status: 'IN_PROGRESS', priority: 'MEDIUM' },
  ];
  const ids = {};
  for (const t of tasks) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: auth(owner.accessToken),
      payload: t,
    });
    ids[t.title] = res.json().id;
  }

  const label = await app.inject({
    method: 'POST',
    url: `/api/v1/projects/${projectId}/labels`,
    headers: auth(owner.accessToken),
    payload: { name: 'bug', color: '#FF5733' },
  });
  bugId = label.json().id;
  await app.inject({
    method: 'POST',
    url: `/api/v1/tasks/${ids['Alpha login']}/labels/${bugId}`,
    headers: auth(owner.accessToken),
  });
});

describe('task list filtering', () => {
  it('returns the paginated wrapper shape', async () => {
    const body = (await list()).json();
    expect(body).toHaveProperty('data');
    expect(body.meta).toMatchObject({ page: 1, limit: 20, total: 4, totalPages: 1 });
  });

  it('filters by status', async () => {
    const body = (await list('?status=TODO')).json();
    expect(body.data.map((t) => t.title).sort()).toEqual(['Alpha login', 'Gamma dashboard']);
  });

  it('filters by priority', async () => {
    const body = (await list('?priority=URGENT')).json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Gamma dashboard');
  });

  it('filters by assignee=me', async () => {
    const body = (await list('?assignee=me')).json();
    expect(body.data.map((t) => t.title).sort()).toEqual(['Alpha login', 'Gamma dashboard']);
  });

  it('filters by label', async () => {
    const body = (await list(`?label=${bugId}`)).json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Alpha login');
  });

  it('filters by search across title', async () => {
    const body = (await list('?search=log')).json();
    expect(body.data.map((t) => t.title).sort()).toEqual(['Alpha login', 'Beta logout']);
  });

  it('ANDs multiple filters together', async () => {
    const body = (await list('?status=TODO&priority=HIGH')).json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Alpha login');
  });
});

describe('task list pagination', () => {
  it('respects limit and reports meta', async () => {
    const body = (await list('?limit=2&page=1')).json();
    expect(body.data).toHaveLength(2);
    expect(body.meta).toMatchObject({ page: 1, limit: 2, total: 4, totalPages: 2 });
  });

  it('returns the second page', async () => {
    const p1 = (await list('?limit=2&page=1')).json();
    const p2 = (await list('?limit=2&page=2')).json();
    expect(p2.data).toHaveLength(2);
    // pages must not overlap
    const p1Ids = p1.data.map((t) => t.id);
    expect(p2.data.every((t) => !p1Ids.includes(t.id))).toBe(true);
  });

  it('clamps limit to the max of 100', async () => {
    const body = (await list('?limit=9999')).json();
    expect(body.meta.limit).toBe(100);
  });
});
