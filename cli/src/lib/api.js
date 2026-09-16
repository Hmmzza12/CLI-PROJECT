import { loadConfig, saveConfig, clearSession } from './config.js';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isFriendly = true;
  }
}

function baseUrl() {
  const { apiUrl } = loadConfig();
  // Defensive fallback only — loadConfig() always supplies a default (the
  // hosted production API) via DEFAULTS in config.js.
  return `${(apiUrl || 'https://forgecli.netlify.app').replace(/\/$/, '')}/api/v1`;
}

function buildQuery(query) {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

async function raw(method, path, { body, token, query } = {}) {
  const headers = {};
  // Only advertise a JSON body when we actually send one — otherwise Fastify
  // rejects bodyless requests (e.g. DELETE) that carry a JSON content-type.
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${baseUrl()}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK',
      `Cannot reach the Forge API at ${baseUrl()}. Is the server running?`,
    );
  }
  return res;
}

async function parse(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText, err.details);
  }
  return data;
}

/** Attempt a token refresh. Returns the new access token or null. */
async function tryRefresh() {
  const { refreshToken } = loadConfig();
  if (!refreshToken) return null;
  const res = await raw('POST', '/auth/refresh', { body: { refreshToken } });
  if (!res.ok) return null;
  const data = await res.json();
  saveConfig({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.accessToken;
}

/**
 * Authenticated request with one transparent refresh-and-retry on 401.
 */
async function authed(method, path, opts = {}) {
  const { accessToken } = loadConfig();
  let res = await raw(method, path, { ...opts, token: accessToken });

  if (res.status === 401) {
    const newToken = await tryRefresh();
    if (newToken) {
      res = await raw(method, path, { ...opts, token: newToken });
    } else {
      clearSession();
      throw new ApiError(401, 'SESSION_EXPIRED', 'Your session expired. Please run `forge auth login` again.');
    }
  }
  return parse(res);
}

// Public, unauthenticated (auth endpoints) --------------------------------
export async function post(path, body) {
  return parse(await raw('POST', path, { body }));
}

// Authenticated verbs -----------------------------------------------------
export const api = {
  get: (path, query) => authed('GET', path, { query }),
  post: (path, body) => authed('POST', path, { body }),
  patch: (path, body) => authed('PATCH', path, { body }),
  delete: (path) => authed('DELETE', path),
};
