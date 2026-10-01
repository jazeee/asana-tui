import { requestAsana } from './client.ts';
import { resolveWorkspace } from './config.ts';
import { isDefined } from './isDefined.ts';
import type { User } from './types.ts';

/** Uses the configured workspace, else the account's only workspace, else fails with the choices. */
export async function requireWorkspaceGid(override?: string): Promise<string> {
  const configured = resolveWorkspace(override);
  if (isDefined(configured)) return configured;

  const me = await requestAsana<User>('/users/me', { query: { opt_fields: 'workspaces.name' } });
  const workspaces = me.workspaces ?? [];
  const only = workspaces.length === 1 ? workspaces[0] : undefined;
  if (isDefined(only)) return only.gid;

  throw new Error(
    `Multiple workspaces found; pick one with --workspace <gid> or "asana auth --workspace <gid>":\n${workspaces
      .map((workspace) => `  ${workspace.gid}  ${workspace.name ?? ''}`)
      .join('\n')}`,
  );
}
