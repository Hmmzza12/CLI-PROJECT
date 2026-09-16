import * as schema from './schema.js';
import { config, usingTurso } from '../config.js';

/**
 * Pick the driver at load time:
 *  - Turso/libSQL when TURSO_DATABASE_URL is set (hosted, persistent).
 *  - better-sqlite3 file otherwise (local dev + tests).
 *
 * Drizzle's query builders are awaitable on BOTH drivers, so nothing in the
 * service layer changes between them.
 */
let db;
let client;

if (usingTurso) {
  const { createClient } = await import('@libsql/client');
  const { drizzle } = await import('drizzle-orm/libsql');
  client = createClient({ url: config.turso.url, authToken: config.turso.authToken });
  db = drizzle(client, { schema });
} else {
  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const sqlite = new Database(config.databaseUrl);
  sqlite.pragma('journal_mode = WAL'); // better concurrent reads
  sqlite.pragma('foreign_keys = ON'); // enforce cascades / set-null
  client = sqlite;
  db = drizzle(sqlite, { schema });
}

export { db, client };
// Backwards-compatible alias (seed.js and older imports used `sqlite`).
export const sqlite = client;
