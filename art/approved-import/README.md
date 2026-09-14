# Approved photographic art import

The seven pickups and ten obstacles were approved from `art/review-alternatives`.
Pocket Pal uses the approved tangerine pose based on the user's own fridge toys.
These are extracted from those approved boards, not the subsequent atlas attempts
(those returned baked checkerboards and were rejected).

`art/import-approved.py` crops, segments with rembg/u2net, clears enclosed backdrop, trims and
resamples the approved boards to `public/art/real-v1`. Original art remains in Git.
Pickups are 256px RGBA; obstacles retain native aspect ratios. The manifest records
each crop. No runtime segmentation or image generation is used.

The renderer fills existing collision rectangles, rotates tall ice trays, and uses
nine-slice frames for glass/plastic/gasket/vent. Guide thumbnails preserve aspect
ratio. Magnet field animation and all physics remain active. Failed image loads
fall back to existing canvas art. Image URLs are versioned to avoid stale caches.

Validation: existing simulation tests, production build, and `tests/library-visual.mjs`
with the actual image assets loaded (not the fallback drawings).
