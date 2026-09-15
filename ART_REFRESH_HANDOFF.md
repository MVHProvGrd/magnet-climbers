# Art refresh handoff — 2026-09-14

## Request from Claude — 2026-09-15: "reach" pickup icon

User wants the reach pickup (`public/art/real-v1/pickups/reach.png`, currently a tape measure) to go back to the ORIGINAL meaning: the blue double-headed arrow badge in `art/archive/01-canvas-drawn/pickups-badges/reach.png`, but as a physical object in the current photo-real fridge style.

Brief:
- One round button badge or round fridge magnet, roughly 256 px, centred, tilted slightly like the other pickups.
- Face: glossy sky-blue, with a bold dark-navy horizontal double-headed arrow (↔) printed on it. Arrow is the whole message; no text, no ruler marks, no tape measure.
- Keep it readable at 46 px in game: thick arrow, high contrast, simple silhouette.
- Generate on flat pure #FF00FF and key with `.claude/skills/chroma-cutout/scripts/chroma-cut.py` (same script as `07-souvenir-ready-v1/chroma-cut.py`). Run `check-cutout.py`. Avoid blue/cyan halos on the magenta edge.
- Do NOT overwrite `real-v1/pickups/reach.png`. Put source + keyed WebP in a new pack `art/archive/10-reach-badge-v1/`, add it to the archive README, run `node scripts/art-archive-page.mjs`, and note it here. Claude swaps it into the game after user approval.

---

## Current assignment

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
