# Claude handoff: scenery and material art

## Current direction

The real inspiration is the flexible, translucent magnet people on Michael's fridge.
The magnets are in their hands and feet. Bodies can land flat, stand out from the
door on their feet, hang from hands, twist into mixed grips, or swing from one tip.
Keep the gameplay camera frontal. Depth is suggested through curved limbs,
foreshortening, and shadows cast down/right by a window above/left.

Reference folder: `C:/Users/micha/OneDrive/Desktop/Magnet Climbers`.
The four `11_02_*.jpg` photos are the physical reference; the three `11_02_*.png`
files show earlier game versions. The ten earlier PNGs are artwork and branding.
Do not add the personal photos to the shipped game.

## Implemented by Codex

- `src/game/magnetism.ts`: four shared tip positions, legal steel contact search,
  direction/spin-based landing grips, and a damped single-contact pendulum.
- `src/game/types.ts`: optional `grip` with world-space contact positions, limb IDs,
  pose, apparent depth, age and angular velocity. Limb IDs: 0/1 hands, 2/3 feet.
- `src/game/world.ts`: `nearestMetal()` returns an actual steel point. Glass,
  stickers, plastic, gaps and the seam remain nonstick; metal islands work.
- `src/game/game.ts`: tip-based catches, gentle attraction near steel edges after
  the ascent, contact release, deterministic launch spin/extra-climber velocity,
  legacy snapshot migration, deep-copying grips and saved staggered SYNC launches.
- `src/game/climber-render.ts`: flexible tube limbs, metallic caps, plastic highlights,
  contact flashes and body-shaped directional shadows. Rendering uses the solver's
  fixed magnetic tips. Keep this module under Codex's physics/character ownership.
- `src/game/menu-background.ts`: shared fridge artwork with drifting framing and
  falling procedural toys. Reduced-motion preference freezes this background.
- `src/game/ui.ts` / `src/style.css`: shared title wordmark and translucent menu.
- `index.html` / `vite.config.ts`: shared orange toy icon for favicon, Apple touch
  icon and PWA manifest. Art is included in the offline cache.
- `tests/magnetism.test.ts`: regression checks, run using `npm test`.
- `tests/visual.mjs`: optional Canvas preview using an isolated QA dependency.
  Previews: `artifacts/magnetism-poses.png` and `artifacts/magnetism-game.png`.

This is a constrained 2.5D prototype, not a full ragdoll. Multiple contacts brace
the landing pose; a single contact swings. Depth is visual and does not change
the ballistic arc. Automatic teammate grabbing is still disabled. Existing CLIMB
links retain their earlier center-to-center logic; limb-to-limb team physics and
progressive second-grip settling are future physics work, not completed features.

## Your task: make the fridge match the toys

Own the environment/material pass. Build `src/game/scenery.ts` and place any new
environment assets in `public/art/scenery/`. Integrate through small, explicit
calls in `render.ts`, preserving its HUD, aim preview and character calls.

1. Improve the brushed steel. Current repeated streaks are too conspicuous. Use
   subtle grain, broad window illumination from upper left, and restrained warm/cool
   reflections. Cache textures; do not regenerate grain every animation frame.
2. Give glass, plastic trim, paper and stickers distinct materials that remain
   immediately readable at the 400px logical width. Use domestic fridge objects:
   colorful souvenir magnets, doodles, notes, handles and photo-like illustrations.
3. Style existing repel panels and bumpers to belong on that fridge. Preserve the
   red N cue and every collider's exact position and size. Art must not imply a
   usable foothold where the solver says glass or a gap.
4. Keep decoration sparse around landing edges. Shadows travel down/right to match
   the characters. Do not add baked climbers or baked character shadows to terrain.
5. Use the installed image-generation skill for new raster art if available. User
   supplied art is already integrated; do not replace the chosen wordmark/icon or
   rebuild the title page as part of this scenery task. New assets should be
   web-sized, portable, and copied into the repo before being referenced.

Do not change `magnetism.ts`, `climber-render.ts`, `game.ts`, `types.ts`, tuning,
input rules, world generation or collision geometry. Report any physics concern
in your handoff. Do not add accounts, monetization or multiplayer to this pass.
Keep local work reviewable; publishing the combined pass is a separate action.

## Assets already selected

| Shipped file | User source |
| --- | --- |
| `public/art/title-logo.png` | `Codex Image Sep 12, 2026, 10_58_41 PM.png` |
| `public/art/title-fridge.png` | `Codex Image Sep 12, 2026, 10_57_46 PM.png` |
| `public/icons/toy-icon.png` | `Codex Image Sep 12, 2026, 10_59_09 PM.png` |

These are unchanged copies. No new AI images were generated in this pass.
The original rounded icon is declared `purpose: any`, not maskable. A future
maskable variant needs extra safe-area padding, not merely a manifest relabel.

## Acceptance checks

- `npm test` and `npm run build` pass.
- Both modes still function without `VITE_LEADERBOARD_URL`.
- Check a phone-sized viewport, portrait rotation, title-menu scrolling, starting
  both modes, returning to the menu, reduced motion and offline reload.
- Inspect 1-hand, feet, mixed and flat poses against the updated surfaces.
- Keep the mobile frame budget in view; cache expensive static material work.
- Check Workbox's build summary includes all new assets with no size exclusions.
- Give Michael before/after screenshots plus a list of changed files.

Codex verified the simulation tests, the production build/offline asset list and
native Canvas render artifacts. The browser connector was unavailable; live UI,
installed-icon appearance and real-phone feel still need manual verification.

There was already an untracked `worker/package-lock.json` when work began. It
belongs to the user; do not remove or fold it into an unrelated change.
