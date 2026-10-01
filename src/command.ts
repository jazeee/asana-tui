import type { ParseArgsConfig } from 'node:util';

export type CommandOptions = NonNullable<ParseArgsConfig['options']>;

export type CommandValues = Record<string, string | boolean | (string | boolean)[] | undefined>;

export type Command = {
  summary: string;
  usage: string;
  options: CommandOptions;
  run: (input: { values: CommandValues; positionals: string[] }) => Promise<void>;
};

export const jsonOption: CommandOptions = { json: { type: 'boolean' } };

export function readString(values: CommandValues, key: string): string | undefined {
  const value = values[key];
  return typeof value === 'string' ? value : undefined;
}

export function readFlag(values: CommandValues, key: string): boolean {
  return values[key] === true;
}

export function readStrings(values: CommandValues, key: string): string[] {
  const value = values[key];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' ? [value] : [];
}
