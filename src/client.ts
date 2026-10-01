import { type Credentials, canRefresh, resolveCredentials } from './auth/credentials.ts';
import { isDefined } from './isDefined.ts';

const baseUrl = process.env.ASANA_BASE_URL ?? 'https://app.asana.com/api/1.0';

export type Query = Record<string, string | number | boolean | undefined>;

export class AsanaError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AsanaError';
    this.status = status;
  }
}

function buildHeaders(credentials: Credentials, method: string): Headers {
  const headers = new Headers({ Accept: 'application/json' });
  if (method !== 'GET') headers.set('Content-Type', 'application/json');

  if (credentials.kind === 'bearer') {
    headers.set('Authorization', `Bearer ${credentials.token}`);
    return headers;
  }

  headers.set('Cookie', credentials.cookie);
  // Asana's session auth rejects writes without the xsrf cookie echoed back as a header.
  const xsrf = /(?:^|;\s*)xsrf_token=([^;]+)/.exec(credentials.cookie)?.[1];
  if (isDefined(xsrf)) {
    headers.set('X-XSRF-Token', decodeURIComponent(xsrf));
    headers.set('X-Asana-Xsrf-Token', decodeURIComponent(xsrf));
  }
  return headers;
}

function buildUrl(path: string, query?: Query): URL {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (isDefined(value)) url.searchParams.set(key, String(value));
  }
  return url;
}

async function fetchAsana(url: URL, method: string, body?: unknown): Promise<Response> {
  const send = async (credentials: Credentials) =>
    fetch(url, {
      method,
      headers: buildHeaders(credentials, method),
      body: isDefined(body) ? JSON.stringify({ data: body }) : undefined,
      redirect: 'manual',
    });

  const response = await send(await resolveCredentials());
  if (response.status !== 401 || !canRefresh()) return response;

  // The stored access token was revoked or expired early; one forced refresh then give up.
  return send(await resolveCredentials({ forceRefresh: true }));
}

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { errors?: { message?: string; help?: string }[] };
    const messages = (parsed.errors ?? [])
      .map((error) => [error.message, error.help].filter(isDefined).join(' — '))
      .filter((message) => message !== '');
    if (messages.length > 0) return messages.join('; ');
  } catch {
    // fall through to the raw body
  }
  return text === '' ? response.statusText : text;
}

async function raiseForStatus(response: Response): Promise<void> {
  if (response.status === 401 || response.status === 302) {
    throw new AsanaError('Asana rejected the credentials. Run "asana login" to reconnect.', response.status);
  }
  if (!response.ok) throw new AsanaError(await readError(response), response.status);
}

export async function requestAsana<T>(
  path: string,
  options: { method?: string; query?: Query; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const response = await fetchAsana(buildUrl(path, options.query), method, options.body);
  await raiseForStatus(response);
  if (response.status === 204) return undefined as T;

  return ((await response.json()) as { data: T }).data;
}

/** Follows Asana's offset pagination until `limit` items are collected or the pages run out. */
export async function requestAsanaList<T>(
  path: string,
  options: { query?: Query; limit?: number } = {},
): Promise<T[]> {
  const limit = options.limit ?? 100;
  const collected: T[] = [];
  let offset: string | undefined;

  while (collected.length < limit) {
    const url = buildUrl(path, {
      ...options.query,
      limit: Math.min(100, limit - collected.length),
      offset,
    });
    const response = await fetchAsana(url, 'GET');
    await raiseForStatus(response);

    const page = (await response.json()) as { data: T[]; next_page?: { offset?: string } | null };
    collected.push(...page.data);
    offset = page.next_page?.offset;
    if (!isDefined(offset)) break;
  }

  return collected.slice(0, limit);
}
