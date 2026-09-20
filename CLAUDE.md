# Magnet Climbers — working notes for Claude

Endless fridge climber PWA. Canvas 2D, hand-rolled physics, DOM menus. Vite + TypeScript, no framework.
Live at https://magnetclimbers.com (GitHub Pages, deployed from `main` by `.github/workflows/pages.yml`).
Scoreboard API: Cloudflare Worker + D1 in `worker/` (see `worker/README.md`).

## Commands
- `npm install` then `npm run dev -- --host` (port 5180) for phone testing on LAN.
- `npm run build` runs `tsc --noEmit` first; keep it clean.
- Playtest headless: Playwright against `npx vite preview`; `window.__mc.game()` exposes the live Game for scripted checks.

## Layout
- `src/game/config.ts` all tuning numbers and the upgrade/skin tables. Change feel here first.
- `src/game/game.ts` run state, physics, slingshot, chains, camera, wall.
- `src/game/world.ts` seeded segment generator. Keep it deterministic (only use `this.rng`).
- `src/game/render.ts` canvas renderer + HUD; `hudButtons()` and `teamDots()` define tappable screen rects.
- `src/game/ui.ts` DOM panels. `src/main.ts` wires it all, owns the save, input routing, run lifecycle.
- `DESIGN.md` mechanics, F2P plan, competitive/ghost plan. `ROADMAP.md` ordered backlog.

## Rules
- Determinism matters: fixed 120 Hz step, seeded RNG only, no `Math.random()` in anything that affects the sim (particles are fine).
- Everything must work with no backend (`VITE_LEADERBOARD_URL` unset).
- Portrait phone first. Logical width is 400; height scales.
- Push straight to `main`; Pages deploys it. No PRs needed unless asked.

## Docs and handoffs (keep the hot files small)
- `ART_REFRESH_HANDOFF.md` is the Claude ↔ Codex mailbox: live sections only, newest on top, under ~8 KB. Retire superseded sections VERBATIM into `art/HANDOFF_LOG.md` in the same commit. Per-pack prompts/QC live in `art/archive/<pack>/HANDOFF.md`. Art MASTERS (every binary) live in the sibling repo `MVHProvGrd/magnet-art` at `C:\Users\micha\magnet-art`; this repo gitignores them and the install scripts take `ART_ARCHIVE=../magnet-art`.
- Dated feature-pass write-ups go in `docs/handoffs/YYYY-MM-DD-topic.md`, not the repo root. `DESIGN.md`, `ROADMAP.md`, `CREW_DESIGN.md` stay at root.
- Don't paste file contents or long status into chat or into this file; point at the file. This file is auto-loaded every turn — keep it to commands, layout, rules.

## Gates
- A Stop hook (`.claude/hooks/quiet-gates.sh`) runs `npm run typecheck` and `npm test` whenever the tree is dirty or unpushed and says nothing when they pass. If it prints, fix that before anything else. You don't need to run them by hand.

