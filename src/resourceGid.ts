import { isDefined } from './isDefined.ts';

/**
 * Accepts a bare gid or any Asana permalink and returns the resource gid, so
 * output that shows URLs can be pasted straight back into another command.
 */
export function resolveGid(input: string, kind?: 'task' | 'project'): string {
  const value = input.trim();
  if (/^\d+$/.test(value)) return value;

  const path = (() => {
    try {
      return new URL(value).pathname;
    } catch {
      return undefined;
    }
  })();
  if (!isDefined(path)) {
    throw new Error(`Expected a gid or an Asana URL, got "${input}".`);
  }

  if (isDefined(kind)) {
    const typed = new RegExp(`/${kind}/(\\d+)`).exec(path)?.[1];
    if (isDefined(typed)) return typed;
  }

  const task = /\/task\/(\d+)/.exec(path)?.[1];
  if (isDefined(task)) return task;

  const segments = path.split('/').filter((segment) => segment !== '');
  // Asana paths open with a version prefix (/0/… or /1/…) that is not a gid.
  const withoutPrefix = segments[0] === '0' || segments[0] === '1' ? segments.slice(1) : segments;
  const trailing = withoutPrefix.filter((segment) => /^\d+$/.test(segment)).at(-1);
  if (isDefined(trailing)) return trailing;

  throw new Error(`Could not find a gid in "${input}".`);
}
