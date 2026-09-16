import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { api } from '../lib/api.js';
import { requireAuth, requireActiveProject } from '../lib/config.js';
import { action, isJson } from '../lib/command.js';
import { resolveLabelByName } from '../lib/resolve.js';
import { withSpinner, success, info, json, print, renderLabelsTable } from '../lib/output.js';

const DEFAULT_COLOR = '#6366f1';

export function registerLabel(program) {
  const label = program.command('label').description('Labels in the active project');

  label
    .command('create <name> [color]')
    .description('Create a label (color defaults to #6366f1)')
    .action(
      action(async (name, color, opts, command) => {
        requireAuth();
        const project = requireActiveProject();
        const jsonMode = isJson(command);
        const created = await withSpinner(
          'Creating label…',
          () => api.post(`/projects/${project.id}/labels`, { name, color: color ?? DEFAULT_COLOR }),
          { json: jsonMode },
        );
        if (jsonMode) return json(created);
        success(`Created label ${chalk.hex(created.color)(created.name)}`);
      }),
    );

  label
    .command('list')
    .description('List labels in the active project')
    .action(
      action(async (opts, command) => {
        requireAuth();
        const project = requireActiveProject();
        const jsonMode = isJson(command);
        const labels = await withSpinner(
          'Loading labels…',
          () => api.get(`/projects/${project.id}/labels`),
          { json: jsonMode },
        );
        if (jsonMode) return json(labels);
        print(renderLabelsTable(labels));
      }),
    );

  // Bonus (symmetry with the API's DELETE /labels/:id): delete by name.
  label
    .command('delete <name>')
    .description('Delete a label by name (OWNER/ADMIN only)')
    .option('-y, --yes', 'skip the confirmation prompt')
    .action(
      action(async (name, opts, command) => {
        requireAuth();
        requireActiveProject();
        const jsonMode = isJson(command);
        const found = await resolveLabelByName(name);

        if (!opts.yes && !jsonMode && process.stdout.isTTY) {
          const ok = await confirm({
            message: `Delete label "${found.name}"? It will be detached from all tasks.`,
            default: false,
          });
          if (!ok) {
            info('Cancelled.');
            return;
          }
        }

        await withSpinner('Deleting label…', () => api.delete(`/labels/${found.id}`), {
          json: jsonMode,
        });
        if (jsonMode) return json({ deleted: true, id: found.id });
        success(`Deleted label ${chalk.hex(found.color)(found.name)}`);
      }),
    );
}
