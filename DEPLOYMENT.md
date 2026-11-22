# Klarbase — Deployment Runbook

## Brclio production

[`klarbase.brclio.com`](https://klarbase.brclio.com) is hosted on Cloudflare Pages in project `brclio-klarbase`. The Pages GitHub integration builds and deploys every update to `main` in `Brclio/Brclio-klarbase`. Changes reach production by merging a pull request. Pages preview builds are disabled.

| Pages setting | Value |
| --- | --- |
| Root directory | Repository root |
| Build command | `npm ci --no-audit --no-fund && npm run build:pages` |
| Build output directory | `client/dist` |
| Production build variables | `NODE_VERSION=22`, `SKIP_DEPENDENCY_INSTALL=true`, `VITE_GITHUB_DEPLOYMENT=true` |
| Custom domain | `klarbase.brclio.com` in the `brclio.com` zone |

### Online services

Pages Functions handle GitHub sign-in, cloud saves, comments and public isle sharing. The GitHub OAuth App only signs players in. Its callback is `https://klarbase.brclio.com/api/auth/callback/github`. A separate GitHub App installed on [`BrclioData/Brclio-klarbase-Data`](https://github.com/BrclioData/Brclio-klarbase-Data) handles storage with repository-scoped Contents write access. Keep that repository private.

| Pages runtime variable | Setting |
| --- | --- |
| `AUTH_ORIGIN` | `https://klarbase.brclio.com` |
| `AUTH_GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `AUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth App secret, encrypted variable |
| `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID` | Storage app and its installation |
| `GITHUB_APP_PRIVATE_KEY` | Storage app PEM, encrypted variable |
| `GITHUB_DATA_REPOSITORY` | `BrclioData/Brclio-klarbase-Data` |
| `GITHUB_DATA_ENCRYPTION_KEY` | Base64 of 32 random bytes, encrypted variable. Back up this key to preserve readability. |
| `ISLE_VERIFIER` | Durable Object binding for `KlarbaseVerifier` in `brclio-klarbase-verifier` |

The private repository holds encrypted records under `data/`. Profiles and hashed sessions use separate files under `users/<prefix>/<id>/`. Saves have independent progress, Daily and Atlas files. Shared isles, comments, reports and per-isle feed entries each have their own records. Writes use a non-force Git commit and retry concurrent branch updates. Git history retains encrypted prior records.

The SQLite-backed Durable Object runs the existing solver with its own Cloudflare Free CPU allowance. It stores no data of its own and has no public route. Workers Builds runs from the same repository and production branch. Set the build command to `npm ci --no-audit --no-fund` and the deploy command to `npx --yes wrangler@4.166.0 deploy --config cloudflare/wrangler.toml`. Disable preview builds for both projects.

The Pages build loads the real API entry point and verifier and runs the OAuth, save and encrypted repository tests before building the client. This catches removal of the backend even when Vite could still produce a static site. Keep the existing data encryption key when changing build settings or rotating OAuth credentials.

To verify a release, compare the deployed commit in Pages and Workers Builds. On the custom domain, `GET /api/health` must return JSON containing `"ok":true`, `"storage":"github"` and `"verifier":true`. Check `GET /api/puzzles` to exercise the private repository connection. Open `/play` and `/create`, then sign in to verify cloud save, publishing and comments. Pages and Workers each keep prior deployments for rollback.

## Upstream reference

The original `TanmoyP/klarbase` service at `klarbase.dev` uses Railway (Docker) for the API and built client, Neon Postgres, and Cloudflare DNS and proxy. The rest of this runbook describes that upstream deployment. See [`ENGINEERING.md` §9](ENGINEERING.md#9-infrastructure--deployment).

> **Legend:** 🧑 = a step only you can do (accounts, secrets, DNS, OAuth consoles). 🤖 = a step Claude/CLI can drive for you. Steps that create accounts, enter secrets, or accept terms are always 🧑.

---

## 0. Prerequisites (already true on this machine)

- ✅ `gh` authenticated as **TanmoyP**, `railway` CLI 4.36, Docker 28, Node 24.
- 🧑 Accounts you already have: **Neon**, **Railway**, **Vercel** (unused for now), **Namecheap** (owns `klarbase.dev`).
- 🧑 A **Cloudflare** account (free tier) — recommended for CDN + caching + DDoS. Optional for first deploy; Railway can serve `klarbase.dev` directly, but you lose edge caching of immutable puzzle docs.

---

## 1. GitHub repo 🤖 (done in session)

Private repo `TanmoyP/klarbase` created and pushed. CI (`.github/workflows/ci.yml`) runs the core suite on every push.

---

## 2. Neon Postgres 🧑

1. Neon console → **New Project** → region **Europe (Frankfurt)** → name `klarbase`.
2. Copy **two** connection strings from the dashboard:
   - **Pooled** (host contains `-pooler`) → this becomes `DATABASE_URL`.
   - **Direct** (no `-pooler`) → this becomes `DIRECT_URL` (migrations only).
   - Both must include `?sslmode=require`.
3. *(Optional, recommended later)* create a separate **`klarbase-test`** branch in Neon for a `TEST_DATABASE_URL`, so tests never touch prod. Not needed for first deploy (`@klar/core` tests are zero-DB).

> **Why two URLs:** Prisma runs the app through the pooler (PgBouncer, transaction mode) so many replicas share a small connection budget, but runs **migrations** through the direct connection because DDL over a transaction pooler is unreliable. This is wired via `directUrl` in `server/prisma/schema.prisma`.

---

## 3. OAuth apps 🧑

Klarbase's audience is builders — **GitHub OAuth is the priority**; Google is optional at launch.

**GitHub** (https://github.com/settings/developers → New OAuth App):
- Homepage URL: `https://klarbase.dev`
- Authorization callback URL: `https://klarbase.dev/api/auth/callback/github`
- Copy Client ID + generate a Client Secret.

**Google** (https://console.cloud.google.com/apis/credentials → OAuth client ID → Web application):
- Authorized redirect URI: `https://klarbase.dev/api/auth/callback/google`
- Copy Client ID + Secret.

> ⚠️ The callback origin **must** match `BETTER_AUTH_URL` exactly. Origin mismatch is the #1 first-deploy failure. Register a second callback with your Railway `*.up.railway.app` URL too, so you can test before DNS cuts over.

---

## 4. Railway service 🧑 + 🤖

**Via CLI (from repo root):**

```bash
railway login                 # 🧑 browser auth
railway init                  # 🤖 create project "klarbase"
railway add                   # 🧑 add the Postgres plugin OR skip (we use Neon)
railway up                    # 🤖 build from server/Dockerfile + deploy
```

Or **via dashboard**: New Project → Deploy from GitHub repo → `TanmoyP/klarbase`. Railway detects `railway.json` → builds `server/Dockerfile`.

**Set environment variables** 🧑 (Railway → service → Variables):

```
DATABASE_URL         = <Neon POOLED url, ?sslmode=require>
DIRECT_URL           = <Neon DIRECT url, ?sslmode=require>
BETTER_AUTH_SECRET   = <output of: openssl rand -hex 32>
BETTER_AUTH_URL      = https://klarbase.dev
CLIENT_ORIGIN        = https://klarbase.dev
GITHUB_CLIENT_ID     = <from step 3>
GITHUB_CLIENT_SECRET = <from step 3>
GOOGLE_CLIENT_ID     = <from step 3, optional>
GOOGLE_CLIENT_SECRET = <from step 3, optional>
PORT                 = 3000
VITE_POSTHOG_KEY     = <PostHog EU project key, optional: analytics is off without it>
VITE_IMPRINT_NAME    = <legal name for the Impressum>
VITE_IMPRINT_ADDRESS = <postal address; write \n for line breaks>
VITE_IMPRINT_EMAIL   = <contact email>
```

The container boot command runs `prisma migrate deploy` (idempotent) then serves. First deploy creates the tables.

> **First deploy without DNS:** temporarily set `BETTER_AUTH_URL` and `CLIENT_ORIGIN` to your `https://<app>.up.railway.app` URL and add the matching OAuth callbacks, so you can smoke-test the milestone loop before pointing the domain.

**Scaling knobs** (later, when needed): Railway → service → set **replicas**. ⚠️ Before going past **1 replica**, fix the in-memory rate limiter (ENGINEERING.md §7.4) or move rate limiting to Cloudflare — otherwise limits multiply per replica.

---

## 5. Cloudflare + Namecheap DNS 🧑

**Cloudflare (recommended):**
1. Add site `klarbase.dev` → Cloudflare gives you two nameservers.
2. **Namecheap** → Domain → Nameservers → **Custom DNS** → paste Cloudflare's two nameservers. (Propagation: minutes to a few hours.)
3. In Cloudflare DNS, add a **CNAME** `klarbase.dev` → your Railway domain (`<app>.up.railway.app`), proxied (orange cloud). Add `www` → `klarbase.dev` if you want it.
4. In Railway → service → **Settings → Networking → Custom Domain** → add `klarbase.dev`. Railway issues the cert; Cloudflare set to **Full (strict)** SSL.
5. **Cache rule** for immutable puzzle docs — Cloudflare → Rules → add: for `klarbase.dev/api/puzzles/*` cache eligible + respect origin `Cache-Control`. The app should send `Cache-Control: public, max-age=31536000, immutable` on content-addressed GETs (small server change — see ENGINEERING.md §7.2; add when read traffic grows).

**Without Cloudflare (fastest path):** in Namecheap, use Railway's custom-domain instructions directly (CNAME on `www`, or an ALIAS/ANAME at the apex if the DNS host supports it). You lose edge caching but the site works. You can add Cloudflare later without redeploying.

---

## 6. Post-deploy verification ✅

```bash
curl https://klarbase.dev/api/health          # → {"ok":true}
```

Then the **milestone loop** by hand (this is the real acceptance test — see ENGINEERING.md §5.2):

1. Sign in with GitHub on `klarbase.dev`.
2. Build a puzzle → **Publish** → confirm you get a `/i/:hash` link.
3. Open that link in an **incognito window / second account** → it plays to the win.
4. Claim `(0,0)` → place the puzzle → enter **World** and walk it → see it on the **Map**.

When that works for a second account, Phase 2's core is live.

---

## 7. Rollback & ops

- **Rollback:** Railway keeps prior deploys — redeploy a previous build from the dashboard. Content is immutable and migrations are additive, so rollbacks are safe.
- **Logs:** `railway logs` or the dashboard. Watch the first boot for `prisma migrate deploy` output.
- **DB backups:** Neon does point-in-time restore on its branch history — no cron backup job needed.
- **No cron anywhere.** The product has no scheduled jobs (ENGINEERING.md §7.3). If Phase 3 "world bloom" ever needs aggregation, add it as a Railway service/job, not a GitHub Action.
