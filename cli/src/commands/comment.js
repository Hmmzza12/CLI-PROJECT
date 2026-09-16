import { input } from '@inquirer/prompts';
import { api } from '../lib/api.js';
import { requireAuth } from '../lib/config.js';
import { action, isJson } from '../lib/command.js';
import { resolveTaskRef } from '../lib/resolve.js';
import {
  withSpinner,
  success,
  json,
  print,
  shortId,
  renderCommentsTable,
  paginationFooter,
} from '../lib/output.js';

const toInt = (v) => Number.parseInt(v, 10);

function friendly(message) {
  const err = new Error(message);
  err.isFriendly = true;
  return err;
}

export function registerComment(program) {
  const comment = program.command('comment').description('Task comments');

  comment
    .command('add <taskId>')
    .description('Add a comment to a task (prompts for the body)')
    .option('-b, --body <text>', 'comment body (prompted if omitted)')
    .action(
      action(async (idOrPrefix, opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        const id = await resolveTaskRef(idOrPrefix);

        let body = opts.body;
        if (!body && !jsonMode && process.stdout.isTTY) {
          body = await input({ message: 'Comment:' });
        }
        if (!body || !body.trim()) throw friendly('A comment body is required (use --body).');

        const created = await withSpinner(
          'Posting comment…',
          () => api.post(`/tasks/${id}/comments`, { body }),
          { json: jsonMode },
        );
        if (jsonMode) return json(created);
        success(`Comment added to ${`#${shortId(id)}`}`);
      }),
    );

  comment
    .command('list <taskId>')
    .description('List comments on a task (newest first)')
    .option('--page <n>', 'page number', toInt)
    .option('--limit <n>', 'results per page (max 100)', toInt)
    .action(
      action(async (idOrPrefix, opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        const id = await resolveTaskRef(idOrPrefix);
        const res = await withSpinner(
          'Loading comments…',
          () => api.get(`/tasks/${id}/comments`, { page: opts.page, limit: opts.limit }),
          { json: jsonMode },
        );
        if (jsonMode) return json(res);
        print(renderCommentsTable(res.data));
        print(paginationFooter(res.meta));
      }),
    );

  comment
    .command('delete <commentId>')
    .description('Delete a comment (author or org admin/owner)')
    .action(
      action(async (commentId, opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        await withSpinner(
          'Deleting comment…',
          () => api.delete(`/comments/${commentId}`),
          { json: jsonMode },
        );
        if (jsonMode) return json({ deleted: true, id: commentId });
        success(`Deleted comment ${shortId(commentId)}`);
      }),
    );
}
