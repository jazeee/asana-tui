import { requestAsana, requestAsanaList } from '../client.ts';
import { type Command, jsonOption, readFlag } from '../command.ts';
import { isDefined } from '../isDefined.ts';
import { printJson, printTaskDetail } from '../output.ts';
import { type Story, type Task, taskDetailFields, taskListFields } from '../types.ts';

export const taskCommand: Command = {
  summary: 'Show one task in full',
  usage: 'asana task <task-gid> [--comments] [--subtasks] [--json]',
  options: { ...jsonOption, comments: { type: 'boolean' }, subtasks: { type: 'boolean' } },
  run: async ({ values, positionals }) => {
    const gid = positionals[0];
    if (!isDefined(gid)) throw new Error('Missing <task-gid>. Usage: asana task <task-gid>');

    const task = await requestAsana<Task>(`/tasks/${gid}`, { query: { opt_fields: taskDetailFields } });

    const stories = readFlag(values, 'comments')
      ? (
          await requestAsanaList<Story>(`/tasks/${gid}/stories`, {
            query: { opt_fields: 'text,type,created_at,created_by.name' },
          })
        ).filter((story) => story.type === 'comment')
      : undefined;

    const subtasks = readFlag(values, 'subtasks')
      ? await requestAsanaList<Task>(`/tasks/${gid}/subtasks`, { query: { opt_fields: taskListFields } })
      : undefined;

    if (readFlag(values, 'json')) {
      printJson({ task, stories, subtasks });
      return;
    }
    printTaskDetail(task, stories, subtasks);
  },
};
