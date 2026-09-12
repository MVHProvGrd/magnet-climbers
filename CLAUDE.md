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
