import { requestAsana } from '../client.ts';
import { configPath, readConfig, updateConfig, writeConfig } from '../config.ts';
import { isDefined } from '../isDefined.ts';
import { type Command, jsonOption, readFlag, readString } from '../command.ts';
import { printJson } from '../output.ts';
import type { User } from '../types.ts';

export const authCommand: Command = {
  summary: 'Inspect or set stored credentials and the default workspace',
  usage: `asana auth [--show] [--workspace <gid>] [--client-id <id>] [--client-secret <secret>]
             [--token <pat>] [--cookie <cookie-header>] [--clear]

Use "asana login" for the normal OAuth flow. This command is for inspecting state
and for the fallbacks: a personal access token, or a browser session cookie copied
from a logged-in app.asana.com request.`,
  options: {
    ...jsonOption,
    show: { type: 'boolean' },
    workspace: { type: 'string' },
    'client-id': { type: 'string' },
    'client-secret': { type: 'string' },
    token: { type: 'string' },
    cookie: { type: 'string' },
    clear: { type: 'boolean' },
  },
  run: async ({ values }) => {
    if (readFlag(values, 'clear')) {
      writeConfig({});
      process.stdout.write(`Cleared ${configPath}\n`);
      return;
    }

    const changes: Record<string, string> = {};
    for (const [flag, key] of [
      ['workspace', 'workspace'],
      ['client-id', 'clientId'],
      ['client-secret', 'clientSecret'],
      ['token', 'token'],
      ['cookie', 'cookie'],
    ] as const) {
      const value = readString(values, flag);
      if (isDefined(value)) changes[key] = value;
    }

    if (Object.keys(changes).length > 0) updateConfig(changes);

    const config = readConfig();
    const summary = {
      configPath,
      method: isDefined(config.refreshToken)
        ? 'oauth'
        : isDefined(config.token)
          ? 'personal access token'
          : isDefined(config.cookie)
            ? 'cookie'
            : 'none',
      clientId: config.clientId ?? null,
      workspace: config.workspace ?? null,
      accessTokenExpiresAt: isDefined(config.expiresAt) ? new Date(config.expiresAt).toISOString() : null,
    };

    if (readFlag(values, 'json')) {
      printJson(summary);
      return;
    }

    for (const [label, value] of Object.entries(summary)) {
      process.stdout.write(`${label.padEnd(21)} ${value ?? '—'}\n`);
    }

    if (readFlag(values, 'show') && summary.method !== 'none') {
      const me = await requestAsana<User>('/users/me', { query: { opt_fields: 'name,email' } });
      process.stdout.write(`\nAuthenticated as ${me.name ?? ''} <${me.email ?? ''}>\n`);
    }
  },
};
