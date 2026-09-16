# Pack25 hardware — COMPLETE

Latest continuation: five pending assets generated successfully. All eight now delivered. Historical quota notes below are superseded.

Added ready/rotor-travel-v1.webp (blueB), rotor-doodle-v1.webp (greenC), pickup-candy-v1.webp, all1024x1024; door-gap-v4.webp768x160; grip-bar-v1.webp512x128.

Strip edges intentionally touch left/right: these are horizontal tiles, not accidental crops. export.py mirrors the native texture into matching repeat edges; alpha margins above/below remain. Native keyed sources preserved. Six isolated objects pass automated alpha QC, two strips carry this explicit edge exception. Visually reviewed on dark/light.

2026-09-16. Three generated, keyed, visually reviewed on dark/light, all alpha checks pass. Claude wires; no live files changed.

Ready:
- ready/swing-travel-v1.webp — 1024x1536 whole assembly: magnetic hook, linked chain, ring, mountain and hiking boot charms.
- ready/swing-doodle-v1.webp — 1024x1536 whole assembly: magnetic hook, linked chain, ring, resin glitter happy star.
- ready/rotor-snack-v1.webp — 1024x1024 real red plastic A; interior hole keyed through.

Suggested source-space anchors (approximate, validate renderer): travel plate center(507,176), suspension pivot(507,275); doodle plate center(507,165), suspension pivot(507,268). Both canvases1024x1536. If plate stays fixed, split hardware/chain at suspension pivot. If whole assembly swings like current lemon, use plate center as root. Decoration connections do not define new physics.

Native rotor retained under keyed; export.py creates exact1024 output. Ring interior alpha intact. No baked scenery/shadow.

PENDING in this pack: blueB rotor-travel-v1, greenC rotor-doodle-v1, door-gap-v4, grip-bar-v1, pickup-candy-v1. Full prepared prompts in prompts.md. First blocked call was blueB; no output was produced.

Limit evidence: built-in imagegen returned429 usage_limit_reached, resets_at1789551873, resets_in_seconds14516 (about4h02m at receipt).31 successful new generations in the complete continuation before this block. Do not redo already delivered art.
