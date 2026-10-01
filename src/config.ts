import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { isDefined } from './isDefined.ts';

export type Config = {
  token?: string;
  cookie?: string;
  workspace?: string;
};

export const configPath = join(
  process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
  'asana-cli',
  'config.json',
);

export function readConfig(): Config {
  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as Config;
  } catch {
    return {};
  }
}

export function writeConfig(config: Config): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

export type Auth = { kind: 'token'; token: string } | { kind: 'cookie'; cookie: string };

export function resolveAuth(): Auth {
  const config = readConfig();
  const token = process.env.ASANA_TOKEN ?? process.env.ASANA_ACCESS_TOKEN ?? config.token;
  if (isDefined(token) && token !== '') return { kind: 'token', token };

  const cookie = process.env.ASANA_COOKIE ?? config.cookie;
  if (isDefined(cookie) && cookie !== '') return { kind: 'cookie', cookie };

  throw new Error(
    `No Asana credentials found. Run "asana auth --token <personal-access-token>" (create one at https://app.asana.com/0/my-apps), or set ASANA_TOKEN.`,
  );
}

export function resolveWorkspace(override?: string): string | undefined {
  if (isDefined(override) && override !== '') return override;
  const fromEnv = process.env.ASANA_WORKSPACE;
  if (isDefined(fromEnv) && fromEnv !== '') return fromEnv;
  return readConfig().workspace;
}
