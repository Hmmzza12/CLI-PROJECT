import * as memberService from '../services/member.service.js';
import {
  inviteMemberSchema,
  changeRoleSchema,
  paginationQuerySchema,
} from '../validation/schemas.js';

export async function invite(req, reply) {
  const body = inviteMemberSchema.parse(req.body);
  const member = await memberService.inviteMember(req.user, req.params.orgId, body);
  return reply.code(201).send(member);
}

export async function list(req) {
  const query = paginationQuerySchema.parse(req.query ?? {});
  return memberService.listMembers(req.user, req.params.orgId, query);
}

export async function changeRole(req) {
  const { role } = changeRoleSchema.parse(req.body);
  return memberService.changeRole(req.user, req.params.orgId, req.params.userId, role);
}

export async function remove(req, reply) {
  await memberService.removeMember(req.user, req.params.orgId, req.params.userId);
  return reply.code(204).send();
}
