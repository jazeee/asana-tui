import { requestAsana } from '../client.ts';
import { type Command, jsonOption, readFlag } from '../command.ts';
import { isDefined } from '../isDefined.ts';
import { printJson } from '../output.ts';
import type { Story } from '../types.ts';

export const commentCommand: Command = {
  summary: 'Add a comment to a task',
  usage: 'asana comment <task-gid> <text...> [--json]',
  options: { ...jsonOption },
  run: async ({ values, positionals }) => {
    const [gid, ...rest] = positionals;
    const text = rest.join(' ').trim();
    if (!isDefined(gid) || text === '') {
      throw new Error('Usage: asana comment <task-gid> "your comment"');
    }

    const story = await requestAsana<Story>(`/tasks/${gid}/stories`, {
      method: 'POST',
      body: { text },
      query: { opt_fields: 'text,created_at,created_by.name' },
    });

    if (readFlag(values, 'json')) {
      printJson(story);
      return;
    }
    process.stdout.write(`Commented on ${gid} (story ${story.gid}).\n`);
  },
};
