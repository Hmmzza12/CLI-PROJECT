import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { organizations, orgMembers } from '../db/schema.js';
import { slugify } from '../utils/slug.js';
import { errors } from '../utils/errors.js';

async function uniqueSlug(base) {
  const root = slugify(base) || 'org';
  let candidate = root;
  let n = 1;
  // Cheap loop; org creation is rare and this avoids catching driver errors.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [hit] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

export async function createOrg(user, { name, slug }) {
  const finalSlug = await uniqueSlug(slug || name);

  const [org] = await db
    .insert(organizations)
    .values({ name, slug: finalSlug })
    .returning();

  await db.insert(orgMembers).values({
    userId: user.id,
    orgId: org.id,
    role: 'OWNER',
  });

  return { ...org, role: 'OWNER' };
}

export async function listOrgs(user) {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      createdAt: organizations.createdAt,
      role: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, user.id));

  return rows;
}

/** Resolve an org the caller belongs to, by slug or id. Throws 404 otherwise. */
export async function getOrgBySlugOrId(user, slugOrId) {
  const rows = await listOrgs(user);
  const org = rows.find((o) => o.slug === slugOrId || o.id === slugOrId);
  if (!org) {
    throw errors.notFound('Organization not found or you are not a member', 'ORG_NOT_FOUND');
  }
  return org;
}
