import * as orgService from '../services/org.service.js';
import { createOrgSchema } from '../validation/schemas.js';

export async function create(req, reply) {
  const body = createOrgSchema.parse(req.body);
  const org = await orgService.createOrg(req.user, body);
  return reply.code(201).send(org);
}

export async function list(req) {
  return orgService.listOrgs(req.user);
}
