import 'dotenv/config';
import { validateEnv } from './env.js';

// Fail fast on a bad environment BEFORE importing anything that reads config.
const env = validateEnv();

// Import after validation so a misconfigured env never boots the app/db layer.
const { config } = await import('./config.js');
const { runMigrations } = await import('./db/migrate.js');
const { buildApp } = await import('./app.js');

const logger = {
  level: config.isProd ? 'info' : 'debug',
  // Keep secrets out of the logs.
  redact: ['req.headers.authorization', 'body.password', 'body.refreshToken'],
};

const app = buildApp({ logger });

try {
  // Ensure the schema exists (idempotent) — critical for hosted/ephemeral DBs.
  await runMigrations();
  app.log.info('Database migrations applied');

  if (config.seedOnStart) {
    const { seed } = await import('./db/seed.js');
    const result = await seed();
    app.log.info(result.seeded ? `Seeded demo data (${result.email})` : 'Seed skipped (demo data already present)');
  }

  const address = await app.listen({ port: config.port, host: config.host });
  app.log.info(`Forge API ready at ${address} (env: ${env.NODE_ENV})`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
