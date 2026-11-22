# Brclio Klarbase — Deployment

## Brclio production

[`klarbase.brclio.com`](https://klarbase.brclio.com) is hosted on Cloudflare Pages in project `brclio-klarbase`. The Pages GitHub integration builds and deploys every update to `main` in `Brclio/Brclio-klarbase`. Changes reach production by merging a pull request. Pages preview builds are disabled. The project maintainer is 黄家宝 (AI悦创, [@AndersonHJB](https://github.com/AndersonHJB)).

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

## DNS and support

The custom hostname is attached to the `brclio-klarbase` Pages project. The `brclio.com` zone points the proxied `klarbase` CNAME to `brclio-klarbase.pages.dev`. Check both the Pages custom-domain status and the zone record when investigating a hostname change.

Open a public deployment issue in the Brclio code repository. Send reports involving credentials or player data through the private contact in the security policy. [Brclio issues](https://github.com/Brclio/Brclio-klarbase/issues) · [Security policy](SECURITY.md)

The optional Express/PostgreSQL service under `server/` can be run locally with Docker Compose and `.env.example`. For the production release, use the Cloudflare build and bindings above.
