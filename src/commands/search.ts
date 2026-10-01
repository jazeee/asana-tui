import { requestAsana } from '../client.ts';
import { type Command, jsonOption, readFlag, readString } from '../command.ts';
import { printJson, printTaskList } from '../output.ts';
import { type Task, taskListFields } from '../types.ts';
import { requireWorkspaceGid } from '../workspace.ts';

export const searchCommand: Command = {
  summary: 'Find tasks, projects, or users by name',
  usage: 'asana search <query...> [--type task|project|user|tag] [--workspace <gid>] [--limit <n>] [--json]',
  options: { ...jsonOption, type: { type: 'string' }, workspace: { type: 'string' }, limit: { type: 'string' } },
  run: async ({ values, positionals }) => {
    const query = positionals.join(' ').trim();
    if (query === '') throw new Error('Usage: asana search <query>');

    const resourceType = readString(values, 'type') ?? 'task';
    const workspace = await requireWorkspaceGid(readString(values, 'workspace'));
    const results = await requestAsana<Task[]>(`/workspaces/${workspace}/typeahead`, {
      query: {
        resource_type: resourceType,
        query,
        count: Number(readString(values, 'limit') ?? '20'),
        opt_fields: resourceType === 'task' ? taskListFields : 'name',
      },
    });

    if (readFlag(values, 'json')) {
      printJson(results);
      return;
    }
    if (resourceType === 'task') {
      printTaskList(results);
      return;
    }
    for (const result of results) process.stdout.write(`${result.gid.padEnd(16)} ${result.name ?? ''}\n`);
  },
};
