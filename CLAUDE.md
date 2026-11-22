# Brclio Klarbase — Claude Code Project Instructions

> Read on every session start. These OVERRIDE default behaviour.
> Start sessions in the **Brclio-klarbase** repository. See [AGENTS.md](AGENTS.md) for project ownership and [DEPLOYMENT.md](DEPLOYMENT.md) for Cloudflare production.

---

## 🔴 CRITICAL SAFETY RULES — READ FIRST

1. **Protect live player data.** Production stores encrypted records in the private `BrclioData/Brclio-klarbase-Data` repository. Preserve the data encryption key and keep GitHub credentials in Cloudflare secrets. Run test writes against fixtures. For optional Express/PostgreSQL development use the local Docker Compose database. Never run migrations, destructive SQL or seeds against a live database.
2. **Never `git push --force` or `git reset --hard`** on any branch.
3. **Never push directly to `main`.** Feature branch + PR.
4. **Never add a tile type or rule without a schema decision.** The tile vocabulary and the 7 rules are the game's constitution. A new one means: `rules.js` + solver + tests + every official isle re-verified + art + builder tool + `isles/README.md` — together, priced as such.
5. **Never reimplement `@klar/core` logic.** The game, builder, solver, PR checks, artifact tool and server gate all import `core/src/isle/`. If any of them could disagree about an isle, the product is broken.
6. **Never run contributor-submitted code in CI.** Isle checks only parse JSON. Keep workflows on `pull_request` (not `pull_request_target`), read-only, with no secrets.

---

## What is Klarbase?

A cozy browser puzzle game of floating **isles**: turn-based grid puzzles (stairs, ledges,
crates, ice, plates & gates, levers & bridges, keys & doors, portal arches) played by **Pip**.
Play 56 official isles, community isles merged on GitHub, or isles shared online; build your
own. Every isle is solver-verified. Open source; contributors are credited.

**Production stack.** `@klar/core` supplies the shared rules. The Vite + three.js client and the Pages Functions API run on Cloudflare Free. An internal Durable Object verifies online submissions. A repository-scoped GitHub App writes encrypted files to the private data repository. The optional Express/PostgreSQL implementation is in `@klar/server`.

**Engineering source of truth: [`ENGINEERING.md`](ENGINEERING.md).** Format & rules for
players/contributors/bots: [`isles/README.md`](isles/README.md). Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## 📌 END-OF-SESSION PROTOCOL (every session)

If you changed **rules, the data model, content, infra, or the roadmap**:
1. Update the relevant section of `ENGINEERING.md`.
2. Append a dated entry to its **Session Log** (§13), newest first.

---

## Before implementing anything

1. Read `ENGINEERING.md` for the current state and the decision you're touching.
2. If it changes the rules, read constitution rule 4 above first.
3. Confirm the change keeps client, server and CI on the same `@klar/core` code path.
4. A new table storing user data needs its cascade delete and an `ENGINEERING.md` §8 update.

---

## Rules of the codebase

- **`@klar/core` is pure** — no DOM, no I/O, no three.js. Same result in browser and Node.
- **The server publish gate is the security boundary.** Client checks are UX only.
- **Content hash = identity** (`isleHash`): geometry + theme only. Immutable rows.
- **Official isles** live in `isles/official/<chapter>/<id>.json` (order + chapters: `isles/official/chapters.json`).
  Add or edit → `node tools/author.mjs` (renders `core/src/isle/official.js`, re-solves everything and prints
  the true par/solution) → `npm test` → commit the JSON + `official.js`. Never edit `official.js` by hand.
- **Community isles** live in `isles/community/<author>/<id>.json` and are judged by
  `tools/check-isles.mjs` + `core/src/isle/contrib.js`. Don't loosen a rule to let one isle in.
- **Solutions are earned** (signed in, cleared, or active-play effort). Don't add new places
  that print a route to anonymous players.
- **Playing and building are open to everyone.** Players sign in with GitHub to sync progress, publish online or comment.
- **Art is procedural.** No model, texture or audio files — keep isles a few KB of text.

## Deployment rules

- Merge reviewed changes to `main` in `Brclio/Brclio-klarbase`. Pages and Workers Builds deploy the client/API and verifier from that branch. Use `npm run build:pages` to check the production build locally.
- Verify the deployed revision and JSON from `https://klarbase.brclio.com/api/health`. GitHub OAuth returns to `https://klarbase.brclio.com/api/auth/callback/github`. Keep production app credentials confined to the production project settings.
- For the optional Express backend, keep better-auth pinned to `1.4.22` to match its Prisma schema and keep `isles/` in its Docker build.

## Code style

- Match the terse, banner-commented style of `@klar/core`. Comment the non-obvious (rules, solver budgets, why a check exists), not the syntax.
- Functional, small modules. No speculative abstraction or config knobs nobody asked for.
- **Surgical changes.** Every changed line traces to the request. Mention dead code; don't silently delete it.

## Commands

```bash
npm test                         # isle engine + official isles + contribution rules + legacy engine
node tools/check-isles.mjs       # the community-isle PR gate (or pass one file path)
node tools/author.mjs            # render isles/official/ -> core/src/isle/official.js, verify official isles
npm run dev:client               # play + build at :5173 (no server needed)
npm run dev:server               # API at :3000 (needs .env + docker compose up db -d)
npm run check                    # syntax sanity
npm run build:pages              # validate the Brclio production API and build the client
```

## Token discipline

- Read narrowly: grep, then read the span you need. Core files are small; `world.js`/`main.js` are not.
- Don't re-read files you just edited. Preserve code, commands, errors and numbers exactly; compress prose.
- State assumptions and stop when confused, especially around rules and solution gating.

## Working agreement

- Feature branches → PR → green CI (`engine`, `isles`, `sanity`) → merge.
- Update `ENGINEERING.md` at session end if anything structural changed.
- Use Plan Mode before new features, significant design tradeoffs, and bugs that survive the first attempted fix.
