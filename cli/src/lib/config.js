import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const CONFIG_DIR = join(homedir(), '.forge');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  // Origin only — the API client appends `/api/v1`. Defaults to the hosted
  // production API so `npx forge-cli auth login` works with zero setup.
  // Override with FORGE_API_URL, e.g. a local dev server:
  // FORGE_API_URL=http://127.0.0.1:3000 (127.0.0.1, not "localhost", avoids the
  // Windows IPv6 ::1 resolution pitfall when the local API binds to 0.0.0.0).
  apiUrl: process.env.FORGE_API_URL || 'https://forgecli.netlify.app',
};

export const configPath = CONFIG_FILE;

export function loadConfig() {
  try {
    if (!existsSync(CONFIG_FILE)) return { ...DEFAULTS };
    const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    return { ...DEFAULTS, ...raw };
  } catch {
    // A corrupt config shouldn't hard-crash the CLI.
    return { ...DEFAULTS };
  }
}

function write(config) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`);
}

/** Merge a patch into the stored config and persist it. */
export function saveConfig(patch) {
  const next = { ...loadConfig(), ...patch };
  write(next);
  return next;
}

export function setSession({ user, accessToken, refreshToken }) {
  return saveConfig({ user, accessToken, refreshToken });
}

export function clearSession() {
  const config = loadConfig();
  delete config.user;
  delete config.accessToken;
  delete config.refreshToken;
  write(config);
}

export function requireAuth() {
  const isFirstRun = !existsSync(CONFIG_FILE);
  const config = loadConfig();
  if (!config.accessToken) {
    const err = new Error(
      isFirstRun
        ? 'Welcome to Forge! Run `forge auth login` to get started (no account yet? ' +
          'register at https://forgecli.netlify.app).'
        : 'You are not logged in. Run `forge auth login` first.',
    );
    err.isFriendly = true;
    throw err;
  }
  return config;
}

export function requireActiveOrg() {
  const config = loadConfig();
  if (!config.activeOrg?.id) {
    const err = new Error(
      'No active organization. Create one with `forge org create <name>`.',
    );
    err.isFriendly = true;
    throw err;
  }
  return config.activeOrg;
}

export function requireActiveProject() {
  const config = loadConfig();
  if (!config.activeProject?.id) {
    const err = new Error(
      'No active project. Select one with `forge project use <name>`.',
    );
    err.isFriendly = true;
    throw err;
  }
  return config.activeProject;
}
