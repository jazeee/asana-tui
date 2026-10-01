import { requestAsanaList } from '../client.ts';
import { type Command, jsonOption, readFlag, readString } from '../command.ts';
import { isDefined } from '../isDefined.ts';
import { printJson, printProjectList } from '../output.ts';
import { resolveGid } from '../resourceGid.ts';
import type { Project, Resource } from '../types.ts';
import { requireWorkspaceGid } from '../workspace.ts';

export const projectsCommand: Command = {
  summary: 'List projects, or the sections of one project',
  usage: 'asana projects [--workspace <gid>] [--archived] [--contains <text>] [--sections <project-url|gid>] [--limit <n>] [--json]',
  options: {
    ...jsonOption,
    workspace: { type: 'string' },
    archived: { type: 'boolean' },
    contains: { type: 'string' },
    sections: { type: 'string' },
    limit: { type: 'string' },
  },
  run: async ({ values }) => {
    const sectionsFlag = readString(values, 'sections');
    if (isDefined(sectionsFlag)) {
      const sections = await requestAsanaList<Resource>(`/projects/${resolveGid(sectionsFlag, 'project')}/sections`, {
        query: { opt_fields: 'name' },
      });
      if (readFlag(values, 'json')) {
        printJson(sections);
        return;
      }
      for (const section of sections) {
        process.stdout.write(`${section.gid.padEnd(16)} ${section.name ?? ''}\n`);
      }
      return;
    }

    const contains = readString(values, 'contains')?.toLowerCase();
    const projects = (
      await requestAsanaList<Project>('/projects', {
        limit: Number(readString(values, 'limit') ?? '100'),
        query: {
          workspace: await requireWorkspaceGid(readString(values, 'workspace')),
          archived: readFlag(values, 'archived'),
          opt_fields: 'name,archived,permalink_url',
        },
      })
    ).filter((project) => !isDefined(contains) || (project.name ?? '').toLowerCase().includes(contains));

    if (readFlag(values, 'json')) {
      printJson(projects);
      return;
    }
    printProjectList(projects);
  },
};
