import { and, eq, isNull, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, refreshTokens } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
} from '../utils/tokens.js';
import { errors } from '../utils/errors.js';

/** Strip the password hash before a user object ever leaves the service layer. */
function toPublicUser(user) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

async function issueSession(user) {
  const accessToken = signAccessToken(user);
  const { token, tokenHash } = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: refreshTokenExpiry(),
  });

  return { accessToken, refreshToken: token, user: toPublicUser(user) };
}

export async function register({ email, password, name }) {
  const normalizedEmail = email.toLowerCase();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  if (existing) {
    throw errors.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const [user] = await db
    .insert(users)
    .values({ email: normalizedEmail, password: await hashPassword(password), name })
    .returning();

  return issueSession(user);
}

export async function login({ email, password }) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  // Verify against a real hash even when the user is missing to avoid leaking
  // account existence via response timing.
  const ok = user
    ? await verifyPassword(password, user.password)
    : await verifyPassword(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinva');

  if (!user || !ok) {
    throw errors.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  return issueSession(user);
}

export async function refresh(rawToken) {
  if (!rawToken) {
    throw errors.unauthorized('Refresh token is required', 'NO_REFRESH_TOKEN');
  }
  const tokenHash = hashToken(rawToken);

  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) {
    throw errors.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!user) {
    throw errors.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  // Rotate: revoke the presented token and mint a brand new session.
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, row.id));

  return issueSession(user);
}

export async function logout(rawToken) {
  if (!rawToken) return; // Nothing to revoke — treat as a no-op success.
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, hashToken(rawToken)), isNull(refreshTokens.revokedAt)));
}

export { toPublicUser };
