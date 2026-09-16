import { z } from 'zod';

/**
 * The environment contract for the API. Parsed once at server startup so the
 * process fails fast (exit 1) with a clear message rather than booting into a
 * half-configured state.
 *
 * Note: this project's JWT signing secret is `JWT_ACCESS_SECRET` (the access
 * token secret) — the equivalent of the brief's "JWT_SECRET".
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  // Local file DB (default) — or Turso/libSQL when the TURSO vars are set.
  DATABASE_URL: z.string().min(1).default('./forge.db'),
  TURSO_DATABASE_URL: z.string().optional(),
  TURSO_AUTH_TOKEN: z.string().optional(),
  // The only truly-required secrets.
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SEED_ON_START: z.string().optional(),
  WEB_DIST: z.string().optional(),
});

/** Pure parse — returns a Zod SafeParseReturnType without side effects. */
export function parseEnv(env = process.env) {
  return envSchema.safeParse(env);
}

/**
 * Validate process.env against the schema. On failure, print every problem and
 * exit(1). Returns the parsed, typed env on success.
 */
export function validateEnv(env = process.env) {
  const parsed = parseEnv(env);
  if (!parsed.success) {
    console.error('\n❌ Invalid environment configuration — the server cannot start:\n');
    for (const issue of parsed.error.issues) {
      console.error(`   • ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nSet the missing variables (see api/.env.example) and try again.\n');
    process.exit(1);
  }
  return parsed.data;
}
