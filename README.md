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

Preferred — a personal access token from <https://app.asana.com/0/my-apps>:

```bash
asana auth --token 1/1234:abcdef... --workspace 1203...
```

The token is written to `~/.config/asana-cli/config.json` with mode `0600`.
`ASANA_TOKEN` and `ASANA_WORKSPACE` override the file if you prefer env vars.

Fallback — a browser session cookie. Copy the entire `Cookie:` request header
from any logged-in `app.asana.com` request in devtools:

```bash
asana auth --cookie 'xsrf_token=...; ticket=...; ...'
```

Cookies expire and break without warning; use a token unless you can't.

`--workspace` is optional if your account has exactly one workspace.

## Commands

```
asana me                                 # who am I, and which workspaces
asana tasks                              # my incomplete tasks, soonest due first
asana task <gid>                         # one task in full
asana create <name>                      # create a task
asana update <gid>                       # change a task
asana comment <gid> <text>               # add a comment
asana projects                           # list projects / sections
asana search <query>                     # typeahead over tasks, projects, users
```

Run `asana help <command>` for the flags of any one of them.

### Querying

```bash
asana tasks --overdue                       # past due and still open
asana tasks --due-before +7d                # the coming week
asana tasks --assignee teammate@acme.com
asana tasks --project 1203... --all         # including completed
asana tasks --contains invoice --json
asana task 1203... --comments --subtasks
```

Dates accept `YYYY-MM-DD`, `today`, `tomorrow`, `+3d`, `-1w`, or `none`.

### Updating

```bash
asana update 1203... --complete
asana update 1203... --due tomorrow --assignee me
asana update 1203... --append-notes "Deployed to staging."
asana update 1203... --add-project 99... --section 88...
asana update 1203... --due none                  # clear the due date
asana comment 1203... "Blocked on the API review."
```

### Creating

```bash
asana create "Review the migration plan" --due +2d --assignee me --project 1203...
asana create "Subtask" --parent 1203...
```

## For agents

- `--json` on any command prints the raw Asana payload, pretty-printed, to stdout.
- Errors go to stderr and exit `1`; nothing else is ever written to stderr.
- `asana tasks --json` is the cheapest way to get an actionable list: it already
  filters to incomplete, sorts by due date, and includes `gid`, `due_on`,
  `assignee`, `projects`, and `permalink_url`.
- Mutations are explicit per flag, so a partial failure is reported and the
  final state of the task is re-fetched and printed.

## Development

```bash
npm run typecheck
node --test src/*.test.ts
```
