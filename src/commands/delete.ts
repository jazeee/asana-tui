import { requestAsana } from '../client.ts';
import { type Command, jsonOption, readFlag } from '../command.ts';
import { isDefined } from '../isDefined.ts';
import { printJson } from '../output.ts';
import type { Task } from '../types.ts';

export const deleteCommand: Command = {
  summary: 'Delete a task (moves it to your Deleted Items for 30 days)',
  usage: 'asana delete <task-gid> [--yes] [--json]',
  options: { ...jsonOption, yes: { type: 'boolean' } },
  run: async ({ values, positionals }) => {
    const gid = positionals[0];
    if (!isDefined(gid)) throw new Error('Missing <task-gid>. Usage: asana delete <task-gid> --yes');

    const task = await requestAsana<Task>(`/tasks/${gid}`, { query: { opt_fields: 'name' } });
    if (!readFlag(values, 'yes')) {
      throw new Error(`Refusing to delete "${task.name ?? gid}" without --yes.`);
    }

    await requestAsana(`/tasks/${gid}`, { method: 'DELETE' });

    if (readFlag(values, 'json')) {
      printJson({ deleted: true, gid, name: task.name });
      return;
    }
    process.stdout.write(`Deleted ${gid} "${task.name ?? ''}".\n`);
  },
};
