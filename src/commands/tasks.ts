import { requestAsana, requestAsanaList } from '../client.ts';
import { type Command, jsonOption, readFlag, readString } from '../command.ts';
import { resolveDueDate } from '../dueDate.ts';
import { isDefined } from '../isDefined.ts';
import { printJson, printTaskList } from '../output.ts';
import { resolveGid } from '../resourceGid.ts';
import { type Task, taskListFields, type User } from '../types.ts';
import { requireWorkspaceGid } from '../workspace.ts';

export const tasksCommand: Command = {
  summary: 'List tasks assigned to you (or anyone) with optional filters',
  usage: `asana tasks [--assignee me|<gid>|<email>] [--project <url|gid>] [--workspace <gid>]
             [--all] [--completed] [--overdue] [--due-before <date>] [--due-after <date>]
             [--contains <text>] [--limit <n>] [--json]

Dates accept YYYY-MM-DD, today, tomorrow, or +3d. Defaults to your incomplete tasks.
With --project, lists everyone's tasks unless --assignee is also given.`,
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
    const projectFlag = readString(values, 'project');
    const project = isDefined(projectFlag) ? resolveGid(projectFlag, 'project') : undefined;
    const assignee = readString(values, 'assignee');

    const fetched = isDefined(project)
      ? await (async () => {
          // Asana's API rejects project and assignee together, so filter the project's tasks client-side.
          const assigneeGid = isDefined(assignee)
            ? (await requestAsana<User>(`/users/${encodeURIComponent(assignee)}`, { query: { opt_fields: 'gid' } })).gid
            : undefined;
          const projectTasks = await requestAsanaList<Task>(`/projects/${project}/tasks`, {
            limit: isDefined(assigneeGid) ? Number.POSITIVE_INFINITY : limit,
            query: { opt_fields: taskListFields, completed_since: includeCompleted ? undefined : 'now' },
          });
          return isDefined(assigneeGid)
            ? projectTasks.filter((task) => task.assignee?.gid === assigneeGid)
            : projectTasks;
        })()
      : await requestAsanaList<Task>('/tasks', {
          limit,
          query: {
            assignee: assignee ?? 'me',
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
      })
      .slice(0, limit);

    if (readFlag(values, 'json')) {
      printJson(tasks);
      return;
    }
    printTaskList(tasks);
  },
};
