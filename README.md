# Forge

A multi-user, team-based project management tool with three layers: a **REST API**, a
**CLI client**, and a **web frontend**. Think a tiny Linear/Jira.

Full feature set: authentication, organizations, member management, projects, tasks
(CRUD + filtering + pagination), comments, and labels — plus a hardened API and a
React web app.

```
┌──────────────┐                          ┌────────────────────────────────┐
│  forge CLI   │ ──── HTTP (Bearer) ────▶  │                                │
├──────────────┤                          │   Fastify API  ──▶  SQLite      │
│  web (React) │ ──── HTTP + cookie ────▶  │   (Drizzle ORM, better-sqlite3)│
└──────────────┘   (Vite proxy in dev)    └────────────────────────────────┘
```

## Tech stack

| Layer      | Choice                                                         |
| ---------- | -------------------------------------------------------------- |
| API        | Node.js + [Fastify](https://fastify.dev) 5 (rate-limit, cookie) |
| Database   | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) 13 |
| ORM        | [Drizzle](https://orm.drizzle.team) + drizzle-kit migrations   |
| Auth       | JWT access token + rotating refresh token (httpOnly cookie for web) |
| Validation | [Zod](https://zod.dev)                                         |
| CLI        | [Commander](https://github.com/tj/commander.js), chalk, ora, cli-table3, @inquirer/prompts |
| Frontend   | React + Vite, [TanStack Query](https://tanstack.com/query)/[Router](https://tanstack.com/router), Tailwind v4, shadcn-style UI, Zustand, dnd-kit |
| Tests      | [Vitest](https://vitest.dev)                                   |

## Repository layout

```
.
├── api/                    # REST API
│   ├── src/
│   │   ├── routes/         # route → controller wiring
│   │   ├── controllers/    # validate (Zod) → call service → shape response
│   │   ├── services/       # business logic + Drizzle queries
│   │   ├── middleware/      # JWT auth preHandler
│   │   ├── validation/     # Zod schemas
│   │   ├── utils/          # errors, tokens, password, slug
│   │   ├── db/             # schema.js, index.js (WAL), seed.js
│   │   ├── app.js          # Fastify app factory (testable)
│   │   └── server.js       # start the server
│   ├── drizzle/            # generated SQL migrations
│   ├── test/               # Vitest integration tests
│   ├── drizzle.config.js
│   └── .env.example
├── cli/                    # Commander-based CLI (`forge`)
│   └── src/
│       ├── commands/       # auth, org, project, task, comment, label
│       ├── lib/            # api client, config manager, output helpers
│       └── index.js        # entrypoint (bin: forge)
├── frontend/               # React + Vite web app
│   └── src/
│       ├── api/            # axios client (auto-refresh) + TanStack Query hooks
│       ├── components/     # shared UI + shadcn-style primitives (ui/)
│       ├── pages/          # route-level components
│       ├── routes/         # TanStack Router file-based routes
│       ├── stores/         # Zustand auth store (access token in memory)
│       └── main.jsx
└── README.md
```

## Prerequisites

- **Node.js ≥ 20** (developed on Node 24). Native `fetch` is used by the CLI.
- npm. No global tools required.

---

## 1. Run the API

```bash
cd api
npm install
cp .env.example .env        # then edit secrets (see below)
npm run db:migrate          # create forge.db and apply migrations
npm run db:seed             # optional: demo user + org + project + tasks
npm run dev                 # start with --watch  (or: npm start)
```

The API listens on `http://0.0.0.0:3000` by default. Health check:

```bash
curl http://127.0.0.1:3000/api/v1/health
# {"status":"ok","uptime":12.3,"timestamp":"2026-08-09T..."}
```

### Hardening (Phase 3)

- **Startup env validation** — `server.js` validates `process.env` with Zod and exits `1`
  with a clear message if a required var is missing (e.g. `JWT_ACCESS_SECRET`). The app
  refuses to boot half-configured.
- **Rate limiting** — the credential routes (`/auth/login`, `/auth/register`, `/auth/refresh`)
  allow **10 requests/minute/IP**; the 11th returns `429` with
  `{ error: { code: "RATE_LIMITED", ... } }`.
- **Request logging** — Pino (built into Fastify): `debug` in development, `info` in
  production, with `req.headers.authorization`, `body.password`, and `body.refreshToken`
  redacted.
- **Global error handler** — every error returns the standard `{ error: { code, message } }`
  shape; unhandled 500s are logged server-side (with stack) and never leak internals to the
  client.

> **Windows note:** the server binds IPv4 (`0.0.0.0`), while `localhost` may resolve to
> IPv6 `::1`. Use `127.0.0.1` (the CLI already defaults to it).

### Environment variables (`api/.env`)

| Var                    | Required        | Default        | Notes                                  |
| ---------------------- | --------------- | -------------- | -------------------------------------- |
| `NODE_ENV`             | no              | `development`  | `production` makes JWT secrets mandatory |
| `PORT`                 | no              | `3000`         |                                        |
| `HOST`                 | no              | `0.0.0.0`      |                                        |
| `DATABASE_URL`         | no              | `./forge.db`   | SQLite file path (relative to `api/`)  |
| `JWT_ACCESS_SECRET`    | **yes** (prod)  | dev fallback   | Generate a long random string          |
| `JWT_REFRESH_SECRET`   | **yes** (prod)  | dev fallback   | Different from the access secret        |
| `JWT_ACCESS_TTL`       | no              | `15m`          | jsonwebtoken duration string           |
| `JWT_REFRESH_TTL_DAYS` | no              | `30`           |                                        |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Useful API scripts

| Script                 | What it does                              |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Start with file watching                  |
| `npm start`            | Start the server                          |
| `npm run db:generate`  | Generate a migration from `schema.js`     |
| `npm run db:migrate`   | Apply pending migrations                  |
| `npm run db:seed`      | Insert demo data (idempotent)             |
| `npm test`             | Run the Vitest integration suite          |

---

## 2. Install the CLI

```bash
cd cli
npm install
npm link            # exposes `forge` globally (or: npm install -g .)
```

Now `forge` is on your PATH. Point it at a non-default API with
`FORGE_API_URL=http://host:port` (otherwise `http://127.0.0.1:3000`).
Config — API URL, tokens, and your active org/project — lives in `~/.forge/config.json`.

Prefer not to link globally? Run it directly: `node cli/src/index.js <command>`.

---

## 3. Run the frontend

```bash
# Terminal 1 — the API must be running (see step 1)
cd api && npm run dev

# Terminal 2 — the web app
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Open <http://localhost:5173>. With the seed data you can log in as
`demo@forge.dev` / `password123`, or register a new account.

**What you can do in the UI:** register / log in, create organizations, invite members and
change roles, create projects, create/filter/search tasks, drag tasks between kanban
columns (List and Board views), open a task slide-over to edit fields inline, manage labels
(color picker), and add/delete comments.

### Vite dev proxy

`vite.config.js` proxies `/api` → `http://127.0.0.1:3000`, so the browser talks to the API
same-origin — **no CORS**, and the httpOnly refresh cookie is first-party:

```js
server: {
  proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true } },
}
```

To point at a non-proxied API, change the `target`.

### Token handling & the cookie change

- The **access token** lives only in memory (a Zustand store) — never `localStorage`.
- The **refresh token** is an **httpOnly cookie**. As part of this phase, `POST /auth/login`,
  `/auth/register`, and `/auth/refresh` now **set** a `refreshToken` cookie
  (`httpOnly`, `sameSite=lax`, `secure` in production, scoped to `/api/v1/auth`), and
  `/auth/logout` **clears** it. `/auth/refresh` accepts the token from either the cookie
  (web) **or** the request body (CLI), so both clients keep working.
- Axios interceptor: on `401` it attempts **one** silent refresh (via the cookie), retries the
  original request, and on a second failure clears the session and redirects to `/login`.
  On app start a silent refresh restores the session across reloads.

Build for production with `npm run build` (outputs to `frontend/dist`).

---

## 4. End-to-end walkthrough

Users are created through the API (`POST /api/v1/auth/register`) — matching the spec, the
CLI has no `register` command. After seeding you can log in as `demo@forge.dev` /
`password123`, or register a new user:

```bash
curl -X POST http://127.0.0.1:3000/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"password123","name":"You"}'
```

Then drive everything from the CLI:

```bash
forge auth login                 # prompts for email + password (or -e / -p)
forge auth whoami

forge org create "Acme Inc"      # creates + sets active org
forge org list
forge org use "Acme Inc"         # re-select an existing org (e.g. new machine)

forge project create "Website" -d "Marketing site"
forge project list
forge project use "Website"      # set the active project

# Members (OWNER/ADMIN manage; invitees must already have an account)
forge org invite bob@example.com
forge org members
forge org role bob@example.com ADMIN
forge org remove bob@example.com

# Labels
forge label create bug "#FF5733"     # color defaults to #6366f1 if omitted
forge label list

# Tasks
forge task add "Build login page" --priority HIGH
forge task list                  # table of tasks in the active project
forge task list --status TODO
forge task list --assignee me
forge task list --label bug --search login   # filters AND together
forge task list --limit 20 --page 2          # paginated

forge task view <id>             # <id> may be a short prefix (e.g. 46125f5c); shows labels
forge task update <id> --status IN_REVIEW
forge task assign <id> you@example.com   # or `me`, or `none` to unassign
forge task label <id> bug        # attach / detach a label by name
forge task unlabel <id> bug
forge task done <id>
forge task delete <id>

# Comments
forge comment add <id>           # prompts for the body (or --body "...")
forge comment list <id>
forge comment delete <commentId>

forge auth logout
```

Every command accepts `--json` for machine-readable output (spinners are suppressed).
Paginated lists return `{ data, meta }`, so:

```bash
forge task list --json | jq '.data[].title'
```

Interactive commands (`task add`, `task update`) prompt for priority/assignee when run in a
TTY; pass flags to run non-interactively (great for scripts and CI).

---

## API reference (implemented)

All routes are under `/api/v1`. Every route except `/auth/*` and `/health` requires
`Authorization: Bearer <accessToken>`. Errors always have the shape
`{ "error": { "code", "message" } }`.

### System
| Method | Path      | Notes                                                     |
| ------ | --------- | --------------------------------------------------------- |
| GET    | `/health` | no auth → `{ status, uptime, timestamp }` (for healthchecks) |

### Auth
| Method | Path             | Body / notes                          |
| ------ | ---------------- | ------------------------------------- |
| POST   | `/auth/register` | `{ email, password, name }` (rate-limited) |
| POST   | `/auth/login`    | `{ email, password }` → `{ user, accessToken, refreshToken }` (+ sets refresh cookie, rate-limited) |
| POST   | `/auth/refresh`  | body `{ refreshToken }` **or** cookie → rotates (rate-limited) |
| POST   | `/auth/logout`   | revokes token, clears cookie          |
| GET    | `/auth/me`       | — (current user)                      |

### Organizations
| Method | Path     | Notes                          |
| ------ | -------- | ------------------------------ |
| POST   | `/orgs`  | creator becomes `OWNER`        |
| GET    | `/orgs`  | orgs you belong to, with role  |

### Members (OWNER/ADMIN to mutate)
| Method | Path                             | Notes                                         |
| ------ | -------------------------------- | --------------------------------------------- |
| POST   | `/orgs/:orgId/members`           | `{ email }` — invite an existing user as MEMBER |
| GET    | `/orgs/:orgId/members`           | paginated                                     |
| PATCH  | `/orgs/:orgId/members/:userId`   | `{ role }` — blocked if it would drop the last OWNER |
| DELETE | `/orgs/:orgId/members/:userId`   | blocked if it would remove the last OWNER     |

### Projects
| Method | Path                     |
| ------ | ------------------------ |
| POST   | `/orgs/:orgId/projects`  |
| GET    | `/orgs/:orgId/projects`  |
| GET    | `/projects/:projectId`   |
| PATCH  | `/projects/:projectId`   |
| DELETE | `/projects/:projectId`   (OWNER/ADMIN only) |

### Tasks
| Method | Path                            | Notes                                                       |
| ------ | ------------------------------- | ----------------------------------------------------------- |
| POST   | `/projects/:projectId/tasks`    |                                                             |
| GET    | `/projects/:projectId/tasks`    | paginated; filters: `?status=&priority=&assignee=&label=&search=` (AND) |
| GET    | `/tasks/:taskId`                | includes attached `labels`                                  |
| PATCH  | `/tasks/:taskId`                |                                                             |
| PATCH  | `/tasks/:taskId/assign`         | `{ email }` or `{ assigneeId: null }`                       |
| DELETE | `/tasks/:taskId`                |                                                             |

`?assignee=me` resolves to the caller server-side.

### Comments
| Method | Path                        | Notes                                       |
| ------ | --------------------------- | ------------------------------------------- |
| POST   | `/tasks/:taskId/comments`   | `{ body }`                                  |
| GET    | `/tasks/:taskId/comments`   | paginated, newest first                     |
| DELETE | `/comments/:commentId`      | author or org OWNER/ADMIN only              |

### Labels
| Method | Path                               | Notes                                    |
| ------ | ---------------------------------- | ---------------------------------------- |
| POST   | `/projects/:projectId/labels`      | `{ name, color? }` — name unique per project |
| GET    | `/projects/:projectId/labels`      |                                          |
| DELETE | `/labels/:labelId`                 | OWNER/ADMIN only; cascades join rows     |
| POST   | `/tasks/:taskId/labels/:labelId`   | attach (no-op if already attached)       |
| DELETE | `/tasks/:taskId/labels/:labelId`   | detach                                   |

### Pagination
List endpoints for **tasks**, **comments**, and **members** accept `?page=1&limit=20`
(default `page=1`, `limit=20`, max `limit=100`) and respond with:

```json
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 47, "totalPages": 3 } }
```

### Permissions
- You can only touch resources in orgs you're a member of (enforced at the service layer).
- Only `OWNER`/`ADMIN` can delete a project, manage members, or delete a label.
- Any member can create/update/delete tasks, comments, and labels in their org's projects.
- Comment deletion is restricted to the author or an org OWNER/ADMIN.
- An org can never drop to zero OWNERs (last-owner demotion/removal is blocked).

---

## Testing

```bash
cd api
npm test
```

Integration tests (66 across 7 files) run against Fastify's `app.inject()` with a
throwaway SQLite file per test file (migrations applied programmatically). Coverage:

- **auth** — register/login/refresh rotation/logout, the auth guard, `/auth/me`
- **tasks** — full lifecycle plus cross-tenant isolation
- **members** — invite, role change, last-owner protection, permission checks
- **comments** — create/list/delete with author-or-admin permission enforcement
- **labels** — create, attach/detach, cross-project guard, delete cascade
- **filtering** — status / priority / assignee=me / label / search, and pagination meta
- **hardening** — env validation (incl. a spawned server exiting 1 without a JWT secret),
  the health endpoint shape, and rate limiting (11th request → 429)

---

## Design notes

- **better-sqlite3 is synchronous**, but Drizzle's query builders are awaitable, so the
  codebase uses `async/await` uniformly (handlers, services, tests).
- **WAL mode** and `foreign_keys = ON` are enabled on startup (`api/src/db/index.js`).
- **Refresh tokens** are opaque random strings; only their SHA-256 hash is stored. Refresh
  rotates (old token revoked) and logout revokes — both backed by the `refresh_tokens` table.
- **Pagination** is uniform across list endpoints via `api/src/utils/pagination.js`; `limit`
  is clamped to 100.
- **Label deletes** rely on the schema's `ON DELETE CASCADE` (with `foreign_keys = ON`) to
  clean up `task_labels` join rows automatically.
- **Web token model** — access token in memory (Zustand), refresh token in an httpOnly
  cookie; the API sets it on login/register/refresh and clears it on logout, while still
  returning body tokens so the CLI is unaffected.

## Status

All three layers from the original brief are implemented: **API**, **CLI**, and **web
frontend** — plus the Phase 3 hardening (env validation, rate limiting, structured logging,
health endpoint, global error handler). No new environment variables were introduced;
`.env.example` remains the source of truth.

Possible next steps: real-time updates (websockets), file attachments, and code-splitting
the frontend bundle.
