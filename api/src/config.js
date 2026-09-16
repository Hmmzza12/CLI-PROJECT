import 'dotenv/config';

const env = process.env.NODE_ENV ?? 'development';
const isProd = env === 'production';

/**
 * Read a secret from the environment.
 * In production a missing secret is fatal; in dev/test we fall back to an
 * obviously-fake value so the app still boots. Never ship the fallback.
 */
function secret(name, devFallback) {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (isProd) {
    throw new Error(
      `[config] ${name} is required in production. Set it in the environment or a .env file.`,
    );
  }
  return devFallback;
}

export const config = {
  env,
  isProd,
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL ?? './forge.db',
  // When TURSO_DATABASE_URL is set (production/hosted), the app uses libSQL/Turso
  // instead of a local better-sqlite3 file. Everything else is identical.
  turso: {
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN || '',
  },
  // Run migrations on boot; optionally seed demo data (handy for hosted demos).
  seedOnStart: /^(1|true|yes)$/i.test(process.env.SEED_ON_START ?? ''),
  // Absolute/relative path to the built frontend to serve in production.
  webDist: process.env.WEB_DIST || '',
  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET', 'dev-only-access-secret-change-me'),
    refreshSecret: secret('JWT_REFRESH_SECRET', 'dev-only-refresh-secret-change-me'),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30),
  },
};

/** True when the app should talk to Turso/libSQL rather than a local file. */
export const usingTurso = Boolean(config.turso.url);
