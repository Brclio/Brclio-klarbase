---
name: daily-isle
description: Designs the next Klarbase Daily Isle (decision K10) — reads the project history, rules and past dailies, writes a brief (weekday tier, a catch type not used lately), has the isle-smith agent design and prove one isle, playtests it locally, and opens a PR adding isles/daily/YYYY-MM-DD.json. Use when a maintainer requests "/daily-isle", "make tomorrow's daily", or from a scheduled task. Optional argument: a date (YYYY-MM-DD) or "next".
---

# Daily Isle

Runs **locally** in `Brclio/Brclio-klarbase`. One isle per run. Open a PR adding
`isles/daily/<date>.json` to this repository. A Brclio maintainer reviews it; a merged file wins its day for everyone.

## 1. Which date
Argument date, else the first UTC date from tomorrow on with no `isles/daily/<date>.json`
**and** no open PR titled `daily: <date>` (`gh pr list --search "daily:" --state open`).

## 2. Context (read, don't skim)
- `ENGINEERING.md` §13 (session log, newest first) — what changed lately; new mechanics deserve dailies.
- `docs/proposals/depth-and-weight.md` §0 — the decisions (K1–K10).
- Every file in `isles/daily/` — names, tiers, `catch` texts (the catch types already used).
- The Brclio deployment uses each isle’s declared tier or solver estimate. Use the local solver audit and recent daily files as the evidence for the brief.

## 3. The brief
- **Tier rotation** by weekday of the target date (UTC): Mon easy · Tue tricky · Wed hard ·
  Thu tricky · Fri hard · Sat fiendish · Sun tricky.
- **Catch type:** one not used in the last 7 dailies. Catalogue (grow it when mechanics land):
  push order · spend a crate (sink/fill) · crate holds a plate · lever flip with a crate kept on a
  bridge · crate blocks an arch · ice stops · key/door counting · start the wrong way ·
  counterweight on scales · scales across storeys · gateway loop.
  Prefer the newest mechanic in §13 if no daily has used it yet.
- **Theme:** not the same as the previous day's daily.

## 4. Design
Give `isle-smith` the date, tier, catch type, theme, any contributor credit supplied for this isle, and a 3-line summary of the last 7 dailies (name, tier, catch). Read its report. Then check it yourself:
```bash
node tools/isle-lab.mjs isles/daily/<date>.json --must <each catch part> --routes 6
node tools/check-isles.mjs isles/daily/<date>.json
```
Reject and send it back (once, with the reason) if: gate fails, any `--must` isn't PROVEN,
nearest isle ≥ 60%, greedy wins at tricky+, or the audit tier is 2+ below the brief.

## 5. Playtest (local)
Run `npm run dev:client`, then open
`http://localhost:5173/daily/<date>` (dev-only route). Take a screenshot at the start, drive the
solution with arrow keys (U/D/L/R = ArrowUp/Down/Left/Right, X = Space, ~700 ms apart), and
confirm "cleared" at par. Look at the screenshot like a player: is the goal visible, is the catch
readable, does anything render wrong? Fix and re-run §4 if not.

## 6. PR
```bash
git checkout -b daily/<date> origin/main
git add isles/daily/<date>.json
git commit -m "daily: <date> — <name> (<tier>)"
git push -u origin daily/<date>
gh pr create --title "daily: <date> — <name>" --body "<brief, lab report, self-critique, screenshot note>"
```
The PR body must **not** print the solution or the catch above the fold — put them in a
`<details>` block (the repo is public; players read PRs).

## Never
Push to `main`, merge the PR, edit any file except `isles/daily/<date>.json`, add tiles or rules,
or post anything outside GitHub.
