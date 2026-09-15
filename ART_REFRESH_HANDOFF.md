# Art refresh handoff — 2026-09-14

## Claude: cat paw and POP! are WIRED (2026-09-15). Paw = third attack type from the top, three taps, pad-only hitbox, depth scaled to the view. POP! = ten bubble bits per toy, nearest bubble flips on contact (0.16 s debounce), three pop sounds + push-in sound.

## Plain-item realism batch 19 — 2026-09-15

Eight prepared assets in `art/archive/19-bumpers-paper-v1/ready`: robot bumper2 v2 (fixes prior chroma failure), COOL penguin bumper5, old paper indices0,2,3,4,5,6. All pass alpha QC, light/dark review supplied, ten successful generations including two backdrop corrections. Exact mapping and exclusions in pack HANDOFF.md. Paper remains nonmagnetic; these are base bumpers, chain versions still queued. No game/live files changed. Added to gallery, Claude wires.

## Extended cat/boy limbs — 2026-09-15

Owner reported floating cropped ends during camera movement. Pack `18-extended-limbs-v1` supplies TWO longer cutouts: cat-foreleg-long-v3.webp and kid-arm-long-v2.webp. Read its HANDOFF.md for new coordinates, root-clearance checks, world-space contact, reach caps, early retraction and camera-snap cancellation. More art alone is NOT a game fix. Claude implements; no game/live assets changed by this batch. Original versions retained, new versions added to archive gallery.

## Cat paw and POP! motion reviews — 2026-09-15

Cat paw generation retry succeeded: one realistic tabby cutout, transparent hard-key version preferred, three-tap GIF and standalone review in `public/art-archive/cat-paw-v1/index.html`. Pack `15-cat-paw-attack-v1/HANDOFF.md` gives timing, source coordinates and QC exceptions. Single rigid cutout, NOT an articulated rig. Original source and rejected soft cleanup preserved.

New owner request: POP! bubbles react individually to climber impacts with in/out states and varied sounds. Interactive photographic bubble-swap study in `public/art-archive/pop-it-v1/index.html`, ten toggles and synthesized review audio. Pack `16-pop-it-motion-v1/HANDOFF.md` gives bubble coordinates and proposed contact debounce. No new POP! generation; reuses pack 14. Both added to the existing admin-linked archive. No game or live art replacements; Claude handles implementation. Branch push does not mean deployed.

## Codex batch progress — section A2 / bumper keychains

User decision: all toy bumpers remain magnets with a small repulsive near-contact nudge. Donut, duck, robot, dino and POP! also become keychain-style hanging objects with a lemon-like swing pivot. Pack `14-toy-bumper-keychains-v1` contains five generated studies; COOL penguin is queued after the image limit. Robot has a chroma QC warning and must be regenerated before wiring. Full contract is in that pack's HANDOFF.md. No game files changed.

## Codex batch progress — section A1

Pack `13-business-magnets-v1`: PLUMBER, NOODLES, LIBRARY, SCHOOL BUS, BAKERY generated, versioned and keyed as `business-3..7-v1.webp`. All five pass check-cutout.py clean. Source prompts and exact ID mapping in pack prompts.md. Added to gallery; review only, Claude wires. Five successful calls; no limit. Next A2 toy bumpers. User's latest v2 queue below is authoritative.

## Claude status — 2026-09-15 (later)

Pack 10 hanging keepsakes are WIRED and LIVE (see archive README). Pack 12: kid arm and enamel reach badge are review-only pending owner choice; motion studies read, hand rigging stays with Claude. Codex: continue the variety queue below.

## Latest owner steering — 2026-09-15

Codex makes ART AND ANIMATION REVIEWS; Claude implements. New pack `12-motion-studies-v1`: realistic kid hand/forearm, enamel reach-badge alternative, interactive lemon bump-and-settle, side-swipe and bottom-entry left/right sweep previews. Review page `public/art-archive/motion-v1/index.html`; full instructions in pack HANDOFF.md. Single-pose hand and approximate source-rectangle lemon split are animation studies, not production articulated rigs. This supersedes older exclusions below for hand/reach art exploration only. No src/game changes. Hanging assets in `10-hanging-keepsakes-v1` remain available too.

## Codex queue — 2026-09-15 (v2, owner-approved; replaces the earlier queue)

Rules: generate on flat #FF00FF, key with `.claude/skills/chroma-cutout/scripts/chroma-cut.py`, put each batch in a new pack `art/archive/<nn>-<name>-v1/` (sources/ + ready/ + prompts.md), add a README row, run `node scripts/art-archive-page.mjs`, push with `git push origin HEAD`. Claude wires. Never overwrite `public/art/`.
Hanging assemblies (lemon style): whole object on its hook, hook at top centre, fingers/paper/chain complete, clear margins; note the hook pivot pixel in prompts.md. Clip papers: silver clip at top centre, paper below, portrait or landscape. Bumpers: wide chunky silhouette readable at 90x50. Business magnets: horizontal card like pack 08.

### A. Regenerate what is still canvas-drawn (priority order)

| # | What | Count | Naming |
|---|---|---|---|
| 1 | Business magnets: PLUMBER, NOODLES, LIBRARY, SCHOOL BUS, BAKERY | 5 | `business-3..7-v1` (order = `BUSINESS_MAGNETS`, `src/game/fridge-art.ts`) |
| 2 | Toy bumpers: donut, duck, robot, dino, POP! pop-it, COOL penguin | 6 | `bumper-0..5-v1` |
| 3 | Paper, old set (18, Cat Nap Club and Snack List done): pizza postcard, kid climbing drawing, scenic route, space cadet, home sweet fridge, seed packet, stay cool, you got this, don't let go, more magnets, donut, avocado, tiny dinosaur, rain check, lucky duck, sundae, gone fishing, beep boop | 18 | `paper-<index>-v1` (index in `paperNames`, `src/game/items.ts`) |
| 4 | Paper, new set: pizza menu, lost sock notice, moon camp postcard, tiny chef recipe, aquarium trip letter, gig ticket, family portrait, treasure map, watering rota, monster math homework, breakfast blueprint, dog-ate-list | 12 | `paper-new-<index>-v1` |
| 5 | Keyring swings, lemon style: trail keyring (travel), star keyring (doodle) | 2 | `swing-travel-v1`, `swing-doodle-v1` |
| 6 | Rotor letters as real moulded plastic alphabet magnets A, B, C, square-ish, centred | 3 | `rotor-snack-v1` (A), `rotor-travel-v1` (B), `rotor-doodle-v1` (C) |
| 7 | Door gap trim, shallow horizontal 768x160 | 1 | `door-gap-v4` |
| 8 | Silver grip bar (the steel hardware on swings and clips), 512x128, brushed | 1 | `grip-bar-v1` |
| 9 | Glass door variants, same frame style as pack 07: tall 384x640 x2 (different bottles/produce: yoghurt jars and berries; sodas and pickles), wide 768x384 x2 (dairy row; sauces and jars). Windows repeat the one door now | 4 | `glass-door-v3`, `glass-door-v4`, `glass-wide-v3`, `glass-wide-v4` |

### B. New variety (pools grow; Claude adds items, cards, translations)

- **Hanging assemblies (swing pool)**: keys on a ring with car fob, bottle opener on a chain, mini disco ball, rubber duck keychain, bead lanyard with ID badge, carabiner with whistle, three-tube wind chime, baby shoe on a ribbon, scissors by one loop, measuring spoons on a ring, souvenir spoon, fishing lure. Naming `swing-<name>-v1`.
- **Swing-pool gameplay rule from user**: keep every item as a physical fridge magnet with a small repulsive near-contact nudge. Decorations and payloads do not become grip points. The donut, duck, robot, dino and POP! bumper magnets also use keychain hardware and a top pivot so they swing like lemon; COOL penguin should follow the same rule when generated.
- **Rotors**: wall clock magnet, pinwheel, dial thermometer, fidget spinner. `rotor-<name>-v1`.
- **Clip papers**: concert ticket, report card, takeout receipt, birthday invite, lost cat poster, coupon sheet, polaroid of grandma. `clip-<name>-v1`.
- **Bumpers**: rubber ducky, toy taxi, race car, banana, space shuttle, letter block, plastic brick, gummy bear. `bumper-<name>-v1`.
- **Business magnets**: taxi, locksmith, sushi, car wash, realtor with headshot, tax prep, pool cleaner, tattoo parlour. `business-<name>-v1`.
- **Destinations**: pairs only, 4 S + 4 N: Maldives, Zanzibar, Phuket, Cancún; Tromsø, Banff, Hokkaido, Svalbard. Same spec as pack 09.

8 to 12 per session. Claude wires each batch as it lands.

## Status 2026-09-15: packs 08 and 09 are WIRED and LIVE (Claude). `art/archive/prepare-live.py` fits ready cutouts into `public/art/`. Destination pools are now 7 S / 7 N. Reach pickup done by Claude (pack 10).

## Request from Claude — 2026-09-15: "reach" pickup icon — DONE by Claude (pack `10-reach-badge-v1`, canvas-rendered, live). No action needed.

User wants the reach pickup (`public/art/real-v1/pickups/reach.png`, currently a tape measure) to go back to the ORIGINAL meaning: the blue double-headed arrow badge in `art/archive/01-canvas-drawn/pickups-badges/reach.png`, but as a physical object in the current photo-real fridge style.

Brief:
- One round button badge or round fridge magnet, roughly 256 px, centred, tilted slightly like the other pickups.
- Face: glossy sky-blue, with a bold dark-navy horizontal double-headed arrow (↔) printed on it. Arrow is the whole message; no text, no ruler marks, no tape measure.
- Keep it readable at 46 px in game: thick arrow, high contrast, simple silhouette.
- Generate on flat pure #FF00FF and key with `.claude/skills/chroma-cutout/scripts/chroma-cut.py` (same script as `07-souvenir-ready-v1/chroma-cut.py`). Run `check-cutout.py`. Avoid blue/cyan halos on the magenta edge.
- Do NOT overwrite `real-v1/pickups/reach.png`. Put source + keyed WebP in a new pack `art/archive/10-reach-badge-v1/`, add it to the archive README, run `node scripts/art-archive-page.mjs`, and note it here. Claude swaps it into the game after user approval.

---

## Current assignment

2026-09-15: New hanging-items batch in `art/archive/10-hanging-keepsakes-v1`: seaside postcard, cat snapshot, dinosaur crayon drawing, pancake recipe, lemon keychain. Five successful image generations, no limit. Preserved sources, transparent cutouts, dark/light review sheet and per-pack HANDOFF.md. These are review assemblies with baked-in hardware; rigging/pivots are not prepared. No game renderer changes. N/S balance unchanged at 7/7.

LATEST: Keep North and South destination counts EVEN. New pack `09-balanced-travel-v1` adds Tahiti, Seychelles, Cape Town, Rio (S) and Edinburgh, Lapland (N). Combined with existing 3 S / 5 N, the review collection is now **7 S / 7 N**. Future additions should be pairs. These additions are REVIEW ONLY, not wired into the game. Use Cape Town v2; v1 is preserved but magenta keying discolored its pink house/flower. All other new destinations use v1. Eight successful generation calls this continuation (vet + six destinations + Cape Town correction), no limit encountered. Vet bone-shaped magnet added to pack 08 as business-2 candidate. Existing game code remains Claude's implementation.

User wants Codex to focus on ART WORK: upgrade untouched art where it fits the realistic, tactile fridge style, then add each version to the existing admin-linked art archive. Preserve all prior art. This batch is review-only, with no game renderer or physics changes.

Claude's current destination obstacle / timed toy gadget implementation is authoritative. Worktree was fast-forwarded to `1d628b9` before creating this batch. Do not restore the superseded wiring described in `07-souvenir-ready-v1/HANDOFF.md`.

## Completed this pass

Three successful built-in image generations, no generation limit encountered:

| Asset | Intended eventual mapping | Review status |
|---|---|---|
| business-pizza-v1 | business-1 mover | Real printed pizza takeaway magnet; source and keyed WebP ready for review |
| business-dentist-v1 | business-0 mover | Raised ivory tooth / teal enamel advertising magnet; source and keyed WebP ready for review |
| paper-grocery-v1 | paper-8 Snack List candidate | Handwritten grocery list on real ruled paper; source and keyed WebP ready for review |

All use pure #FF00FF source backgrounds and the existing `07-souvenir-ready-v1/chroma-cut.py` (no erosion). Original generation files are preserved. Full-resolution cutouts retain source margins. Fit proportionally; do not stretch them or substitute them into gadgets. Paper remains non-magnetic. No asset has user approval for a game swap yet.

## Exact paths

- This note: `C:\Users\micha\magnet-art-ready\ART_REFRESH_HANDOFF.md`
- Pack: `C:\Users\micha\magnet-art-ready\art\archive\08-tactile-refresh-v1`
- Originals: pack `sources\` directory, `*-v1-magenta.png`
- Prepared cutouts: pack `ready\` directory, `*-v1.webp`
- Existing admin-linked gallery: `C:\Users\micha\magnet-art-ready\public\art-archive\index.html`
- Gallery section: `/art-archive/#08-tactile-refresh-v1`

The existing archive is a static noindex page linked from admin, not an authenticated private asset store. This pass uses that existing gallery, with no player-facing game art changes.

## Remaining queue

Prioritize the still-flat business movers: vet, plumber, noodles, library, school, bakery. Then tactile toy versions of donut, duck, robot, dino, ice-pop and penguin movers. Paper cards should become convincing photographs of paper prints, crayon drawings, postcards or notes; retain their non-stick behavior. Already refreshed pickups and destination souvenirs do not need redundant remakes. Glass/gap concepts already exist in pack 07 and need review rather than another blind replacement. Tahiti S remains an earlier queued concept, lower priority than untouched art.

## Continue safely

Use versioned sources, prepared assets and notes. Add to the archive README, then run `node scripts/art-archive-page.mjs`. Check cutout alpha and both light/dark backgrounds before proposing wiring. Keep the gameplay source files under Claude's ownership. Always give the user full absolute local paths.
