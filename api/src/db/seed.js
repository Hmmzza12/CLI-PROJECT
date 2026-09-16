import { eq } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import { db, sqlite } from './index.js';
import { users, organizations, orgMembers, projects, tasks } from './schema.js';
import { hashPassword } from '../utils/password.js';

const DEMO_EMAIL = 'demo@forge.dev';
const DEMO_PASSWORD = 'password123';

/** Idempotent demo seed. Safe to call on every boot. Never closes the client. */
export async function seed() {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);
  if (existing) return { seeded: false };

  const [user] = await db
    .insert(users)
    .values({ email: DEMO_EMAIL, name: 'Demo User', password: await hashPassword(DEMO_PASSWORD) })
    .returning();

  const [org] = await db
    .insert(organizations)
    .values({ name: 'Acme Inc', slug: 'acme' })
    .returning();

  await db.insert(orgMembers).values({ userId: user.id, orgId: org.id, role: 'OWNER' });

  const [project] = await db
    .insert(projects)
    .values({ name: 'Website Redesign', description: 'Q3 marketing site refresh', orgId: org.id })
    .returning();

  const now = new Date();
  await db.insert(tasks).values([
    { title: 'Set up design system', status: 'IN_PROGRESS', priority: 'HIGH', projectId: project.id, reporterId: user.id, assigneeId: user.id, updatedAt: now },
    { title: 'Write landing page copy', status: 'TODO', priority: 'MEDIUM', projectId: project.id, reporterId: user.id, updatedAt: now },
    { title: 'Fix mobile nav overflow', status: 'TODO', priority: 'URGENT', projectId: project.id, reporterId: user.id, assigneeId: user.id, updatedAt: now },
    { title: 'Deploy to staging', status: 'DONE', priority: 'LOW', projectId: project.id, reporterId: user.id, updatedAt: now },
  ]);

  return { seeded: true, email: DEMO_EMAIL, password: DEMO_PASSWORD };
}

// Allow running as a script: `node src/db/seed.js`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed()
    .then((result) => {
      if (result.seeded) {
        console.log('✔ Seeded demo data');
        console.log(`  Login: ${result.email} / ${result.password}`);
      } else {
        console.log(`Seed skipped — ${DEMO_EMAIL} already exists.`);
      }
      sqlite.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      sqlite.close();
      process.exit(1);
    });
}
