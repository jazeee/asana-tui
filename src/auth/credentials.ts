import { readConfig, resolveClientId, resolveClientSecret, updateConfig } from '../config.ts';
import { isDefined } from '../isDefined.ts';
import { requestToken } from './token.ts';

export type Credentials = { kind: 'bearer'; token: string } | { kind: 'cookie'; cookie: string };

/** Refreshed this far ahead of expiry so a request never starts with a token about to die. */
const refreshSkewMs = 60_000;

export function canRefresh(): boolean {
  return isDefined(readConfig().refreshToken);
}

export async function refreshAccessToken(): Promise<string> {
  const config = readConfig();
  if (!isDefined(config.refreshToken)) {
    throw new Error('No refresh token stored. Run "asana login".');
  }

  const refreshed = await requestToken({
    grant_type: 'refresh_token',
    client_id: resolveClientId(),
    client_secret: resolveClientSecret(),
    refresh_token: config.refreshToken,
  });

  updateConfig({
    accessToken: refreshed.access_token,
    // Asana usually keeps the same refresh token, but honours rotation when it happens.
    refreshToken: refreshed.refresh_token ?? config.refreshToken,
    expiresAt: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
  });

  return refreshed.access_token;
}

export async function resolveCredentials(options: { forceRefresh?: boolean } = {}): Promise<Credentials> {
  const tokenFromEnv = process.env.ASANA_TOKEN ?? process.env.ASANA_ACCESS_TOKEN;
  if (isDefined(tokenFromEnv) && tokenFromEnv !== '') return { kind: 'bearer', token: tokenFromEnv };

  const cookieFromEnv = process.env.ASANA_COOKIE;
  if (isDefined(cookieFromEnv) && cookieFromEnv !== '') return { kind: 'cookie', cookie: cookieFromEnv };

  const config = readConfig();

  if (isDefined(config.refreshToken)) {
    if (
      options.forceRefresh !== true &&
      isDefined(config.accessToken) &&
      isDefined(config.expiresAt) &&
      config.expiresAt - refreshSkewMs > Date.now()
    ) {
      return { kind: 'bearer', token: config.accessToken };
    }
    return { kind: 'bearer', token: await refreshAccessToken() };
  }

  if (isDefined(config.token) && config.token !== '') return { kind: 'bearer', token: config.token };
  if (isDefined(config.cookie) && config.cookie !== '') return { kind: 'cookie', cookie: config.cookie };

  throw new Error('Not authenticated. Run "asana login --client-id <id>" to connect your Asana account.');
}
