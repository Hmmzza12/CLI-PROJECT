import * as schema from './schema.js';
import { config, usingTurso } from '../config.js';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { createRequire } from 'node:module';

/**
 * Pick the driver at load time:
 *  - Turso/libSQL when TURSO_DATABASE_URL is set (hosted, persistent).
 *  - better-sqlite3 file otherwise (local dev + tests).
 *
 * No top-level `await` on purpose: this module gets bundled into a CommonJS
 * serverless function, and esbuild can't emit CJS for top-level await. The
 * libSQL driver is imported statically (it's the hosted path); the synchronous
 * better-sqlite3 driver is loaded via `require` only on the local path.
 *
 * Drizzle's query builders are awaitable on BOTH drivers, so nothing in the
 * service layer changes between them.
 */
let db;
let client;

if (usingTurso) {
  client = createClient({ url: config.turso.url, authToken: config.turso.authToken });
  db = drizzleLibsql(client, { schema });
} else {
  // Local/dev/test only (always runs as native ESM, so import.meta.url is real).
  const require = createRequire(import.meta.url);
  const Database = require('better-sqlite3');
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  const sqlite = new Database(config.databaseUrl);
  sqlite.pragma('journal_mode = WAL'); // better concurrent reads
  sqlite.pragma('foreign_keys = ON'); // enforce cascades / set-null
  client = sqlite;
  db = drizzle(sqlite, { schema });
}

export { db, client };
// Backwards-compatible alias (seed.js and older imports used `sqlite`).
export const sqlite = client;
