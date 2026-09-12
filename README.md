# Magnet Climbers

Endless vertical climber. You fling a team of rubbery magnet people (the ones on
the fridge) up a stainless-steel fridge that never ends. Magnets only stick to
steel, so glass panels, plastic trim, stickers and gaps have to be crossed by
flinging over them or by chaining teammates into a ladder.

Built as a PWA first (installable, offline). The renderer is plain Canvas 2D and
the menus are plain DOM, so the same bundle drops into a Capacitor WebView for
Android and iOS without changes.

Live: https://magnetclimbers.com (deployed from `main` by the Pages workflow).

## Run

```sh
npm install
npm run dev        # http://localhost:5180
npm run build      # dist/ — static, relative paths, service worker + manifest
npm run preview
```

Best played on a phone or in a mobile-emulation viewport (portrait).

## Controls

- Drag back from anywhere and release to fling the selected climber (dashed ring).
- Tap an anchored climber to select it. Default selection is the lowest free one (leap-frog).
- A flying climber sticks to steel once it has passed its apex (stronger magnets catch earlier).
- A flying climber falling within arm reach of an anchored teammate grabs on and hangs there. Chains have a max depth (Chain length upgrade).
- Launching a climber that others are hanging on drops them; they re-grab a neighbour if one is in reach.
- The red danger line rises faster the higher you go. Anything below it is lost. Lose everyone and the run ends.

## Layout

```
src/main.ts           bootstrap, loop, input, save integration, revive flow
src/game/config.ts    tuning numbers, upgrade table, derived stats
src/game/types.ts     shared types
src/game/world.ts     seeded procedural segments (bands, windows, pillars, stickers, repel panels, bumpers, power-ups)
src/game/game.ts      run state: climbers, physics, slingshot, chains, camera, floor, collectables
src/game/render.ts    canvas renderer (brushed steel, zones, climbers, HUD)
src/game/ui.ts        DOM panels: menu, shop, pause, game over, ad placeholder
src/game/save.ts      localStorage save (coins, gems, upgrades, records)
src/game/audio.ts     tiny WebAudio synth for feedback
```

## Native plan (Android / iOS)

1. `npm i -D @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios`, `npx cap init`, point `webDir` at `dist`.
2. `npx cap add android` / `npx cap add ios`, then `npm run build && npx cap sync`.
3. Swap the placeholders behind clean seams:
   - `Ui.showAdPlaceholder` → AdMob rewarded video (`@capacitor-community/admob`).
   - `save.ts` → cloud save behind an account (see DESIGN.md); local stays as offline cache.
   - Gems purchase → StoreKit / Play Billing via `@capgo/capacitor-purchases` or RevenueCat.
4. Add a release workflow that builds the Capacitor project (the imageweaver-workbench repo has a Build Release AAB workflow to crib from).

## Scoreboard

Global highest-climb board, per mode (crew / solo). Backend is a Cloudflare Worker + D1 in `worker/`; setup steps in `worker/README.md`. Without `VITE_LEADERBOARD_URL` the game still runs and shows local bests only.

See `DESIGN.md` for mechanics, economy, and the F2P research.
