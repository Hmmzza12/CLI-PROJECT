import { api } from './api.js';
import { requireActiveProject } from './config.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function friendly(message) {
  const err = new Error(message);
  err.isFriendly = true;
  return err;
}

/**
 * Turn a full task id or a short prefix into a full id, matching against the
 * active project's tasks. (The task list is paginated, so we pull a wide page.)
 */
export async function resolveTaskRef(idOrPrefix) {
  if (UUID_RE.test(idOrPrefix)) return idOrPrefix;
  const project = requireActiveProject();
  const res = await api.get(`/projects/${project.id}/tasks`, { limit: 100 });
  const tasks = res.data ?? res;
  const matches = tasks.filter((t) => t.id.startsWith(idOrPrefix));
  if (matches.length === 0) {
    throw friendly(`No task matching "${idOrPrefix}" in ${project.name}.`);
  }
  if (matches.length > 1) {
    throw friendly(`"${idOrPrefix}" matches ${matches.length} tasks — use more characters.`);
  }
  return matches[0].id;
}

/** Resolve a label by (case-insensitive) name within the active project. */
export async function resolveLabelByName(name) {
  const project = requireActiveProject();
  const labels = await api.get(`/projects/${project.id}/labels`);
  const found = labels.find((l) => l.name.toLowerCase() === String(name).toLowerCase());
  if (!found) {
    throw friendly(`No label named "${name}" in ${project.name}. Create it with \`forge label create\`.`);
  }
  return found;
}
