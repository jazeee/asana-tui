import { requestAsana } from '../client.ts';
import { configPath, readConfig, writeConfig } from '../config.ts';
import { isDefined } from '../isDefined.ts';
import { type Command, jsonOption, readFlag, readString } from '../command.ts';
import { printJson } from '../output.ts';
import type { User } from '../types.ts';

export const authCommand: Command = {
  summary: 'Store credentials and the default workspace',
  usage: `asana auth [--token <pat>] [--cookie <cookie-header>] [--workspace <gid>] [--show] [--clear]

Create a personal access token at https://app.asana.com/0/my-apps.
Cookie auth is a fallback: copy the whole "Cookie:" request header from a logged-in
app.asana.com request. It expires and is less reliable than a token.`,
  options: { ...jsonOption, token: { type: 'string' }, cookie: { type: 'string' }, workspace: { type: 'string' }, show: { type: 'boolean' }, clear: { type: 'boolean' } },
  run: async ({ values }) => {
    if (readFlag(values, 'clear')) {
      writeConfig({});
      process.stdout.write(`Cleared ${configPath}\n`);
      return;
    }

    const config = readConfig();
    const token = readString(values, 'token');
    const cookie = readString(values, 'cookie');
    const workspace = readString(values, 'workspace');

    if (isDefined(token)) {
      config.token = token;
      delete config.cookie;
    }
    if (isDefined(cookie)) {
      config.cookie = cookie;
      delete config.token;
    }
    if (isDefined(workspace)) config.workspace = workspace;

    const changed = isDefined(token) || isDefined(cookie) || isDefined(workspace);
    if (changed) writeConfig(config);

    if (readFlag(values, 'show') || !changed) {
      const summary = {
        configPath,
        auth: isDefined(config.token) ? 'token' : isDefined(config.cookie) ? 'cookie' : 'none',
        workspace: config.workspace ?? null,
      };
      if (readFlag(values, 'json')) {
        printJson(summary);
        return;
      }
      process.stdout.write(`config    ${summary.configPath}\nauth      ${summary.auth}\nworkspace ${summary.workspace ?? '—'}\n`);
      return;
    }

    const me = await requestAsana<User>('/users/me', { query: { opt_fields: 'name,email' } });
    process.stdout.write(`Saved ${configPath}. Authenticated as ${me.name ?? ''} <${me.email ?? ''}>\n`);
  },
};
