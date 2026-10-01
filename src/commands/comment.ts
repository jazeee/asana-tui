import { requestAsana } from '../client.ts';
import { type Command, jsonOption, readFlag } from '../command.ts';
import { isDefined } from '../isDefined.ts';
import { formatTaskUrl, printJson } from '../output.ts';
import { resolveGid } from '../resourceGid.ts';
import type { Story, Task } from '../types.ts';

export const commentCommand: Command = {
  summary: 'Add a comment to a task',
  usage: 'asana comment <task-url|gid> <text...> [--json]',
  options: { ...jsonOption },
  run: async ({ values, positionals }) => {
    const [first, ...rest] = positionals;
    const text = rest.join(' ').trim();
    if (!isDefined(first) || text === '') {
      throw new Error('Usage: asana comment <task-url|gid> "your comment"');
    }
    const gid = resolveGid(first, 'task');

    const story = await requestAsana<Story>(`/tasks/${gid}/stories`, {
      method: 'POST',
      body: { text },
      query: { opt_fields: 'text,created_at,created_by.name' },
    });

    if (readFlag(values, 'json')) {
      printJson(story);
      return;
    }
    const task = await requestAsana<Task>(`/tasks/${gid}`, { query: { opt_fields: 'name,permalink_url' } });
    process.stdout.write(`Commented on "${task.name ?? ''}"\n  ${formatTaskUrl(task)}\n`);
  },
};
