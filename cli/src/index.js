#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { registerAuth } from './commands/auth.js';
import { registerOrg } from './commands/org.js';
import { registerProject } from './commands/project.js';
import { registerTask } from './commands/task.js';
import { registerComment } from './commands/comment.js';
import { registerLabel } from './commands/label.js';

// Read the version from package.json rather than hardcoding it, so `--version`
// can't drift out of sync with a real release.
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const program = new Command();

program
  .name('forge')
  .description('Forge — team project management from your terminal')
  .version(version)
  .option('--json', 'output machine-readable JSON')
  .showHelpAfterError('(add --help for usage)');

registerAuth(program);
registerOrg(program);
registerProject(program);
registerTask(program);
registerComment(program);
registerLabel(program);

// Accept --json on leaf commands too (e.g. `forge task list --json`), not just
// as a global before the subcommand (`forge --json task list`).
function addJsonToLeaves(cmd) {
  if (cmd.commands.length === 0) {
    cmd.option('--json', 'output machine-readable JSON');
  } else {
    for (const sub of cmd.commands) addJsonToLeaves(sub);
  }
}
addJsonToLeaves(program);

program.parseAsync(process.argv).catch((err) => {
  console.error(err?.message ?? err);
  process.exitCode = 1;
});
