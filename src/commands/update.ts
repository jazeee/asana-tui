import { requestAsana } from '../client.ts';
import { type Command, jsonOption, readFlag, readString, readStrings } from '../command.ts';
import { resolveDueDate } from '../dueDate.ts';
import { isDefined } from '../isDefined.ts';
import { printJson, printTaskDetail } from '../output.ts';
import { resolveGid } from '../resourceGid.ts';
import { type Task, taskDetailFields } from '../types.ts';

export const updateCommand: Command = {
  summary: 'Update a task: rename, reschedule, reassign, complete, move',
  usage: `asana update <task-url|gid> [--name <text>] [--notes <text>] [--append-notes <text>]
               [--due <date|none>] [--start <date|none>] [--assignee me|<gid>|<email>|none]
               [--complete] [--incomplete] [--parent <gid|none>]
               [--add-project <gid>]... [--section <gid>] [--remove-project <gid>]...
               [--add-tag <gid>]... [--add-follower <gid>]... [--json]`,
  options: {
    ...jsonOption,
    name: { type: 'string' },
    notes: { type: 'string' },
    'append-notes': { type: 'string' },
    due: { type: 'string' },
    start: { type: 'string' },
    assignee: { type: 'string' },
    complete: { type: 'boolean' },
    incomplete: { type: 'boolean' },
    parent: { type: 'string' },
    'add-project': { type: 'string', multiple: true },
    'remove-project': { type: 'string', multiple: true },
    section: { type: 'string' },
    'add-tag': { type: 'string', multiple: true },
    'add-follower': { type: 'string', multiple: true },
  },
  run: async ({ values, positionals }) => {
    const first = positionals[0];
    if (!isDefined(first)) throw new Error('Missing <task-url|gid>. Usage: asana update <task-url|gid> [flags]');
    const gid = resolveGid(first, 'task');

    const patch: Record<string, unknown> = {};
    const name = readString(values, 'name');
    if (isDefined(name)) patch.name = name;

    const notes = readString(values, 'notes');
    if (isDefined(notes)) patch.notes = notes;

    const appended = readString(values, 'append-notes');
    if (isDefined(appended)) {
      const current = await requestAsana<Task>(`/tasks/${gid}`, { query: { opt_fields: 'notes' } });
      patch.notes = `${current.notes ?? ''}${current.notes === '' ? '' : '\n'}${appended}`;
    }

    const due = readString(values, 'due');
    if (isDefined(due)) {
      const resolved = resolveDueDate(due);
      // Asana rejects due_on and due_at together, so clear the timestamp variant.
      patch.due_on = resolved;
      patch.due_at = null;
    }

    const start = readString(values, 'start');
    if (isDefined(start)) patch.start_on = resolveDueDate(start);

    const assignee = readString(values, 'assignee');
    if (isDefined(assignee)) patch.assignee = assignee === 'none' ? null : assignee;

    const parent = readString(values, 'parent');
    if (isDefined(parent)) patch.parent = parent === 'none' ? null : resolveGid(parent, 'task');

    if (readFlag(values, 'complete') && readFlag(values, 'incomplete')) {
      throw new Error('Pass either --complete or --incomplete, not both.');
    }
    if (readFlag(values, 'complete')) patch.completed = true;
    if (readFlag(values, 'incomplete')) patch.completed = false;

    const addProjects = readStrings(values, 'add-project').map((value) => resolveGid(value, 'project'));
    const removeProjects = readStrings(values, 'remove-project').map((value) => resolveGid(value, 'project'));
    const addTags = readStrings(values, 'add-tag');
    const addFollowers = readStrings(values, 'add-follower');
    const section = readString(values, 'section');

    const hasWork =
      Object.keys(patch).length > 0 ||
      addProjects.length + removeProjects.length + addTags.length + addFollowers.length > 0;
    if (!hasWork) throw new Error('Nothing to update. Pass at least one flag; see "asana help update".');

    if (Object.keys(patch).length > 0) {
      await requestAsana<Task>(`/tasks/${gid}`, { method: 'PUT', body: patch });
    }
    for (const project of addProjects) {
      await requestAsana(`/tasks/${gid}/addProject`, {
        method: 'POST',
        body: { project, section: isDefined(section) ? section : undefined },
      });
    }
    for (const project of removeProjects) {
      await requestAsana(`/tasks/${gid}/removeProject`, { method: 'POST', body: { project } });
    }
    for (const tag of addTags) {
      await requestAsana(`/tasks/${gid}/addTag`, { method: 'POST', body: { tag } });
    }
    if (addFollowers.length > 0) {
      await requestAsana(`/tasks/${gid}/addFollowers`, { method: 'POST', body: { followers: addFollowers } });
    }

    const task = await requestAsana<Task>(`/tasks/${gid}`, { query: { opt_fields: taskDetailFields } });
    if (readFlag(values, 'json')) {
      printJson(task);
      return;
    }
    process.stdout.write('Updated.\n\n');
    printTaskDetail(task);
  },
};
