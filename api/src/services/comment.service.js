import { and, eq, desc, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import { comments, users } from '../db/schema.js';
import { requireTaskAccess } from './task.service.js';
import { requireRole } from './access.service.js';
import { errors } from '../utils/errors.js';
import { paginated } from '../utils/pagination.js';

export async function createComment(user, taskId, { body }) {
  await requireTaskAccess(user, taskId);
  const [created] = await db
    .insert(comments)
    .values({ body, taskId, authorId: user.id })
    .returning();
  return {
    ...created,
    author: { id: user.id, email: user.email, name: user.name },
  };
}

export async function listComments(user, taskId, { page, limit }) {
  await requireTaskAccess(user, taskId);

  const where = eq(comments.taskId, taskId);
  const [{ value: total }] = await db.select({ value: count() }).from(comments).where(where);

  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      taskId: comments.taskId,
      createdAt: comments.createdAt,
      author: { id: users.id, email: users.email, name: users.name },
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(where)
    .orderBy(desc(comments.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return paginated(rows, { page, limit, total });
}

export async function deleteComment(user, commentId) {
  const [row] = await db
    .select({ id: comments.id, authorId: comments.authorId, taskId: comments.taskId })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  if (!row) throw errors.notFound('Comment not found', 'COMMENT_NOT_FOUND');

  // Caller must have access to the task's org...
  const ctx = await requireTaskAccess(user, row.taskId);
  // ...and be either the author or an org ADMIN/OWNER.
  if (row.authorId !== user.id) {
    await requireRole(user.id, ctx.orgId, ['OWNER', 'ADMIN']);
  }

  await db.delete(comments).where(eq(comments.id, commentId));
}
