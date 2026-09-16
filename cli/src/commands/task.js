import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { api } from '../lib/api.js';
import { requireAuth, requireActiveProject, loadConfig } from '../lib/config.js';
import { action, isJson } from '../lib/command.js';
import { resolveTaskRef, resolveLabelByName } from '../lib/resolve.js';
import {
  withSpinner,
  success,
  info,
  json,
  print,
  shortId,
  colorStatus,
  renderTasksTable,
  renderTaskDetail,
  paginationFooter,
} from '../lib/output.js';

const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function friendly(message) {
  const err = new Error(message);
  err.isFriendly = true;
  return err;
}

const toInt = (v) => Number.parseInt(v, 10);

/** Assignee fragment for the task PATCH body (uses `assigneeEmail`). */
function assigneePatch(value) {
  const v = String(value).trim().toLowerCase();
  if (v === '' || v === 'none') return { assigneeId: null };
  if (v === 'me') return { assigneeEmail: loadConfig().user?.email };
  return { assigneeEmail: value };
}

/** Assignee body for the dedicated /assign endpoint (uses `email`). */
function assignBody(value) {
  const v = String(value).trim().toLowerCase();
  if (v === '' || v === 'none') return { assigneeId: null };
  if (v === 'me') return { email: loadConfig().user?.email };
  return { email: value };
}

export function registerTask(program) {
  const task = program.command('task').description('Tasks in the active project');

  // forge task add <title>
  task
    .command('add <title>')
    .description('Create a task (prompts for priority + assignee)')
    .option('-p, --priority <priority>', 'LOW | MEDIUM | HIGH | URGENT')
    .option('-a, --assignee <email>', 'assignee email, or "me"')
    .option('-d, --description <text>', 'description')
    .option('--status <status>', 'TODO | IN_PROGRESS | IN_REVIEW | DONE')
    .action(
      action(async (title, opts, command) => {
        requireAuth();
        const project = requireActiveProject();
        const jsonMode = isJson(command);
        const interactive = !jsonMode && process.stdout.isTTY;

        let priority = opts.priority;
        if (!priority && interactive) {
          priority = await select({
            message: 'Priority',
            choices: PRIORITIES.map((p) => ({ name: p, value: p })),
            default: 'MEDIUM',
          });
        }

        let assignee = opts.assignee;
        if (assignee === undefined && interactive) {
          const answer = await input({
            message: 'Assignee email (blank = none, "me" = you):',
          });
          assignee = answer.trim() || undefined;
        }

        const body = { title };
        if (opts.description) body.description = opts.description;
        if (opts.status) body.status = opts.status;
        if (priority) body.priority = priority;
        if (assignee) Object.assign(body, assigneePatch(assignee));

        const created = await withSpinner(
          'Creating task…',
          () => api.post(`/projects/${project.id}/tasks`, body),
          { json: jsonMode },
        );
        if (jsonMode) return json(created);
        success(`Created ${chalk.bold(created.title)} ${chalk.dim(`#${shortId(created.id)}`)}`);
      }),
    );

  // forge task list [--status --assignee --priority --label --search --page --limit]
  task
    .command('list')
    .description('List tasks in the active project')
    .option('-s, --status <status>', 'filter by status')
    .option('-a, --assignee <assignee>', 'filter by assignee email or "me"')
    .option('-p, --priority <priority>', 'filter by priority')
    .option('-l, --label <labelName>', 'filter by label name')
    .option('--search <text>', 'search title & description')
    .option('--page <n>', 'page number', toInt)
    .option('--limit <n>', 'results per page (max 100)', toInt)
    .action(
      action(async (opts, command) => {
        requireAuth();
        const project = requireActiveProject();
        const jsonMode = isJson(command);

        const labelId = opts.label ? (await resolveLabelByName(opts.label)).id : undefined;

        const res = await withSpinner(
          'Loading tasks…',
          () =>
            api.get(`/projects/${project.id}/tasks`, {
              status: opts.status,
              assignee: opts.assignee,
              priority: opts.priority,
              label: labelId,
              search: opts.search,
              page: opts.page,
              limit: opts.limit,
            }),
          { json: jsonMode },
        );
        if (jsonMode) return json(res);
        print(chalk.dim(`Project: ${project.name}`));
        print(renderTasksTable(res.data));
        print(paginationFooter(res.meta));
      }),
    );

  // forge task view <taskId>
  task
    .command('view <taskId>')
    .description('Show full detail for a task')
    .action(
      action(async (idOrPrefix, opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        const id = await resolveTaskRef(idOrPrefix);
        const t = await withSpinner('Loading task…', () => api.get(`/tasks/${id}`), {
          json: jsonMode,
        });
        if (jsonMode) return json(t);
        print(renderTaskDetail(t));
      }),
    );

  // forge task update <taskId>
  task
    .command('update <taskId>')
    .description('Update a task (interactive, or via flags)')
    .option('--title <title>')
    .option('--status <status>', 'TODO | IN_PROGRESS | IN_REVIEW | DONE')
    .option('--priority <priority>', 'LOW | MEDIUM | HIGH | URGENT')
    .option('-a, --assignee <email>', 'email, "me", or "none" to unassign')
    .option('--description <text>')
    .option('--due <date>', 'ISO date, or "none" to clear')
    .action(
      action(async (idOrPrefix, opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        const id = await resolveTaskRef(idOrPrefix);

        const flagKeys = ['title', 'status', 'priority', 'assignee', 'description', 'due'];
        const hasFlags = flagKeys.some((k) => opts[k] !== undefined);
        const interactive = !jsonMode && process.stdout.isTTY && !hasFlags;

        const patch = {};
        if (interactive) {
          const current = await api.get(`/tasks/${id}`);
          patch.status = await select({
            message: 'Status',
            choices: STATUSES.map((s) => ({ name: s, value: s })),
            default: current.status,
          });
          patch.priority = await select({
            message: 'Priority',
            choices: PRIORITIES.map((p) => ({ name: p, value: p })),
            default: current.priority,
          });
          const assignee = await input({
            message: 'Assignee (blank = keep, "none" = unassign, "me" = you):',
          });
          if (assignee.trim()) Object.assign(patch, assigneePatch(assignee.trim()));
        } else {
          if (opts.title) patch.title = opts.title;
          if (opts.status) patch.status = opts.status;
          if (opts.priority) patch.priority = opts.priority;
          if (opts.description !== undefined) patch.description = opts.description;
          if (opts.due !== undefined) patch.dueDate = opts.due === 'none' ? null : opts.due;
          if (opts.assignee !== undefined) Object.assign(patch, assigneePatch(opts.assignee));
        }

        if (Object.keys(patch).length === 0) throw friendly('Nothing to update.');

        const updated = await withSpinner(
          'Updating task…',
          () => api.patch(`/tasks/${id}`, patch),
          { json: jsonMode },
        );
        if (jsonMode) return json(updated);
        success(`Updated ${chalk.dim(`#${shortId(updated.id)}`)}`);
        print(renderTaskDetail(updated));
      }),
    );

  // forge task assign <taskId> <email>
  task
    .command('assign <taskId> <email>')
    .description('Assign a task to a user by email ("me" / "none" also work)')
    .action(
      action(async (idOrPrefix, email, opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        const id = await resolveTaskRef(idOrPrefix);
        const updated = await withSpinner(
          'Assigning…',
          () => api.patch(`/tasks/${id}/assign`, assignBody(email)),
          { json: jsonMode },
        );
        if (jsonMode) return json(updated);
        success(
          `Assigned ${chalk.dim(`#${shortId(updated.id)}`)} to ${
            updated.assignee ? chalk.bold(updated.assignee.email) : 'nobody'
          }`,
        );
      }),
    );

  // forge task done <taskId>
  task
    .command('done <taskId>')
    .description('Shortcut to mark a task DONE')
    .action(
      action(async (idOrPrefix, opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        const id = await resolveTaskRef(idOrPrefix);
        const updated = await withSpinner(
          'Marking done…',
          () => api.patch(`/tasks/${id}`, { status: 'DONE' }),
          { json: jsonMode },
        );
        if (jsonMode) return json(updated);
        success(`${chalk.bold(updated.title)} → ${colorStatus('DONE')}`);
      }),
    );

  // forge task delete <taskId>
  task
    .command('delete <taskId>')
    .description('Delete a task')
    .option('-y, --yes', 'skip the confirmation prompt')
    .action(
      action(async (idOrPrefix, opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        const id = await resolveTaskRef(idOrPrefix);

        if (!opts.yes && !jsonMode && process.stdout.isTTY) {
          const ok = await confirm({
            message: `Delete task #${shortId(id)}? This cannot be undone.`,
            default: false,
          });
          if (!ok) {
            info('Cancelled.');
            return;
          }
        }

        await withSpinner('Deleting…', () => api.delete(`/tasks/${id}`), { json: jsonMode });
        if (jsonMode) return json({ deleted: true, id });
        success(`Deleted task ${chalk.dim(`#${shortId(id)}`)}`);
      }),
    );

  // forge task label <taskId> <labelName>
  task
    .command('label <taskId> <labelName>')
    .description('Attach a label (by name) to a task')
    .action(
      action(async (idOrPrefix, labelName, opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        const id = await resolveTaskRef(idOrPrefix);
        const label = await resolveLabelByName(labelName);
        const res = await withSpinner(
          'Attaching label…',
          () => api.post(`/tasks/${id}/labels/${label.id}`),
          { json: jsonMode },
        );
        if (jsonMode) return json(res);
        success(`Attached ${chalk.hex(label.color)(label.name)} to ${chalk.dim(`#${shortId(id)}`)}`);
      }),
    );

  // forge task unlabel <taskId> <labelName>
  task
    .command('unlabel <taskId> <labelName>')
    .description('Detach a label (by name) from a task')
    .action(
      action(async (idOrPrefix, labelName, opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        const id = await resolveTaskRef(idOrPrefix);
        const label = await resolveLabelByName(labelName);
        await withSpinner(
          'Detaching label…',
          () => api.delete(`/tasks/${id}/labels/${label.id}`),
          { json: jsonMode },
        );
        if (jsonMode) return json({ detached: true, taskId: id, labelId: label.id });
        success(`Detached ${chalk.hex(label.color)(label.name)} from ${chalk.dim(`#${shortId(id)}`)}`);
      }),
    );
}
