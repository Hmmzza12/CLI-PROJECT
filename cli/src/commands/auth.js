import { input, password as passwordPrompt } from '@inquirer/prompts';
import chalk from 'chalk';
import { post, api } from '../lib/api.js';
import { setSession, clearSession, loadConfig, requireAuth } from '../lib/config.js';
import { action, isJson } from '../lib/command.js';
import { withSpinner, success, info, json, print } from '../lib/output.js';

export function registerAuth(program) {
  const auth = program.command('auth').description('Authentication');

  auth
    .command('login')
    .description('Log in and store your session token')
    .option('-e, --email <email>', 'email address')
    .option('-p, --password <password>', 'password (prompted if omitted)')
    .action(
      action(async (opts, command) => {
        const jsonMode = isJson(command);
        const email = opts.email ?? (await input({ message: 'Email:' }));
        const pwd =
          opts.password ?? (await passwordPrompt({ message: 'Password:', mask: true }));

        const result = await withSpinner(
          'Logging in…',
          () => post('/auth/login', { email, password: pwd }),
          { json: jsonMode },
        );
        setSession(result);

        if (jsonMode) return json({ user: result.user, loggedIn: true });
        success(`Logged in as ${chalk.bold(result.user.email)}`);
      }),
    );

  auth
    .command('logout')
    .description('Log out and clear your stored session')
    .action(
      action(async (opts, command) => {
        const jsonMode = isJson(command);
        const { refreshToken } = loadConfig();
        if (refreshToken) {
          // Best effort — revoke server-side, but always clear locally.
          try {
            await post('/auth/logout', { refreshToken });
          } catch {
            /* ignore */
          }
        }
        clearSession();
        if (jsonMode) return json({ loggedOut: true });
        success('Logged out.');
      }),
    );

  auth
    .command('whoami')
    .description('Show the currently authenticated user')
    .action(
      action(async (opts, command) => {
        requireAuth();
        const jsonMode = isJson(command);
        const me = await withSpinner('Fetching identity…', () => api.get('/auth/me'), {
          json: jsonMode,
        });
        if (jsonMode) return json(me);
        print(`${chalk.bold(me.name)} <${me.email}>`);
        info(chalk.dim(`user id: ${me.id}`));
      }),
    );
}
