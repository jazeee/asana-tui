import { requestAsana } from '../client.ts';
import { type Command, jsonOption, readFlag, readString, readStrings } from '../command.ts';
import { resolveDueDate } from '../dueDate.ts';
import { isDefined } from '../isDefined.ts';
import { printJson, printTaskDetail } from '../output.ts';
import { type Task, taskDetailFields } from '../types.ts';
import { requireWorkspaceGid } from '../workspace.ts';

export const createCommand: Command = {
  summary: 'Create a task',
  usage: `asana create <name> [--notes <text>] [--due <date>] [--assignee me|<gid>|<email>]
               [--project <gid>]... [--parent <gid>] [--workspace <gid>] [--json]`,
  options: {
    ...jsonOption,
    notes: { type: 'string' },
    due: { type: 'string' },
    assignee: { type: 'string' },
    project: { type: 'string', multiple: true },
    parent: { type: 'string' },
    workspace: { type: 'string' },
  },
  run: async ({ values, positionals }) => {
    const name = positionals.join(' ').trim();
    if (name === '') throw new Error('Missing <name>. Usage: asana create "Task name" [flags]');

    const projects = readStrings(values, 'project');
    const parent = readString(values, 'parent');
    const due = readString(values, 'due');
    const assignee = readString(values, 'assignee');
    const notes = readString(values, 'notes');

    const body: Record<string, unknown> = { name };
    if (isDefined(notes)) body.notes = notes;
    if (isDefined(due)) body.due_on = resolveDueDate(due);
    if (isDefined(assignee)) body.assignee = assignee;
    if (projects.length > 0) body.projects = projects;
    if (isDefined(parent)) body.parent = parent;
    // A task needs a home: a parent or project supplies one, otherwise the workspace does.
    if (!isDefined(parent) && projects.length === 0) {
      body.workspace = await requireWorkspaceGid(readString(values, 'workspace'));
    }

    const created = await requestAsana<Task>('/tasks', {
      method: 'POST',
      body,
      query: { opt_fields: taskDetailFields },
    });

    if (readFlag(values, 'json')) {
      printJson(created);
      return;
    }
    process.stdout.write('Created.\n\n');
    printTaskDetail(created);
  },
};
