# Deploying Forge (free)

One **Render** free web service runs the API **and** serves the built web app from the
same origin (so there's no CORS and the httpOnly login cookie just works). Data lives in a
free **Turso** (libSQL) database so it survives redeploys.

```
Browser ──▶ Render web service ──┬─▶  Fastify API  ──▶  Turso (libSQL)
                                 └─▶  built React app (static)
```

You'll need (all free, no card required for the free tiers):

- This repo on GitHub — ✅ already pushed
- A [Render](https://render.com) account
- A [Turso](https://turso.tech) account

---

## 1. Create the Turso database

**Web dashboard (easiest):** at <https://app.turso.tech> → **Create Database** → name it
`forge`. Then open it and copy:

- the **Database URL** — looks like `libsql://forge-<you>.turso.io`
- a **token** — create one under the database's tokens/credentials

**Or with the CLI:**

```bash
turso db create forge
turso db show forge --url            # -> TURSO_DATABASE_URL
turso db tokens create forge         # -> TURSO_AUTH_TOKEN
```

Keep the URL and token handy for step 3. (No need to create tables — the app runs its
migrations automatically on boot.)

---

## 2. Deploy on Render (Blueprint)

The repo ships a `render.yaml`, so Render can configure everything for you:

1. Go to <https://dashboard.render.com> → **New** → **Blueprint**.
2. Connect your GitHub and pick **`Hmmzza12/CLI-PROJECT`**.
3. Render reads `render.yaml` and proposes one free web service named **forge**. Approve it.
4. It will ask for the two values marked "sync: false" — paste them from step 1:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
5. Click **Apply**. Render builds the frontend, installs the API, and starts it.
   (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are generated for you.)

First build takes a few minutes. When it's live you'll get a URL like
`https://forge-xxxx.onrender.com`.

### Prefer to click through manually?

**New → Web Service** → connect the repo, then set:

| Field | Value |
| --- | --- |
| Runtime | Node |
| Build command | `cd frontend && npm install --include=dev && npm run build && cd ../api && npm install` |
| Start command | `cd api && node src/server.js` |
| Health check path | `/api/v1/health` |
| Plan | Free |

Environment variables:

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `JWT_ACCESS_SECRET` | a long random string |
| `JWT_REFRESH_SECRET` | a different long random string |
| `SEED_ON_START` | `true` |
| `TURSO_DATABASE_URL` | from step 1 |
| `TURSO_AUTH_TOKEN` | from step 1 |

---

## 3. Try it

Open the Render URL and log in with the seeded demo account:

```
demo@forge.dev  /  password123
```

…or click **Register** to make your own account. The demo org **Acme Inc → Website
Redesign** comes preloaded with tasks so the board isn't empty.

---

## How it works / notes

- **Migrations + seed run on boot** (`api/src/server.js`). Migrations are idempotent; the
  seed only inserts demo data if it isn't already there. Turn seeding off by setting
  `SEED_ON_START=false`.
- **Driver switch is automatic**: with `TURSO_DATABASE_URL` set the app uses libSQL/Turso;
  without it, a local `better-sqlite3` file (dev + tests). No code changes needed — every
  query is written with `await`, so both drivers work.
- **Free-tier cold starts**: Render free services sleep after ~15 min idle; the first
  request after that takes ~30–60s to wake. Data is safe in Turso regardless.
- **Secrets** are never committed — `.env` is gitignored and Render generates the JWT
  secrets. Rotate them anytime in the Render dashboard.
- **CLI still works** against the deployed API: `FORGE_API_URL=https://forge-xxxx.onrender.com forge auth login`.
