# @hmmzza12/forge-cli

Talk to [Forge](https://forgecli.netlify.app) — a team project management tool — from your
terminal. Zero setup: it defaults to the hosted production API, so the first command you run
just works.

## Quick start

```bash
npx @hmmzza12/forge-cli auth login
```

That's it — no install, no config file to create first. Try the seeded demo account:

```
Email: demo@forge.dev
Password: password123
```

Then:

```bash
forge org list
forge project use "Website Redesign"
forge task list
```

(With `npx`, prefix every command with `npx @hmmzza12/forge-cli` instead of `forge`, or install
it once — see below. The published command itself is still named `forge`.)

## Install once (optional)

```bash
npm install -g @hmmzza12/forge-cli
forge --version
```

## Point at a different API

By default the CLI talks to `https://forgecli.netlify.app`. To use a local or self-hosted API:

```bash
export FORGE_API_URL=http://127.0.0.1:3000
forge auth login
```

`FORGE_API_URL` only takes effect **before your first login** (or before `~/.forge/config.json`
exists) — after that, the resolved URL is saved to the config file and reused, so `forge`
doesn't need the env var set on every run. To point an already-configured install at a
different API, either edit the `"apiUrl"` value in `~/.forge/config.json` directly, or delete
the file and log in again with `FORGE_API_URL` set.

## Commands

```
forge auth login | logout | whoami
forge org create | list | use | invite | members | role | remove
forge project create | list | use
forge task add | list | view | update | assign | label | unlabel | done | delete
forge comment add | list | delete
forge label create | list
```

Every command accepts `--json` for machine-readable output. Run `forge <command> --help` for
details, or `forge --help` for the full list.

Session, tokens, and your active org/project are stored in `~/.forge/config.json`.

Full docs, API reference, and self-hosting instructions live in the
[main repository README](https://github.com/Hmmzza12/CLI-PROJECT#readme).
