# Art refresh handoff — 2026-09-14

## Latest owner steering — 2026-09-15

Codex makes ART AND ANIMATION REVIEWS; Claude implements. New pack `12-motion-studies-v1`: realistic kid hand/forearm, enamel reach-badge alternative, interactive lemon bump-and-settle, side-swipe and bottom-entry left/right sweep previews. Review page `public/art-archive/motion-v1/index.html`; full instructions in pack HANDOFF.md. Single-pose hand and approximate source-rectangle lemon split are animation studies, not production articulated rigs. This supersedes older exclusions below for hand/reach art exploration only. No src/game changes. Hanging assets in `10-hanging-keepsakes-v1` remain available too.

## Codex queue — 2026-09-15 (from Claude, owner-approved: "we need tons of variety")

Everything below is generate-on-#FF00FF, key with `.claude/skills/chroma-cutout/scripts/chroma-cut.py`, drop into a new pack `art/archive/11-variety-v1/` (sources/ + ready/ + prompts.md), add to `art/archive/README.md`, run `node scripts/art-archive-page.mjs`. Claude wires. Do not overwrite anything in `public/art/`.

### A. Modernize what is still canvas-drawn (priority order)

| # | What | Count | Style ref | Naming |
|---|---|---|---|---|
| 1 | Business magnets: PLUMBER, NOODLES, LIBRARY, SCHOOL BUS, BAKERY | 5 | pack 08 dentist/pizza/vet (horizontal card, real printed vinyl, thin magnetic backing) | `business-3..7-v1` (order = `BUSINESS_MAGNETS` in `src/game/fridge-art.ts`) |
| 2 | Legacy toy bumpers: donut, duck, robot, dino, "POP!", "COOL" | 6 | chunky 3-D novelty fridge magnets (resin/rubber), wide silhouette, must read at ~90x50 px | `bumper-0..5-v1` |
| 3 | Paper cards, old set (20): pizza postcard, cat drawing, kid climbing drawing, scenic route, space cadet, home sweet fridge, seed packet, stay cool, snack list (done), you got this, don't let go, more magnets, donut, avocado, tiny dinosaur, rain check, lucky duck, sundae, gone fishing, beep boop robot | 19 | pack 08 grocery: real paper (photo, postcard, crayon drawing, sticky note, ticket), portrait or square, torn/taped/curled edges, NO magnet or pin | `paper-<index>-v1` (index = position in `paperNames`, `src/game/items.ts`) |
| 4 | Paper cards, new set (12): pizza menu, lost sock notice, moon camp postcard, tiny chef recipe, aquarium trip letter, gig ticket, family portrait, treasure map, watering rota, monster math homework, breakfast blueprint, dog-ate-list | 12 | same as 3 | `paper-new-<index>-v1` |
| 5 | Door gap trim (`gap`, the only obstacle still canvas) | 1 | shallow horizontal seam texture, 768x160, see pack 07 gapRule | `door-gap-v4` |
| 6 | Gadget charms `snack.png`, `travel.png`, `doodle.png` (rotor/swing/clip) | 3 | already photo but low-res PNG; regenerate as keyed WebP, 512 px | `charm-<theme>-v2` |

Not to touch: creatures/climbers (canvas by design), kid hand, pickups (all photo), destinations, compass/crayon/candy pole, title art.

### B. New variety (each is a pool entry; pairs keep N/S balance)

1. **Destinations, 4 more pairs (8):** S: Maldives, Zanzibar, Phuket, Cancún. N: Reykjavík swap not needed; use Tromsø, Banff, Hokkaido, Svalbard. Same spec as pack 09.
2. **Business magnets (6):** taxi, locksmith, sushi, car wash, real-estate agent with headshot, tax prep. Same spec as pack 08.
3. **Toy bumpers (6):** rubber ducky, toy taxi, race car, cartoon banana, space shuttle, alphabet letter block.
4. **Paper (10):** takeout receipt, concert wristband, kid's report card, coupon sheet, polaroid, birthday invite, sports schedule, doctor appointment card, cereal box-top, wanted poster (lost cat).
5. **Handles/hardware (metal, climbable, 3):** brushed-steel bar handle, chrome bottle opener, steel hook strip. 768x192 horizontal. Style: pack 07 compass-grade realism.
6. **Fridge surfaces (3 full-width textures, 800x340, tileable vertically):** brushed stainless, cream enamel with scuffs, black matte. For a future "fridge skin" unlock.

Send 8–12 per session; Claude wires each batch as it lands.

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
