# Cat paw attack — prepared for review 2026-09-15

Generation retry succeeded with one new built-in imagegen output. Preferred cutout: `ready/cat-paw-top-v1-hard.webp`. `ready/cat-paw-top-v1.webp` is the rejected soft cleanup (background haze); retained only for history. No existing art was overwritten.

Review: `C:\Users\micha\magnet-art-ready\public\art-archive\cat-paw-v1\index.html`. GIF: `C:\Users\micha\magnet-art-ready\art\archive\15-cat-paw-attack-v1\motion-review-v1.gif`.

## Preparation and limitations

- Source/cutout 1024x1536; hard-key alpha bbox [258,0,759,1278]. Four toes and central pad intact, side/bottom margins clear. check-cutout.py flags ONLY frame contact: deliberate top-edge foreleg crop for offscreen entry, not an accidentally cropped paw. Hard key has 4449 semitransparent pixels and 241 magenta-tinted opaque pixels by the checker; visually inspected on light/dark composites. No erosion used.
- Preview positions the approximate pad center (510,1080); scale .24 produces a roughly 120px-wide paw. Top foreleg crop remains offscreen at maximum reach. Paw/toe region approximately x258..759, y900..1278; these are art landmarks, NOT a validated collision shape.
- Actual review contact holds .48–.57s, .87–.95s and 1.25–1.31s; retreat complete at1.65s, cooldown through3.2s. Second contact is deepest. Earlier brief's .16–.24s between contacts is superseded by these more legible review timings. Deterministic x sequence in preview demonstrates variety, not a game RNG implementation.
- This is ONE rigid photographic cutout translated for three taps, not articulated toe flex or a multi-pose rig. Contact sheet and 128-frame /20fps GIF generated from the same isolated review code. Reduced-motion preference starts the browser preview paused.
- Warning ring is only a timing placeholder. Damage, release behavior, warning design, attack scheduling and collision remain Claude's decisions for implementation; none changed here.

Full pack path: `C:\Users\micha\magnet-art-ready\art\archive\15-cat-paw-attack-v1`

## Art brief

One photorealistic orange-tabby domestic cat paw reaching down from the top edge. Underside visible: four toe pads and one larger central paw pad, claws retracted, gently splayed toes. Fur has warm orange stripes, cream highlights and natural texture. Foreleg continues off the top edge; no cat face or body. Clean readable silhouette at game size. No motion blur, text, scenery or cast shadow. Generate on a flat pure `#FF00FF` background and key with the existing no-erosion chroma-cut script. Preserve the source and run check-cutout.py.

Suggested asset names: `cat-paw-top-v1-magenta.png`, `cat-paw-top-v1.webp`.

## Attack motion for Claude

- Spawn from a random x position across the top safe lane, using a seeded gameplay choice.
- Warning: a small shadow/whisker cue and 0.25–0.45 seconds of anticipation.
- Three distinct taps: down → contact → up, repeated three times with 0.16–0.24 seconds between contacts. Vary the interval slightly per attack.
- Tap 1 is short, tap 2 is the deepest, tap 3 is quick. Add a small sideways drift each tap so it feels like a cat testing the fridge.
- Retract above the top edge after the third tap. Total attack window about 1.4–1.8 seconds.
- Hitbox follows the visible paw pad and toes only. The offscreen foreleg is decorative. A tap should release or damage a climber on contact; the paw is not magnetic and never a grip.
- Randomize x and timing from the run seed, with a cooldown so attacks cannot chain unfairly. Keep the warning readable and preserve reduced-motion behavior.

This is an art and behavior brief only. Claude owns wiring, warning UI, collision, damage, audio and schedule integration.
