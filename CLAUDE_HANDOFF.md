# Claude handoff: scenery and material art

## Shipped feature pass — September 13, 2026

This section supersedes the older updates below. Codex finished the implementation and merged Claude's `3ba22ce` (off-screen climber markers, super-magnet swat protection, and leaderboard reposting) and `9bc08d9` (world v3 sticker spacing/variety).

- 51-item Field Guide, including 12 interactive gadgets in snack/travel/doodle themes. New runs use world version 4; old versions, including Claude's already-deployed v3, retain their original terrain.
- Swinging keyring grips, rotating alphabet grips, dangling paper clips, and blue/red polarity plates. Bright grip geometry and collision share one pose function. Red plates release climbers; three-second countdowns warn before switching. Side routes remain bare steel. Hanging chains follow their moving root.
- Three detailed generated alpha sprites in `public/art/gadgets/{snack,travel,doodle}.png`. Created with built-in image generation (not API/CLI generation); final prompts and processing QC are in `artifacts/gadgets/<theme>/prompt-used.txt` and `pipeline-meta.json`. All are 256px with no edge-touch frames. Raw sheets remain local, outside deployment.
- `kid-hand.ts`: three-bone fingers and two-bone thumb, staggered curl on follow-through, shared render/hit geometry. Near-miss bookkeeping is deep-copied in saves.
- `music-score.ts` / `sound-engine.ts`: original 96 BPM toy-box score, danger-dependent percussion, metallic catches, rubber launches, swishes and trick chimes. Separate music/SFX preferences, gesture-only unlock, pause/hidden silencing, capped voices, no background scheduler. Previously muted saves stay muted.
- `tricks.ts`: handstands, one-hand/one-foot saves, mixed catches, crew chains, close calls, capped/expiring combos, style HUD and small coin bonuses. New-height gates prevent repeated landing farming; Chill earns no trick coins. Height leaderboards are unchanged.
- Worker/database deployment already completed: version `67f4c7f7-188b-4f4c-8649-3031470c3381`; live `/stats` returned HTTP 200. This pass needs no additional database migration.

Validation: `npm test`, `npm run build`, and native Canvas visual checks. Deployment workflow now runs tests before building. Updated previews: `artifacts/fridge-field-guide.png`, `kid-hand-swipe.png`, and `gadget-gameplay.png`. Run `node tests/library-visual.mjs`, `node tests/hand-visual.mjs`, and `node tests/gadget-visual.mjs` (optional Canvas dependency setup in `tests/visual.mjs`). Gadget QA verifies alpha, dimensions, non-clipped edges and read-only rendering.

Remaining QA, not unfinished implementation: real-phone feel/performance, audible mix on phone speakers, and installed-PWA refresh/offline checks. No enabled browser was available in this Codex session. Do not replace the title with branded/dispenser artwork. Existing four-door unbranded title and PWA icons are preserved. Optional next tuning: pace gadget sections earlier/later and adjust trick/hand difficulty after playtesting.

## Latest Codex update — September 13, 2026

This section supersedes the historical assignments below.

- `ragdoll.ts`: bounded, independent arm/leg joints driven by flight inertia and drag. Actual moving tips catch steel. Torso keeps its ballistic arc; not a full rigid-body engine.
- `magnetism.ts`: feet-first and handstand bracing, spring-settled upright angles, fixed contacts, single-tip pendulums and mixed/flat landings.
- `items.ts`: 39 stable definitions (20 paper cards, 7 pickups, 6 surfaces, 6 moving magnets). Main menu includes an illustrated Fridge Field Guide.
- `world-patterns.ts`: four layouts with tested 64px continuous steel side lanes. Versioned terrain preserves pre-health and pre-library saves.
- `kid-hand.ts`: connected forearm, detailed fingers/thumb, angled curved reach, warning arc, follow-through and safe recoil. Collision follows the art. Attack state/timing survives saves; no attacks in Chill.
- Title regenerated with built-in image generation: four stainless doors, original low angle, NO manufacturer logo, NO exterior dispenser, NO odd handle. Asset: `public/art/title-fridge.webp`. Prompts: `artifacts/title-fridge.prompt.md`. Existing wordmark and PWA icons retained.
- Claude's health, heart pickup, lift/zigzag bumper mechanics and settings preserved.

Checks before final sync: 20 simulation tests and production/PWA build passed. Canvas previews: `artifacts/ragdoll-flight.png`, `fridge-field-guide.png`, `obstacle-layouts.png`, `kid-hand-swipe.png`. Scripts under `tests/`, optional Canvas dependency described in `tests/visual.mjs`.

Next for Claude: real-phone playtesting and frame-rate/menu-scroll QA; tune swipe dodge feel and upright catch frequency from play. Verify installed-PWA refresh/offline behavior. Do not reintroduce branding or an exterior dispenser in title art. Live browser/phone QA was unavailable to Codex.

## Historical notes

## Update: combined scenery pass integrated by Codex

Michael subsequently requested that Codex also implement and push the in-game art.
Claude's concurrent commit arrived while Codex was finishing. Both passes are now
combined: `src/game/scenery-materials.ts` preserves Claude's material renderer,
steel/window lighting, handles, trim, gaps, glowing N plates, original cards and
alphabet/souvenir magnets. `src/game/scenery.ts` adds 12 cached illustrations and
notes, an alternate glass treatment with shelves, additional glossy/smiley magnets,
repulsion field animation and illustrated pickups. `render.ts` calls this module.
Collision geometry and World.rng are unchanged. Claude's WebP assets, properly
sized/maskable icons and the subsequent stats fix are preserved.

Review `artifacts/scenery-gallery.png` and `artifacts/fridge-sticker-collection.png`.
The original task below is now a reference for further polish, not an unstarted
assignment. Claude should focus on real-phone art/performance QA and refinements
to this implementation, rather than creating a competing scenery module.
The new art is procedural Canvas, so it remains sharp and offline without extra
downloaded image assets. `node tests/scenery-visual.mjs` regenerates the previews
using the optional Canvas QA dependency documented in `tests/visual.mjs`.

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

---

# Claude pass: scenery and materials (2026-09-13)

## Changed files

- `src/game/scenery.ts` (new): all environment materials. `drawSteel`, `drawSeam`,
  `drawPanelJoint`, `drawZone`, `drawBumper`. Deterministic decoration via a small
  hash of zone position/hue, so nothing flickers between frames. Brushed grain is a
  single cached 512px tile (neutral gray under `overlay`, so it adds grain only);
  lighting is four gradients per frame in screen space (window from upper-left,
  a sliding reflection band, warm bounce low-left, cool sky upper-right).
- `src/game/render.ts`: removed the old inline steel/zone/bumper drawing; now calls
  scenery. HUD, aim preview, links, particles, floor, target line and all character
  calls are untouched.
- `public/art/title-fridge.webp` (77 KB, 720 wide), `public/art/title-logo.webp`
  (128 KB, 1100 wide), `public/icons/toy-icon-192.png`, `toy-icon-512.png`,
  `toy-icon-maskable-512.png` (12% padding on a `#1a1d24` ground): web-sized
  versions of the user's chosen art, produced with headless Chromium canvas.
  The 1.9–2 MB originals are removed from the repo (they stay in the user's
  OneDrive). Precache went from 5.9 MB to 1.3 MB.
- `index.html`, `vite.config.ts` (manifest icons incl. a real maskable entry,
  `webp` added to the Workbox glob), `src/game/ui.ts`, `src/game/menu-background.ts`,
  `tests/visual.mjs`: updated references only.

## Materials

- Steel: subtle grain, lit from upper-left, restrained warm/cool tints. Panel
  joints are a dark hairline with a lit lower edge. Door seam is a real groove
  with a lit right lip.
- Glass: light metal bezel, recess shadow, teal frosted pane, soft leaf/sky blobs
  from the window, two slow-drifting reflection streaks. The bezel is part of the
  non-stick rect, so nothing looks like a foothold.
- Plastic trim: matte black, molded ribs, faint sheen, lit top edge.
- Gap: dark recess, shadow thrown down from the upper panel lip, cold light on
  the far wall near the bottom lip, a vent slot per 130px.
- Stickers: four deterministic styles from the hue: polaroid snapshot with a
  heart magnet, souvenir plate (LAKE/BEACH/CAMP/HOME/ZOO/SKI), sticky note with
  checkboxes, kid's drawing pinned by a round magnet. Card is inset 4px and
  rotated so no tilted corner leaves the collider.
- Repel: glossy red enamel tile with a bevel, inner dark window and a pulsing
  glowing N, matching the title art. REPELS caption kept.
- Bumpers: PIZZA/VEG/24/7 themed plaques with a pizza-slice icon; single letters
  are chunky alphabet magnets on a white tile.
- Steel handle islands: pill with a vertical gradient and end caps.
- All shadows fall down/right (`castShadow`), same direction as the characters.
  No baked climbers or character shadows in the terrain.

## Checks run

- `npm test` 9/9, `npm run build` clean, Workbox precache lists every asset.
- Headless Chromium at 400x800 @2x: menu, solo start, camera panned through five
  segment types. Before/after screenshots were sent to Michael in chat.
- Not verified here: real phone frame rate, installed icon appearance, reduced
  motion, offline reload. The browser was headless.

## Physics notes for Codex (observations, nothing changed)

- Stickers overlap each other and the seam in "stickers" segments; purely visual,
  but they also overlap power-ups, which can hide a coin behind a polaroid.
  Consider keeping power-up spawns off sticker rects in world gen.
- Handles inside glass windows sit visually "on" the pane. The solver treats the
  handle rect as steel, so this matches gameplay.
