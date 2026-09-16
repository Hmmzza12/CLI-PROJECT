import chalk from 'chalk';
import { ApiError } from './api.js';
import { errorLine, print } from './output.js';

/**
 * Wrap a Commander action so any thrown error becomes a friendly one-liner
 * (never a raw stack trace) and sets a non-zero exit code.
 */
export function action(handler) {
  return async (...args) => {
    try {
      await handler(...args);
    } catch (err) {
      if (err instanceof ApiError || err?.isFriendly) {
        errorLine(err.message);
        if (Array.isArray(err.details)) {
          for (const d of err.details) print(chalk.dim(`    ${d.path}: ${d.message}`));
        }
      } else {
        errorLine(err?.message ?? 'Unexpected error');
      }
      process.exitCode = 1;
    }
  };
}

/** True when the user passed --json anywhere (global or on the leaf command). */
export function isJson(command) {
  try {
    if (command.optsWithGlobals().json) return true;
  } catch {
    /* fall through to argv check */
  }
  return process.argv.includes('--json');
}
