import { createServer } from 'node:http';
import { isDefined } from '../isDefined.ts';

function renderPage(title: string, detail: string): string {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font:16px/1.5 system-ui;display:grid;place-items:center;height:90vh;margin:0">
<div style="text-align:center"><h1 style="margin:0 0 .3em">${title}</h1><p style="color:#666">${detail}</p></div>`;
}

/** Serves the OAuth redirect URI once and resolves with the authorization code. */
export function waitForCallback({
  redirectUri,
  state,
  timeoutMs = 300_000,
}: {
  redirectUri: string;
  state: string;
  timeoutMs?: number;
}): Promise<string> {
  const target = new URL(redirectUri);

  return new Promise<string>((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', target.origin);
      if (url.pathname !== target.pathname) {
        response.writeHead(404).end();
        return;
      }

      const settle = (status: number, title: string, detail: string, outcome: () => void) => {
        response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(renderPage(title, detail));
        clearTimeout(timer);
        server.close();
        outcome();
      };

      const error = url.searchParams.get('error');
      if (isDefined(error)) {
        const detail = url.searchParams.get('error_description') ?? error;
        settle(400, 'Authorization failed', detail, () => reject(new Error(`Asana denied authorization: ${detail}`)));
        return;
      }

      if (url.searchParams.get('state') !== state) {
        settle(400, 'Authorization failed', 'State mismatch.', () =>
          reject(new Error('OAuth state mismatch; the callback did not come from the request this CLI started.')),
        );
        return;
      }

      const code = url.searchParams.get('code');
      if (!isDefined(code)) {
        settle(400, 'Authorization failed', 'No code in the callback.', () =>
          reject(new Error('Asana callback contained no authorization code.')),
        );
        return;
      }

      settle(200, 'Connected to Asana', 'You can close this tab and return to the terminal.', () => resolve(code));
    });

    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for the Asana callback. Retry, or use "asana login --manual".'));
    }, timeoutMs);
    timer.unref();

    server.on('error', (cause: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        cause.code === 'EADDRINUSE'
          ? new Error(`Port ${target.port} is already in use. Free it, or pass --redirect-uri with a port you registered.`)
          : cause,
      );
    });

    server.listen(Number(target.port === '' ? '80' : target.port), target.hostname);
  });
}
