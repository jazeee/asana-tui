import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, test } from 'node:test';

const sandbox = mkdtempSync(join(tmpdir(), 'asana-credentials-'));
process.env.XDG_CONFIG_HOME = sandbox;
process.env.ASANA_CLIENT_ID = 'test-client';
delete process.env.ASANA_TOKEN;
delete process.env.ASANA_ACCESS_TOKEN;
delete process.env.ASANA_COOKIE;

const { readConfig, writeConfig } = await import('../config.ts');
const { resolveCredentials } = await import('./credentials.ts');

let tokenRequests = 0;
const realFetch = globalThis.fetch;

before(() => {
  globalThis.fetch = (async () => {
    tokenRequests += 1;
    return new Response(JSON.stringify({ access_token: `refreshed-${tokenRequests}`, expires_in: 3600 }), {
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = realFetch;
  rmSync(sandbox, { recursive: true, force: true });
});

beforeEach(() => {
  tokenRequests = 0;
});

test('reuses a stored access token that is still comfortably valid', async () => {
  writeConfig({ refreshToken: 'rt', accessToken: 'at', expiresAt: Date.now() + 600_000 });

  assert.deepEqual(await resolveCredentials(), { kind: 'bearer', token: 'at' });
  assert.equal(tokenRequests, 0);
});

test('refreshes and persists when the access token is expired', async () => {
  writeConfig({ refreshToken: 'rt', accessToken: 'at', expiresAt: Date.now() - 1 });

  assert.deepEqual(await resolveCredentials(), { kind: 'bearer', token: 'refreshed-1' });
  assert.equal(tokenRequests, 1);
  assert.equal(readConfig().accessToken, 'refreshed-1');
  assert.equal(readConfig().refreshToken, 'rt', 'keeps the refresh token when Asana does not rotate it');
});

test('refreshes a token that expires within the safety skew', async () => {
  writeConfig({ refreshToken: 'rt', accessToken: 'at', expiresAt: Date.now() + 30_000 });

  assert.deepEqual(await resolveCredentials(), { kind: 'bearer', token: 'refreshed-1' });
});

test('forceRefresh bypasses an unexpired token so a 401 can be retried', async () => {
  writeConfig({ refreshToken: 'rt', accessToken: 'at', expiresAt: Date.now() + 600_000 });

  assert.deepEqual(await resolveCredentials({ forceRefresh: true }), { kind: 'bearer', token: 'refreshed-1' });
});

test('falls back to a personal access token, then to a cookie', async () => {
  writeConfig({ token: 'pat' });
  assert.deepEqual(await resolveCredentials(), { kind: 'bearer', token: 'pat' });

  writeConfig({ cookie: 'ticket=abc' });
  assert.deepEqual(await resolveCredentials(), { kind: 'cookie', cookie: 'ticket=abc' });
});

test('explains how to authenticate when nothing is stored', async () => {
  writeConfig({});
  await assert.rejects(resolveCredentials(), /asana login/);
});
