# Fridge toy visual pass

This release builds on the existing creature roster and artwork. Existing paper
cards and moving novelty magnets remain in the catalog.

- Creatures: wider frog, broader crab shell and pincers, larger octopus mantle
  and four separated decorative arms, dinosaur muzzle/teeth and tail. Interior
  limb roots and curves vary by creature; magnetic endpoints still match physics.
- Opaque bodies cover the limb roots. Hit feedback now uses a white glow instead
  of per-part transparency; title toys are opaque too. Body gradients remain in
  local coordinates, preserving Claude's color fix.
- Hardware: several silver clasp, hinge, rivet and knurled-bar designs. No GRIP
  labels. Existing metal handles still appear alongside the new variations.
- Magnets: red N and blue S horseshoes. The guide correctly draws S instead of
  treating its metal flag as a handle. It explains attraction, repulsion, and the
  timed gadget's blue hold (which does not attract from afar).
- Eight additional advertising movers: dentist, pizza, vet, plumber, noodles,
  library, school bus and bakery. Twelve new illustrated papers include a lost
  sock notice, moon camp, a gig ticket, monster homework and a snack treasure map.
- Pickups: first-aid kit, star coin, faceted gem, horseshoe, packaged pocket pal,
  tomato kitchen timer and pocket tape measure. Effects/currency are unchanged.
- Field Guide: 75 entries; material instructions are in the guide rather than
  painted over glass/plastic/gaps. Thumbnails paint near the viewport in small
  batches. The guide freezes its background and drops blur. Touch guards apply
  only to gameplay; ResizeObserver avoids measuring layout every frame.

New runs use world version 6 for the expanded art pools. Versions 0–5 keep their
original pool selection and RNG sequence. No database or cloud migration needed.

Checks: simulation/save regressions, production/PWA build, full Field Guide
render, creature pose checks and 30 actual gameplay samples. Native Canvas QA
is not a replacement for a phone scroll/FPS check; no browser was connected.

Previews: `artifacts/fridge-field-guide.png`, `artifacts/creature-action-review.png`.
Scripts: `tests/library-visual.mjs`, `tests/creature-action.mjs` and
`tests/creature-visual.mjs` (optional Canvas setup in `tests/visual.mjs`).
