import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'node:crypto';
import { config } from '../config.js';

/**
 * Sign a short-lived access token (JWT). The payload carries the minimum the
 * API needs to identify the caller without a DB round-trip.
 */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl },
  );
}

/** Verify an access token, returning its payload. Throws if invalid/expired. */
export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

/**
 * Refresh tokens are opaque random strings. We hand the raw value to the
 * client but only ever persist its SHA-256 hash, so a leaked DB can't be used
 * to mint sessions. Rotation + logout are handled by revoking the stored row.
 */
export function generateRefreshToken() {
  const token = randomBytes(48).toString('hex');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiry() {
  const ms = config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
}
