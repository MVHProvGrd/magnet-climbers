# Cat paw attack — queued 2026-09-15

Image generation is queued because the image tool returned `usage_limit_reached` before producing an output. No placeholder art was created and no existing art was overwritten.

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
