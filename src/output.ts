import { isDefined } from './isDefined.ts';
import type { Project, Story, Task } from './types.ts';

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function formatDue(task: Task): string {
  const due = task.due_on ?? task.due_at?.slice(0, 10);
  return isDefined(due) ? due : '—'.padEnd(10);
}

export function formatTaskUrl(task: { gid: string; permalink_url?: string }): string {
  return task.permalink_url ?? `https://app.asana.com/0/0/${task.gid}`;
}

export function formatTaskLine(task: Task): string {
  const projects = (task.projects ?? []).map((project) => project.name).filter(isDefined);
  const suffix = projects.length > 0 ? `  [${projects.join(', ')}]` : '';
  return `${task.completed === true ? '✔' : '○'} ${formatDue(task)}  ${task.name ?? ''}${suffix}\n  ${formatTaskUrl(task)}`;
}

export function printTaskList(tasks: Task[]): void {
  if (tasks.length === 0) {
    process.stdout.write('No tasks.\n');
    return;
  }
  for (const task of tasks) process.stdout.write(`${formatTaskLine(task)}\n`);
  process.stdout.write(`\n${tasks.length} task(s)\n`);
}

export function printTaskDetail(task: Task, stories?: Story[], subtasks?: Task[]): void {
  const rows: [string, string | undefined][] = [
    ['Task', task.name ?? ''],
    ['URL', formatTaskUrl(task)],
    ['Status', task.completed === true ? `completed ${task.completed_at ?? ''}`.trim() : 'open'],
    ['Assignee', task.assignee?.name],
    ['Due', task.due_at ?? task.due_on ?? undefined],
    ['Start', task.start_on ?? undefined],
    ['Parent', isDefined(task.parent) ? `${task.parent.name} — ${formatTaskUrl(task.parent)}` : undefined],
    [
      'Projects',
      (task.memberships ?? [])
        .map((membership) =>
          [membership.project?.name, membership.section?.name].filter(isDefined).join(' / '),
        )
        .filter((label) => label !== '')
        .join(', ') || undefined,
    ],
    ['Tags', (task.tags ?? []).map((tag) => tag.name).join(', ') || undefined],
    ['Subtasks', isDefined(task.num_subtasks) ? String(task.num_subtasks) : undefined],
    ['Modified', task.modified_at],
  ];

  for (const [label, value] of rows) {
    if (isDefined(value) && value !== '') process.stdout.write(`${label.padEnd(10)} ${value}\n`);
  }

  for (const field of task.custom_fields ?? []) {
    if (isDefined(field.display_value) && field.display_value !== '') {
      process.stdout.write(`${(field.name ?? 'field').slice(0, 10).padEnd(10)} ${field.display_value}\n`);
    }
  }

  if (isDefined(task.notes) && task.notes !== '') {
    process.stdout.write(`\n--- notes ---\n${task.notes}\n`);
  }

  if (isDefined(subtasks) && subtasks.length > 0) {
    process.stdout.write('\n--- subtasks ---\n');
    for (const subtask of subtasks) process.stdout.write(`${formatTaskLine(subtask)}\n`);
  }

  if (isDefined(stories) && stories.length > 0) {
    process.stdout.write('\n--- comments ---\n');
    for (const story of stories) {
      process.stdout.write(
        `[${story.created_at?.slice(0, 16) ?? ''}] ${story.created_by?.name ?? 'unknown'}: ${story.text ?? ''}\n`,
      );
    }
  }
}

export function printProjectList(projects: Project[]): void {
  if (projects.length === 0) {
    process.stdout.write('No projects.\n');
    return;
  }
  for (const project of projects) {
    process.stdout.write(
      `${project.name ?? ''}${project.archived === true ? ' (archived)' : ''}\n  ${project.permalink_url ?? project.gid}\n`,
    );
  }
}
