import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';

const STATUS_COLORS = {
  TODO: chalk.gray,
  IN_PROGRESS: chalk.cyan,
  IN_REVIEW: chalk.magenta,
  DONE: chalk.green,
};

const PRIORITY_COLORS = {
  LOW: chalk.gray,
  MEDIUM: chalk.blue,
  HIGH: chalk.yellow,
  URGENT: chalk.red,
};

export const colorStatus = (s) => (STATUS_COLORS[s] ?? chalk.white)(s);
export const colorPriority = (p) => (PRIORITY_COLORS[p] ?? chalk.white)(p);
export const shortId = (id) => (id ? String(id).slice(0, 8) : '');

const dash = chalk.dim('—');
const fmtDate = (v) => (v ? new Date(v).toISOString().slice(0, 10) : dash);

// Plain console writers -------------------------------------------------------
export const print = (msg = '') => console.log(msg);
export const success = (msg) => console.log(`${chalk.green('✔')} ${msg}`);
export const info = (msg) => console.log(`${chalk.cyan('ℹ')} ${msg}`);
export const warn = (msg) => console.log(`${chalk.yellow('⚠')} ${msg}`);
export const errorLine = (msg) => console.error(`${chalk.red('✖')} ${msg}`);
export const json = (data) => console.log(JSON.stringify(data, null, 2));

/** Run an async fn under a spinner (skipped in --json mode). Spinner → stderr. */
export async function withSpinner(text, fn, { json: isJson } = {}) {
  if (isJson) return fn();
  const spinner = ora({ text, stream: process.stderr }).start();
  try {
    const result = await fn();
    spinner.stop();
    return result;
  } catch (err) {
    spinner.stop();
    throw err;
  }
}

function baseTable(head) {
  return new Table({
    head: head.map((h) => chalk.bold(h)),
    style: { head: [], border: [] },
  });
}

export function renderTasksTable(tasks) {
  if (tasks.length === 0) return chalk.dim('No tasks found.');
  const table = baseTable(['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Due']);
  for (const t of tasks) {
    table.push([
      shortId(t.id),
      t.title,
      colorStatus(t.status),
      colorPriority(t.priority),
      t.assignee ? t.assignee.email : dash,
      fmtDate(t.dueDate),
    ]);
  }
  return table.toString();
}

export function renderOrgsTable(orgs, activeId) {
  if (orgs.length === 0) return chalk.dim('No organizations yet. Create one with `forge org create <name>`.');
  const table = baseTable(['', 'Name', 'Slug', 'Role', 'ID']);
  for (const o of orgs) {
    table.push([
      o.id === activeId ? chalk.green('●') : ' ',
      o.name,
      o.slug,
      o.role,
      shortId(o.id),
    ]);
  }
  return table.toString();
}

export function renderProjectsTable(projects, activeId) {
  if (projects.length === 0) return chalk.dim('No projects yet. Create one with `forge project create <name>`.');
  const table = baseTable(['', 'Name', 'Description', 'ID']);
  for (const p of projects) {
    table.push([
      p.id === activeId ? chalk.green('●') : ' ',
      p.name,
      p.description ?? dash,
      shortId(p.id),
    ]);
  }
  return table.toString();
}

export function renderTaskDetail(t) {
  const label = (s) => chalk.dim(s.padEnd(10));
  const lines = [
    `${chalk.bold(t.title)}  ${chalk.dim(`#${shortId(t.id)}`)}`,
    '',
    `${label('Status')} ${colorStatus(t.status)}`,
    `${label('Priority')} ${colorPriority(t.priority)}`,
    `${label('Assignee')} ${t.assignee ? t.assignee.email : dash}`,
    `${label('Reporter')} ${t.reporter ? t.reporter.email : dash}`,
    `${label('Due')} ${fmtDate(t.dueDate)}`,
    `${label('Created')} ${new Date(t.createdAt).toLocaleString()}`,
    `${label('Updated')} ${new Date(t.updatedAt).toLocaleString()}`,
    `${label('Labels')} ${formatLabels(t.labels)}`,
    `${label('Full ID')} ${chalk.dim(t.id)}`,
  ];
  if (t.description) {
    lines.push('', chalk.dim('Description'), t.description);
  }
  return lines.join('\n');
}

/** Render a color hex as a small swatch, tolerating bad values. */
function swatch(color) {
  try {
    return chalk.hex(color)('███');
  } catch {
    return '███';
  }
}

/** Comma-separated, color-tinted label names (or a dash). */
function formatLabels(labels) {
  if (!labels || labels.length === 0) return dash;
  return labels
    .map((l) => {
      try {
        return chalk.hex(l.color)(l.name);
      } catch {
        return l.name;
      }
    })
    .join(', ');
}

export function renderMembersTable(members) {
  if (members.length === 0) return chalk.dim('No members.');
  const table = baseTable(['Name', 'Email', 'Role', 'Joined']);
  for (const m of members) {
    table.push([m.name, m.email, m.role, fmtDate(m.joinedAt)]);
  }
  return table.toString();
}

export function renderCommentsTable(comments) {
  if (comments.length === 0) return chalk.dim('No comments yet.');
  const table = baseTable(['ID', 'Author', 'Comment', 'Created']);
  for (const c of comments) {
    const body = c.body.length > 50 ? `${c.body.slice(0, 49)}…` : c.body;
    table.push([
      shortId(c.id),
      c.author?.name ?? c.author?.email ?? dash,
      body,
      fmtDate(c.createdAt),
    ]);
  }
  return table.toString();
}

export function renderLabelsTable(labels) {
  if (labels.length === 0) {
    return chalk.dim('No labels yet. Create one with `forge label create <name> <color>`.');
  }
  const table = baseTable(['', 'Name', 'Color', 'ID']);
  for (const l of labels) {
    table.push([swatch(l.color), l.name, l.color, shortId(l.id)]);
  }
  return table.toString();
}

/** Footer line for paginated list output. */
export function paginationFooter(meta) {
  if (!meta) return '';
  const { page, limit, total, totalPages } = meta;
  if (total === 0) return chalk.dim('No results.');
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  let footer = `Showing ${start}–${end} of ${total} results`;
  if (page < totalPages) footer += `  (--page=${page + 1} for next)`;
  return chalk.dim(footer);
}
