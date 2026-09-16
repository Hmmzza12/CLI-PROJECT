import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

// When TURSO_DATABASE_URL is set (production / Netlify build), drizzle-kit talks
// to Turso over libSQL so `db:migrate` applies migrations to the hosted database.
// Otherwise it targets the local SQLite file used for dev and tests.
const usingTurso = Boolean(process.env.TURSO_DATABASE_URL);

export default defineConfig({
  schema: './src/db/schema.js',
  out: './drizzle',
  dialect: usingTurso ? 'turso' : 'sqlite',
  dbCredentials: usingTurso
    ? {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : { url: process.env.DATABASE_URL ?? './forge.db' },
  verbose: true,
  strict: true,
});
