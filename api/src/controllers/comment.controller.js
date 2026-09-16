import * as commentService from '../services/comment.service.js';
import { createCommentSchema, paginationQuerySchema } from '../validation/schemas.js';

export async function create(req, reply) {
  const body = createCommentSchema.parse(req.body);
  const comment = await commentService.createComment(req.user, req.params.taskId, body);
  return reply.code(201).send(comment);
}

export async function list(req) {
  const query = paginationQuerySchema.parse(req.query ?? {});
  return commentService.listComments(req.user, req.params.taskId, query);
}

export async function remove(req, reply) {
  await commentService.deleteComment(req.user, req.params.commentId);
  return reply.code(204).send();
}
