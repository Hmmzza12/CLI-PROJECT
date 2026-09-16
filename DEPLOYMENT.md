# Deploying Forge

Forge deploys to **Netlify**: the built React app is served from Netlify's CDN, and the
REST API runs as a single **serverless function** that wraps the existing Fastify app. Data
lives in **Turso** (libSQL).

The full, current walkthrough — Turso setup, environment variables, build behaviour, and a
post-deploy smoke test — lives in the README:

➡️ **[README → Deploy to Netlify](README.md#deploy-to-netlify-production)**

Key files:

- [`netlify.toml`](netlify.toml) — build command, `/api/*` → function redirect, SPA fallback
- [`netlify/functions/api.js`](netlify/functions/api.js) — the catch-all function
  (`@fastify/aws-lambda` around `buildApp()`)

> **Note:** the previous Render setup (`render.yaml`) has been removed. Render is no longer
> used.
