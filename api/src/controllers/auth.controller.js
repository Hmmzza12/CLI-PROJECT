import * as authService from '../services/auth.service.js';
import { config } from '../config.js';
import { registerSchema, loginSchema } from '../validation/schemas.js';

const REFRESH_COOKIE = 'refreshToken';
const COOKIE_PATH = '/api/v1/auth';

// The refresh token doubles as an httpOnly cookie for the web client (the CLI
// keeps using the body token). Scoped to the auth routes so it's only sent
// where it's needed.
function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: COOKIE_PATH,
    maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60,
  };
}

export async function register(req, reply) {
  const body = registerSchema.parse(req.body);
  const result = await authService.register(body);
  reply.setCookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
  return reply.code(201).send(result);
}

export async function login(req, reply) {
  const body = loginSchema.parse(req.body);
  const result = await authService.login(body);
  reply.setCookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
  return result;
}

export async function refresh(req, reply) {
  // Accept the token from the body (CLI) or the httpOnly cookie (web).
  const token = req.body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
  const result = await authService.refresh(token); // throws 401 if missing/invalid
  reply.setCookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
  return result;
}

export async function logout(req, reply) {
  const token = req.body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
  await authService.logout(token);
  reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  return reply.code(200).send({ success: true });
}

export async function me(req) {
  return req.user;
}
