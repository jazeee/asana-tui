import { type Command, readFlag } from '../command.ts';
import { configPath, readConfig, writeConfig } from '../config.ts';
import { isDefined } from '../isDefined.ts';

export const logoutCommand: Command = {
  summary: 'Forget stored tokens (keeps the client id unless --all)',
  usage: 'asana logout [--all]',
  options: { all: { type: 'boolean' } },
  run: async ({ values }) => {
    const config = readConfig();

    if (isDefined(config.refreshToken)) {
      await fetch('https://app.asana.com/-/oauth_revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId ?? '',
          client_secret: config.clientSecret ?? '',
          token: config.refreshToken,
        }),
      }).catch(() => undefined);
    }

    writeConfig(
      readFlag(values, 'all')
        ? {}
        : { clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri, workspace: config.workspace },
    );
    process.stdout.write(`Logged out. Updated ${configPath}\n`);
  },
};
