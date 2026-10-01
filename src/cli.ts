#!/usr/bin/env node
import { parseArgs } from 'node:util';
import type { Command } from './command.ts';
import { authCommand } from './commands/auth.ts';
import { commentCommand } from './commands/comment.ts';
import { createCommand } from './commands/create.ts';
import { deleteCommand } from './commands/delete.ts';
import { loginCommand } from './commands/login.ts';
import { logoutCommand } from './commands/logout.ts';
import { meCommand } from './commands/me.ts';
import { projectsCommand } from './commands/projects.ts';
import { searchCommand } from './commands/search.ts';
import { taskCommand } from './commands/task.ts';
import { tasksCommand } from './commands/tasks.ts';
import { updateCommand } from './commands/update.ts';
import { isDefined } from './isDefined.ts';

const commands: Record<string, Command> = {
  login: loginCommand,
  logout: logoutCommand,
  auth: authCommand,
  me: meCommand,
  tasks: tasksCommand,
  task: taskCommand,
  create: createCommand,
  update: updateCommand,
  delete: deleteCommand,
  comment: commentCommand,
  projects: projectsCommand,
  search: searchCommand,
};

function printHelp(name?: string): void {
  const command = isDefined(name) ? commands[name] : undefined;
  if (isDefined(command)) {
    process.stdout.write(`${command.summary}\n\n${command.usage}\n`);
    return;
  }

  process.stdout.write(
    `asana — query and update Asana tasks\n\nUsage: asana <command> [flags]\n\nCommands:\n${Object.entries(
      commands,
    )
      .map(([key, entry]) => `  ${key.padEnd(10)} ${entry.summary}`)
      .join('\n')}\n\nEvery command accepts --json for machine-readable output.\nRun "asana help <command>" for details.\n`,
  );
}

const [name, ...rest] = process.argv.slice(2);

if (!isDefined(name) || name === 'help' || name === '--help' || name === '-h') {
  printHelp(rest[0]);
  process.exit(0);
}

const command = commands[name];
if (!isDefined(command)) {
  process.stderr.write(`Unknown command "${name}". Run "asana help".\n`);
  process.exit(1);
}

if (rest.includes('--help') || rest.includes('-h')) {
  printHelp(name);
  process.exit(0);
}

try {
  const { values, positionals } = parseArgs({
    args: rest,
    options: command.options,
    allowPositionals: true,
    strict: true,
  });
  await command.run({ values, positionals });
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
