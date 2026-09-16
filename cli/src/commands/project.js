import chalk from 'chalk';
import { api } from '../lib/api.js';
import { saveConfig, requireAuth, requireActiveOrg, loadConfig } from '../lib/config.js';
import { action, isJson } from '../lib/command.js';
import { withSpinner, success, info, json, print, renderProjectsTable } from '../lib/output.js';

export function registerProject(program) {
  const project = program.command('project').description('Projects');

  project
    .command('create <name>')
    .description('Create a project in the active org and set it as active')
    .option('-d, --description <text>', 'project description')
    .action(
      action(async (name, opts, command) => {
        requireAuth();
        const activeOrg = requireActiveOrg();
        const jsonMode = isJson(command);
        const created = await withSpinner(
          'Creating project…',
          () =>
            api.post(`/orgs/${activeOrg.id}/projects`, {
              name,
              description: opts.description,
            }),
          { json: jsonMode },
        );
        saveConfig({ activeProject: { id: created.id, name: created.name } });
        if (jsonMode) return json(created);
        success(`Created project ${chalk.bold(created.name)}`);
        info('Set as your active project.');
      }),
    );

  project
    .command('list')
    .description('List projects in the active org')
    .action(
      action(async (opts, command) => {
        requireAuth();
        const activeOrg = requireActiveOrg();
        const jsonMode = isJson(command);
        const projects = await withSpinner(
          'Loading projects…',
          () => api.get(`/orgs/${activeOrg.id}/projects`),
          { json: jsonMode },
        );
        if (jsonMode) return json(projects);
        print(chalk.dim(`Org: ${activeOrg.name}`));
        print(renderProjectsTable(projects, loadConfig().activeProject?.id));
      }),
    );

  project
    .command('use <name>')
    .description('Set the active project by name or id')
    .action(
      action(async (name, opts, command) => {
        requireAuth();
        const activeOrg = requireActiveOrg();
        const jsonMode = isJson(command);
        const projects = await withSpinner(
          'Loading projects…',
          () => api.get(`/orgs/${activeOrg.id}/projects`),
          { json: jsonMode },
        );
        const needle = name.toLowerCase();
        const match =
          projects.find((p) => p.name.toLowerCase() === needle) ??
          projects.find((p) => p.id === name || p.id.startsWith(name));
        if (!match) {
          const err = new Error(`No project matching "${name}" in ${activeOrg.name}.`);
          err.isFriendly = true;
          throw err;
        }
        saveConfig({ activeProject: { id: match.id, name: match.name } });
        if (jsonMode) return json({ activeProject: { id: match.id, name: match.name } });
        success(`Active project set to ${chalk.bold(match.name)}`);
      }),
    );
}
