# Cat contact pose and scratch decals

2026-09-16. Four successful built-in image generations. Archive only; Claude wires.

- ready/cat-paw-claws-v1.webp: 362x1085 contact pose, four extended claws.
- ready/claw-mark-1..3-v1.webp: three 64x256 transparent scratches, lengths232/190/240px.
- sources retains every original; keyed retains native cutouts; export.py reproduces final fitting.
- export-review.jpg: light/dark review. Scratch QC passes. Paw QC flags top edge: intentional offscreen foreleg root, not a clipped claw.

IMPORTANT: contact paw is a REVIEW CANDIDATE, not pixel-perfect swap-ready. Image generation changed fur and broadened toes despite invariant prompt. Existing approach art already has small claws. Output extends them substantially. Align contact pad approximately (182,920), then verify four tip positions and hitbox in renderer. Do not silently swap and claim identical collision geometry. Claude may blend only the toe region or fit the frame before wiring. Full original leg is NOT guaranteed unchanged.

Scratch sprites are ready for growth/fade animation (~1.6sec); draw narrowly at game scale. No fridge rectangle baked in; visible on light and dark steel.
