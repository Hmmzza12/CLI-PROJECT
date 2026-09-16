import { join } from 'node:path';
import { db } from './index.js';
import { usingTurso } from '../config.js';

const migrationsFolder = join(process.cwd(), 'drizzle');

/** Apply pending migrations using the migrator that matches the active driver. */
export async function runMigrations() {
  if (usingTurso) {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    await migrate(db, { migrationsFolder });
  } else {
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
    migrate(db, { migrationsFolder });
  }
}
