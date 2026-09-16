import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { api } from '../lib/api.js';
import { saveConfig, requireAuth, requireActiveOrg, loadConfig } from '../lib/config.js';
import { action, isJson } from '../lib/command.js';
import {
  withSpinner,
  success,
  info,
  json,
  print,
  renderOrgsTable,
  renderMembersTable,
  paginationFooter,
} from '../lib/output.js';

const toInt = (v) => Number.parseInt(v, 10);

function friendly(message) {
  const err = new Error(message);
  err.isFriendly = true;
  return err;
}

/** Resolve a member's userId from their email within an org. */
async function resolveMemberUserId(orgId, email) {
  const res = await api.get(`/orgs/${orgId}/members`, { limit: 100 });
  const members = res.data ?? res;
  const found = members.find((m) => m.email.toLowerCase() === String(email).toLowerCase());
  if (!found) throw friendly(`No member with email "${email}" in this organization.`);
  return found.userId;
}

export function registerOrg(program) {
  const org = program.command('org').description('Organizations (workspaces)');

  org
    .command('create <name>')
    .description('Create an organization and set it as active')
    .action(
      action(async (name, opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        const created = await withSpinner(
          'Creating organization…',
          () => api.post('/orgs', { name }),
          { json: jsonMode },
        );
        saveConfig({
          activeOrg: { id: created.id, slug: created.slug, name: created.name },
        });
        if (jsonMode) return json(created);
        success(`Created organization ${chalk.bold(created.name)} (${created.slug})`);
        info('Set as your active organization.');
      }),
    );

  org
    .command('list')
    .description('List organizations you belong to')
    .action(
      action(async (opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        const orgs = await withSpinner('Loading organizations…', () => api.get('/orgs'), {
          json: jsonMode,
        });
        if (jsonMode) return json(orgs);
        print(renderOrgsTable(orgs, loadConfig().activeOrg?.id));
      }),
    );

  org
    .command('use <name>')
    .description('Set the active organization by name, slug, or id')
    .action(
      action(async (name, opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        const orgs = await withSpinner('Loading organizations…', () => api.get('/orgs'), {
          json: jsonMode,
        });
        const needle = name.toLowerCase();
        const match =
          orgs.find((o) => o.slug === needle || o.name.toLowerCase() === needle) ??
          orgs.find((o) => o.id === name || o.id.startsWith(name));
        if (!match) {
          const err = new Error(`No organization matching "${name}".`);
          err.isFriendly = true;
          throw err;
        }
        saveConfig({ activeOrg: { id: match.id, slug: match.slug, name: match.name } });
        if (jsonMode) return json({ activeOrg: { id: match.id, slug: match.slug, name: match.name } });
        success(`Active organization set to ${chalk.bold(match.name)}`);
      }),
    );

  org
    .command('invite <email>')
    .description('Invite an existing user to the active org (as MEMBER)')
    .action(
      action(async (email, opts, command) => {
        requireAuth();
        const activeOrg = requireActiveOrg();
        const jsonMode = isJson(command);
        const member = await withSpinner(
          'Inviting member…',
          () => api.post(`/orgs/${activeOrg.id}/members`, { email }),
          { json: jsonMode },
        );
        if (jsonMode) return json(member);
        success(`Invited ${chalk.bold(member.email)} to ${chalk.bold(activeOrg.name)}`);
      }),
    );

  org
    .command('members')
    .description('List members of the active org')
    .option('--page <n>', 'page number', toInt)
    .option('--limit <n>', 'results per page (max 100)', toInt)
    .action(
      action(async (opts, command) => {
        requireAuth();
        const activeOrg = requireActiveOrg();
        const jsonMode = isJson(command);
        const res = await withSpinner(
          'Loading members…',
          () => api.get(`/orgs/${activeOrg.id}/members`, { page: opts.page, limit: opts.limit }),
          { json: jsonMode },
        );
        if (jsonMode) return json(res);
        print(chalk.dim(`Org: ${activeOrg.name}`));
        print(renderMembersTable(res.data));
        print(paginationFooter(res.meta));
      }),
    );

  org
    .command('role <email> <role>')
    .description('Change a member’s role (OWNER | ADMIN | MEMBER)')
    .action(
      action(async (email, role, opts, command) => {
        requireAuth();
        const activeOrg = requireActiveOrg();
        const jsonMode = isJson(command);
        const userId = await resolveMemberUserId(activeOrg.id, email);
        const updated = await withSpinner(
          'Updating role…',
          () =>
            api.patch(`/orgs/${activeOrg.id}/members/${userId}`, {
              role: String(role).toUpperCase(),
            }),
          { json: jsonMode },
        );
        if (jsonMode) return json(updated);
        success(`${chalk.bold(updated.email)} is now ${chalk.bold(updated.role)}`);
      }),
    );

  org
    .command('remove <email>')
    .description('Remove a member from the active org')
    .option('-y, --yes', 'skip the confirmation prompt')
    .action(
      action(async (email, opts, command) => {
        requireAuth();
        const activeOrg = requireActiveOrg();
        const jsonMode = isJson(command);
        const userId = await resolveMemberUserId(activeOrg.id, email);

        if (!opts.yes && !jsonMode && process.stdout.isTTY) {
          const ok = await confirm({
            message: `Remove ${email} from ${activeOrg.name}?`,
            default: false,
          });
          if (!ok) {
            info('Cancelled.');
            return;
          }
        }

        await withSpinner(
          'Removing member…',
          () => api.delete(`/orgs/${activeOrg.id}/members/${userId}`),
          { json: jsonMode },
        );
        if (jsonMode) return json({ removed: true, email });
        success(`Removed ${chalk.bold(email)} from ${chalk.bold(activeOrg.name)}`);
      }),
    );
}
