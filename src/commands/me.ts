import { requestAsana } from '../client.ts';
import { type Command, jsonOption, readFlag } from '../command.ts';
import { printJson } from '../output.ts';
import type { User } from '../types.ts';

export const meCommand: Command = {
  summary: 'Show the authenticated user and their workspaces',
  usage: 'asana me [--json]',
  options: { ...jsonOption },
  run: async ({ values }) => {
    const me = await requestAsana<User>('/users/me', {
      query: { opt_fields: 'name,email,workspaces.name' },
    });

    if (readFlag(values, 'json')) {
      printJson(me);
      return;
    }

    process.stdout.write(`${me.name ?? ''} <${me.email ?? ''}>  gid=${me.gid}\n\nworkspaces:\n`);
    for (const workspace of me.workspaces ?? []) {
      process.stdout.write(`  ${workspace.gid.padEnd(16)} ${workspace.name ?? ''}\n`);
    }
  },
};
