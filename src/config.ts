import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { isDefined } from './isDefined.ts';

export type Config = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  accessToken?: string;
  refreshToken?: string;
  /** Epoch milliseconds at which `accessToken` stops working. */
  expiresAt?: number;
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
  // Another CLI process may be refreshing concurrently; swap the file in atomically.
  const staging = `${configPath}.${process.pid}.tmp`;
  writeFileSync(staging, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  renameSync(staging, configPath);
}

export function updateConfig(changes: Partial<Config>): Config {
  const merged = { ...readConfig(), ...changes };
  writeConfig(merged);
  return merged;
}

export function resolveWorkspace(override?: string): string | undefined {
  if (isDefined(override) && override !== '') return override;
  const fromEnv = process.env.ASANA_WORKSPACE;
  if (isDefined(fromEnv) && fromEnv !== '') return fromEnv;
  return readConfig().workspace;
}

export const defaultRedirectUri = 'http://localhost:8080/callback';

export function resolveClientId(override?: string): string {
  const clientId = override ?? process.env.ASANA_CLIENT_ID ?? readConfig().clientId;
  if (!isDefined(clientId) || clientId === '') {
    throw new Error(
      'No OAuth client id. Register an app at https://app.asana.com/0/my-apps, then run "asana login --client-id <id>".',
    );
  }
  return clientId;
}

export function resolveClientSecret(override?: string): string | undefined {
  const secret = override ?? process.env.ASANA_CLIENT_SECRET ?? readConfig().clientSecret;
  return isDefined(secret) && secret !== '' ? secret : undefined;
}
