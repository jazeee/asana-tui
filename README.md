# asana-cli

A small, dependency-free CLI for reading and updating Asana tasks. Built so an
agent can drive it: every command takes `--json` and exits non-zero with a plain
error message on failure.

Requires Node >= 22.6 (runs TypeScript directly via native type stripping). No
build step, no `node_modules` at runtime.

## Install

```bash
npm install          # dev dependencies only (types + tsc)
npm link             # optional: puts `asana` on your PATH
```

Or call it directly: `node src/cli.ts <command>`.

## Authenticate

A personal access token is the simplest path and needs no app registration:

```bash
asana auth --token 1/1234:abcdef... --workspace 1187495389489253
```

Create one at <https://app.asana.com/0/my-apps> → *Create new token*. It is
written to `~/.config/asana-cli/config.json` at mode `0600` and does not expire,
so every later session and agent invocation is already authenticated.

To avoid leaving the token in your shell history or in `ps` output, pipe it in
instead:

```bash
read -rs TOKEN && ASANA_TOKEN=$TOKEN asana auth --show   # verify before storing
```

### OAuth

Use OAuth when your org disables personal access tokens, or when you want
scoped, revocable access.

**One-time setup.** Create an app at <https://app.asana.com/0/my-apps> → *Create
new app* → *OAuth*. Add this exact redirect URL:

```
http://localhost:8080/callback
```

Copy the **Client ID**. A client secret is not required — the CLI uses PKCE
(S256) and authenticates as a public client — but it is accepted via
`--client-secret` if your app is configured as confidential.

**Log in.** Once, ever:

```bash
asana login --client-id 1210987654321098
```

This opens your browser, captures the callback on a short-lived local server,
exchanges the code, and stores the result in `~/.config/asana-cli/config.json`
(mode `0600`, written atomically).

#### Persistence across sessions

Asana access tokens last one hour; the refresh token does not expire until it is
revoked. The CLI stores the refresh token and renews access automatically, so
every later session — and every agent invocation — is already authenticated:

- A valid access token is reused as-is, with no network round trip.
- A token expired, or within 60s of expiring, is refreshed before the request.
- A `401` from Asana triggers one forced refresh and a single retry.

Nothing re-prompts until you run `asana logout` or revoke the app in Asana.

#### Headless and remote shells

No browser on the box? Authorize anywhere and paste the URL you land on:

```bash
asana login --client-id <id> --manual
```

The `state` parameter is verified on both paths, so a URL from a different login
attempt is rejected.

### Cookie fallback

If both of the above are blocked, copy the entire `Cookie:` request header from a
logged-in `app.asana.com` request in devtools:

```bash
asana auth --cookie 'xsrf_token=...; ticket=...'
```

It expires without warning — a genuine last resort.

### Workspace and env vars

`asana login` records your workspace automatically when the account has exactly
one; otherwise set it with `asana auth --workspace <gid>`. The gid is the number
in your board URL — `https://app.asana.com/1/1187495389489253/home` →
`1187495389489253`.

`ASANA_TOKEN`, `ASANA_CLIENT_ID`, `ASANA_CLIENT_SECRET`, `ASANA_COOKIE`, and
`ASANA_WORKSPACE` all override the config file.

Inspect state at any time with `asana auth` (add `--show` to verify against the
API, `--json` for a machine-readable summary).

## Commands

```
asana auth                               # inspect credentials / set token + workspace
asana login                              # OAuth alternative; refreshes silently
asana logout                             # revoke and forget the stored tokens
asana me                                 # who am I, and which workspaces
asana tasks                              # my incomplete tasks, soonest due first
asana task <url>                         # one task in full
asana create <name>                      # create a task
asana update <url>                       # change a task
asana comment <url> <text>               # add a comment
asana delete <url> --yes                 # delete a task
asana projects                           # list projects / sections
asana search <query>                     # typeahead over tasks, projects, users
```

Run `asana help <command>` for the flags of any one of them.

### Tasks are identified by URL

Every command prints the task's Asana URL rather than a bare gid, and every
command accepts a URL anywhere it accepts a gid. Output is therefore directly
actionable — copy a line from `asana tasks` and paste it into `asana update`:

```bash
asana tasks
# ○ —           Rework auth out of primary  [Brain Dumps]
#   https://app.asana.com/1/1187495389489253/project/1219084434562732/task/1219084491890009

asana update https://app.asana.com/1/1187495389489253/project/1219084434562732/task/1219084491890009 --complete
```

Both the modern `/1/<workspace>/project/<project>/task/<task>` and the legacy
`/0/<project>/<task>` permalinks are understood, with or without a trailing
`/f` or a query string. Plain gids still work everywhere. `--project` resolves
the project out of the same URL, so a task link can be reused as a project
filter.

### Querying

```bash
asana tasks --overdue                       # past due and still open
asana tasks --due-before +7d                # the coming week
asana tasks --assignee teammate@acme.com
asana tasks --project <project-url> --all   # including completed
asana tasks --contains invoice --json
asana task <task-url> --comments --subtasks
```

Dates accept `YYYY-MM-DD`, `today`, `tomorrow`, `+3d`, `-1w`, or `none`.

### Updating

```bash
asana update <task-url> --complete
asana update <task-url> --due tomorrow --assignee me
asana update <task-url> --append-notes "Deployed to staging."
asana update <task-url> --add-project <project-url> --section 88...
asana update <task-url> --due none                  # clear the due date
asana comment <task-url> "Blocked on the API review."
asana delete <task-url> --yes
```

### Creating

```bash
asana create "Review the migration plan" --due +2d --assignee me --project <project-url>
asana create "Subtask" --parent <task-url>
```

## For agents

- `--json` on any command prints the raw Asana payload, pretty-printed, to stdout.
- Errors go to stderr and exit `1`; nothing else is ever written to stderr.
- `asana tasks --json` is the cheapest way to get an actionable list: it already
  filters to incomplete, sorts by due date, and includes `gid`, `due_on`,
  `assignee`, `projects`, and `permalink_url`.
- Text output pairs each task with its URL on the following line, and every
  command takes that URL back as input, so no gid extraction is ever needed.
- Mutations are explicit per flag, so a partial failure is reported and the
  final state of the task is re-fetched and printed.
- Auth needs no attention: tokens refresh themselves. An exit code of `1` with a
  message mentioning `asana login` is the only case needing a human.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `No OAuth client id` | `asana login --client-id <id>` after registering the app |
| `redirect_uri` mismatch in the browser | The URL in your app settings must equal `--redirect-uri` exactly, including port and path |
| `Port 8080 is already in use` | Register and pass a different `--redirect-uri` |
| Browser never opens | Use the printed URL, or `--manual` |
| `Asana rejected the credentials` | Token revoked or expired: `asana auth --token <new>`, or `asana login` |
| `Not a recognized ID` | The gid belongs to another workspace, or the task was deleted |

## Development

```bash
npm run typecheck
node --test src/*.test.ts
```
