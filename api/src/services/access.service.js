import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orgMembers } from '../db/schema.js';
import { errors } from '../utils/errors.js';

/**
 * Return the caller's membership row for an org, or throw 403 if they are not
 * a member. This is the single gate every org-scoped resource passes through.
 */
export async function requireMembership(userId, orgId) {
  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);

  if (!membership) {
    throw errors.forbidden('You are not a member of this organization', 'NOT_A_MEMBER');
  }
  return membership;
}

/**
 * Like requireMembership, but also asserts the member holds one of `roles`.
 * Used for owner/admin-only actions (delete project, manage members, ...).
 */
export async function requireRole(userId, orgId, roles) {
  const membership = await requireMembership(userId, orgId);
  if (!roles.includes(membership.role)) {
    throw errors.forbidden(
      `This action requires one of: ${roles.join(', ')}`,
      'INSUFFICIENT_ROLE',
    );
  }
  return membership;
}
