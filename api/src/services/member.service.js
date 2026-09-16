import { and, eq, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orgMembers, users } from '../db/schema.js';
import { requireMembership, requireRole } from './access.service.js';
import { errors } from '../utils/errors.js';
import { paginated } from '../utils/pagination.js';

const memberSelection = {
  userId: users.id,
  name: users.name,
  email: users.email,
  role: orgMembers.role,
  joinedAt: orgMembers.createdAt,
};

async function findUserByEmail(email) {
  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return u ?? null;
}

async function loadMember(orgId, userId) {
  const [member] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);
  return member ?? null;
}

async function countOwners(orgId) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, 'OWNER')));
  return value;
}

async function memberDto(orgId, userId) {
  const [row] = await db
    .select(memberSelection)
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);
  return row;
}

export async function inviteMember(user, orgId, { email }) {
  // Managing members is an OWNER/ADMIN action.
  await requireRole(user.id, orgId, ['OWNER', 'ADMIN']);

  const invitee = await findUserByEmail(email);
  if (!invitee) {
    throw errors.notFound(
      'No registered user with that email — they must create an account first',
      'USER_NOT_FOUND',
    );
  }

  if (await loadMember(orgId, invitee.id)) {
    throw errors.conflict('That user is already a member of this organization', 'ALREADY_MEMBER');
  }

  await db.insert(orgMembers).values({ userId: invitee.id, orgId, role: 'MEMBER' });
  return memberDto(orgId, invitee.id);
}

export async function listMembers(user, orgId, { page, limit }) {
  await requireMembership(user.id, orgId);

  const where = eq(orgMembers.orgId, orgId);
  const [{ value: total }] = await db.select({ value: count() }).from(orgMembers).where(where);

  const rows = await db
    .select(memberSelection)
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(where)
    .orderBy(orgMembers.createdAt)
    .limit(limit)
    .offset((page - 1) * limit);

  return paginated(rows, { page, limit, total });
}

export async function changeRole(user, orgId, targetUserId, role) {
  await requireRole(user.id, orgId, ['OWNER', 'ADMIN']);

  const target = await loadMember(orgId, targetUserId);
  if (!target) {
    throw errors.notFound('That user is not a member of this organization', 'NOT_A_MEMBER');
  }

  // Never let the org drop to zero OWNERs.
  if (target.role === 'OWNER' && role !== 'OWNER' && (await countOwners(orgId)) <= 1) {
    throw errors.conflict(
      'Cannot demote the last owner — promote another member to OWNER first',
      'LAST_OWNER',
    );
  }

  await db
    .update(orgMembers)
    .set({ role })
    .where(and(eq(orgMembers.userId, targetUserId), eq(orgMembers.orgId, orgId)));

  return memberDto(orgId, targetUserId);
}

export async function removeMember(user, orgId, targetUserId) {
  await requireRole(user.id, orgId, ['OWNER', 'ADMIN']);

  const target = await loadMember(orgId, targetUserId);
  if (!target) {
    throw errors.notFound('That user is not a member of this organization', 'NOT_A_MEMBER');
  }

  if (target.role === 'OWNER' && (await countOwners(orgId)) <= 1) {
    throw errors.conflict(
      'Cannot remove the last owner of the organization',
      'LAST_OWNER',
    );
  }

  await db
    .delete(orgMembers)
    .where(and(eq(orgMembers.userId, targetUserId), eq(orgMembers.orgId, orgId)));
}
