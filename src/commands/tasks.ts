import { requestAsanaList } from '../client.ts';
import { type Command, jsonOption, readFlag, readString } from '../command.ts';
import { resolveDueDate } from '../dueDate.ts';
import { isDefined } from '../isDefined.ts';
import { printJson, printTaskList } from '../output.ts';
import { type Task, taskListFields } from '../types.ts';
import { requireWorkspaceGid } from '../workspace.ts';

export const tasksCommand: Command = {
  summary: 'List tasks assigned to you (or anyone) with optional filters',
  usage: `asana tasks [--assignee me|<gid>|<email>] [--project <gid>] [--workspace <gid>]
             [--all] [--completed] [--overdue] [--due-before <date>] [--due-after <date>]
             [--contains <text>] [--limit <n>] [--json]

Dates accept YYYY-MM-DD, today, tomorrow, or +3d. Defaults to your incomplete tasks.`,
  options: {
    ...jsonOption,
    assignee: { type: 'string' },
    project: { type: 'string' },
    workspace: { type: 'string' },
    all: { type: 'boolean' },
    completed: { type: 'boolean' },
    overdue: { type: 'boolean' },
    'due-before': { type: 'string' },
    'due-after': { type: 'string' },
    contains: { type: 'string' },
    limit: { type: 'string' },
  },
  run: async ({ values }) => {
    const includeCompleted = readFlag(values, 'all') || readFlag(values, 'completed');
    const limit = Number(readString(values, 'limit') ?? '50');
    const project = readString(values, 'project');

    const fetched = isDefined(project)
      ? await requestAsanaList<Task>(`/projects/${project}/tasks`, {
          limit,
          query: { opt_fields: taskListFields, completed_since: includeCompleted ? undefined : 'now' },
        })
      : await requestAsanaList<Task>('/tasks', {
          limit,
          query: {
            assignee: readString(values, 'assignee') ?? 'me',
            workspace: await requireWorkspaceGid(readString(values, 'workspace')),
            completed_since: includeCompleted ? undefined : 'now',
            opt_fields: taskListFields,
          },
        });

    const dueBefore = (() => {
      if (readFlag(values, 'overdue')) return resolveDueDate('today');
      const raw = readString(values, 'due-before');
      return isDefined(raw) ? resolveDueDate(raw) : undefined;
    })();
    const dueAfterRaw = readString(values, 'due-after');
    const dueAfter = isDefined(dueAfterRaw) ? resolveDueDate(dueAfterRaw) : undefined;
    const contains = readString(values, 'contains')?.toLowerCase();

    const tasks = fetched
      .filter((task) => (readFlag(values, 'completed') ? task.completed === true : true))
      .filter((task) => {
        const due = task.due_on ?? task.due_at?.slice(0, 10);
        if (isDefined(dueBefore) && (!isDefined(due) || due >= dueBefore)) return false;
        if (isDefined(dueAfter) && (!isDefined(due) || due <= dueAfter)) return false;
        return true;
      })
      .filter((task) => !isDefined(contains) || (task.name ?? '').toLowerCase().includes(contains))
      .sort((left, right) => {
        if (left.completed !== right.completed) return left.completed === true ? 1 : -1;
        return (left.due_on ?? left.due_at ?? '9999').localeCompare(right.due_on ?? right.due_at ?? '9999');
      });

    if (readFlag(values, 'json')) {
      printJson(tasks);
      return;
    }
    printTaskList(tasks);
  },
};
