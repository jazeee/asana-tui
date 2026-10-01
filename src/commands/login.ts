import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { waitForCallback } from '../auth/callbackServer.ts';
import { createPkce } from '../auth/pkce.ts';
import { authorizeUrl, requestToken } from '../auth/token.ts';
import { type Command, jsonOption, readFlag, readString } from '../command.ts';
import {
  configPath,
  defaultRedirectUri,
  readConfig,
  resolveClientId,
  resolveClientSecret,
  updateConfig,
} from '../config.ts';
import { isDefined } from '../isDefined.ts';
import { printJson } from '../output.ts';
import { requestAsana } from '../client.ts';
import type { User } from '../types.ts';

function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    spawn(command, [url], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' }).unref();
  } catch {
    // Headless or no handler registered; the printed URL is the fallback.
  }
}

export const loginCommand: Command = {
  summary: 'Connect an Asana account over OAuth and remember it',
  usage: `asana login [--client-id <id>] [--client-secret <secret>] [--redirect-uri <uri>]
              [--manual] [--no-browser] [--scope <scopes>] [--json]

Register an app at https://app.asana.com/0/my-apps, add this exact redirect URL:
  ${defaultRedirectUri}
then run "asana login --client-id <id>". The client id and refresh token are saved
to ${configPath}, so later sessions reuse them and refresh access tokens silently.

--manual suits headless or remote shells: authorize in any browser, then paste the
URL you land on back into the prompt.`,
  options: {
    ...jsonOption,
    'client-id': { type: 'string' },
    'client-secret': { type: 'string' },
    'redirect-uri': { type: 'string' },
    scope: { type: 'string' },
    manual: { type: 'boolean' },
    'no-browser': { type: 'boolean' },
  },
  run: async ({ values }) => {
    const clientId = resolveClientId(readString(values, 'client-id'));
    const clientSecret = resolveClientSecret(readString(values, 'client-secret'));
    const redirectUri = readString(values, 'redirect-uri') ?? readConfig().redirectUri ?? defaultRedirectUri;
    const manual = readFlag(values, 'manual');

    const pkce = createPkce();
    const state = randomBytes(16).toString('hex');
    const url = new URL(authorizeUrl);
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
      scope: readString(values, 'scope') ?? 'default',
    }).toString();

    process.stderr.write(`Open this URL to authorize:\n\n${url.toString()}\n\n`);
    if (!manual && !readFlag(values, 'no-browser')) openBrowser(url.toString());

    const code = manual
      ? await (async () => {
          const prompt = createInterface({ input: process.stdin, output: process.stderr });
          const answer = (await prompt.question('Paste the full URL you were redirected to: ')).trim();
          prompt.close();
          const redirected = new URL(answer.includes('://') ? answer : `${redirectUri}?${answer.replace(/^\?/, '')}`);
          if (redirected.searchParams.get('state') !== state) {
            throw new Error('OAuth state mismatch; that URL came from a different login attempt.');
          }
          const pasted = redirected.searchParams.get('code');
          if (!isDefined(pasted)) throw new Error('That URL contained no authorization code.');
          return pasted;
        })()
      : await (async () => {
          process.stderr.write(`Waiting for the callback on ${redirectUri} …\n`);
          return waitForCallback({ redirectUri, state });
        })();

    const granted = await requestToken({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      code_verifier: pkce.verifier,
    });

    updateConfig({
      clientId,
      clientSecret,
      redirectUri,
      accessToken: granted.access_token,
      refreshToken: granted.refresh_token,
      expiresAt: Date.now() + (granted.expires_in ?? 3600) * 1000,
    });

    const me = await requestAsana<User>('/users/me', { query: { opt_fields: 'name,email,workspaces.name' } });
    const workspaces = me.workspaces ?? [];
    const only = workspaces.length === 1 ? workspaces[0] : undefined;
    if (isDefined(only) && !isDefined(readConfig().workspace)) updateConfig({ workspace: only.gid });

    if (readFlag(values, 'json')) {
      printJson({ user: me, persistedTo: configPath, offlineAccess: isDefined(granted.refresh_token) });
      return;
    }

    process.stdout.write(`Logged in as ${me.name ?? ''} <${me.email ?? ''}>\nSaved to ${configPath}\n`);
    if (!isDefined(granted.refresh_token)) {
      process.stdout.write('Warning: Asana returned no refresh token, so this session expires in an hour.\n');
    }
    if (workspaces.length > 0) {
      process.stdout.write('\nworkspaces:\n');
      for (const workspace of workspaces) {
        const marker = workspace.gid === readConfig().workspace ? '*' : ' ';
        process.stdout.write(`${marker} ${workspace.gid.padEnd(16)} ${workspace.name ?? ''}\n`);
      }
      if (!isDefined(readConfig().workspace)) {
        process.stdout.write('\nPick a default with "asana auth --workspace <gid>".\n');
      }
    }
  },
};
