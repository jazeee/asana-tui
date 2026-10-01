import { requestAsana } from '../client.ts';
import { type Command, jsonOption, readFlag } from '../command.ts';
import { isDefined } from '../isDefined.ts';
import { formatTaskUrl, printJson } from '../output.ts';
import { resolveGid } from '../resourceGid.ts';
import type { Task } from '../types.ts';

export const deleteCommand: Command = {
  summary: 'Delete a task (moves it to your Deleted Items for 30 days)',
  usage: 'asana delete <task-url|gid> [--yes] [--json]',
  options: { ...jsonOption, yes: { type: 'boolean' } },
  run: async ({ values, positionals }) => {
    const first = positionals[0];
    if (!isDefined(first)) throw new Error('Missing <task-url|gid>. Usage: asana delete <task-url|gid> --yes');
    const gid = resolveGid(first, 'task');

    const task = await requestAsana<Task>(`/tasks/${gid}`, { query: { opt_fields: 'name,permalink_url' } });
    if (!readFlag(values, 'yes')) {
      throw new Error(`Refusing to delete "${task.name ?? gid}" without --yes.`);
    }

    await requestAsana(`/tasks/${gid}`, { method: 'DELETE' });

    if (readFlag(values, 'json')) {
      printJson({ deleted: true, gid, name: task.name, permalink_url: task.permalink_url });
      return;
    }
    process.stdout.write(`Deleted "${task.name ?? ''}"\n  ${formatTaskUrl(task)}\n`);
  },
};
