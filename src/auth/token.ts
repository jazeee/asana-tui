import { isDefined } from '../isDefined.ts';

export const authorizeUrl = 'https://app.asana.com/-/oauth_authorize';
const tokenUrl = process.env.ASANA_TOKEN_URL ?? 'https://app.asana.com/-/oauth_token';

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  data?: { gid?: string; name?: string; email?: string };
};

export async function requestToken(form: Record<string, string | undefined>): Promise<TokenResponse> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(form)) {
    if (isDefined(value)) body.set(key, value);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });

  const text = await response.text();
  const parsed = (() => {
    try {
      return JSON.parse(text) as Partial<TokenResponse> & { error?: string; error_description?: string };
    } catch {
      return undefined;
    }
  })();

  if (!isDefined(parsed) || isDefined(parsed.error) || !isDefined(parsed.access_token)) {
    const detail = parsed?.error_description ?? parsed?.error ?? text;
    throw new Error(`Asana token request failed (${response.status}): ${detail}`);
  }

  return parsed as TokenResponse;
}
