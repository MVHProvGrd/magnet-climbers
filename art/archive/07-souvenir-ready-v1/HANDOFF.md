# Magnet Climbers art handoff — active

User request: finish current assets until ready to wire; maintain notes so Claude can continue if image generation hits a limit. Destination assets are now wired in this branch; deployment still pending.

## Owner rules

- Real photographed fridge objects / textured souvenirs, not flat icons.
- Pure #FF00FF background for generation; chroma-key afterward. No fake transparency/checkerboard. Preserve all source generations and version outputs.
- Reuse C:/Users/micha/flotillas-adrift/design/flotillas/chroma-cut.py (no erosion; --soft for fine mesh). Inspect actual alpha and dark/light composites.
- Give full absolute local paths in every handoff.
- Glass: bottles BEHIND closed glass, separate panels for left/right refrigerator doors. Preserve central world seam; do not bake a seam at the center of arbitrary obstacle sprites.
- Center collision seam is non-stick. Preserve useful full-width challenges and moving objects; split fixed material rendering rather than silently redesigning saved physics.

## Scope and progress

- S / attract destinations: Fiji, Hawaii, Bali. N / repel destinations: Norway, Alaska, Iceland, Jūrmala/Latvija, Kyiv/Ukraine. All prepared WebP files passed alpha and clear-border checks. Field animation remains a separate layer.
- Compass: generated brass Alaska concept with independent dial and needle layers; manifest records pivots.
- Crayon: crayon-v2.webp keyed from crayon-v2-magenta.png; verified dark composite, old versions preserved.
- Candy pole: prepared WebP passed alpha and clear-border checks.
- Glass bottles: glass-door-v2 is prepared as a single-door panel with bottles behind closed glass; glass-wide is retained as a concept.
- Door seam: door-gap-v3 is prepared from pure magenta; it is review art only until the existing procedural gap layout is deliberately replaced.

## Locations

Review root: C:/Users/micha/magnet-art-review/art/review-alternatives
Souvenir concepts: C:/Users/micha/magnet-art-review/art/review-alternatives/souvenirs-v1
Prepared pack: C:/Users/micha/magnet-art-ready/art/archive/07-souvenir-ready-v1
Live destination assets in this branch: C:/Users/micha/magnet-art-ready/public/art/destinations

## Generation count

Generation ledger: 7 initial concepts + 3 crayon edits (2 failed alpha, 1 successful magenta source) + 11 successful destination/glass/seam/compass calls in this continuation. Total successful image results: 18; no limit until the next requested Tahiti call.

The Tahiti request hit the image tool limit: HTTP 429 `usage_limit_reached`, reset in 12,729 seconds at the time of the error (about 3h32m). Tahiti is queued; the available S set is Fiji/Hawaii/Bali.

## Integration cautions

obstacle-art.ts still stretches images / nine-slices glass. Do not nine-slice bottle imagery or stretch souvenirs out of proportion.
gadget-art.ts now loads `public/art/destinations/*.webp`; `polarityDestination(g.id, p.active)` deterministically selects an S destination while attracting and an N destination while repelling. Old gadget themes and fallback `drawFieldMagnet` remain intact.
The live copy is pending the branch validation and deployment workflow.
