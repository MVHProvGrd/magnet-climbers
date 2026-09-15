---
name: chroma-cutout
description: Get clean transparent-background cutouts (sprites, tiles, icons, unit art, product shots) out of AI image generators that cannot produce real alpha. Use this whenever the user asks for a transparent PNG/WebP, a sprite or tile with no background, an isolated object "on transparent", or complains that a generated image came back with a checkerboard, a grey box, a white fringe, a glow halo, or leftover background inside holes in the art. Also use it for any pipeline that generates game/UI art with Gemini, DALL·E, Imagen, Stable Diffusion, Midjourney or similar and then needs the background removed — even if the user only says "make the background transparent" or "cut this out". The method is to ask the model for a flat solid pure-magenta (#FF00FF) background and then chroma-key it with the bundled script, instead of asking for transparency or using a segmentation tool like rembg.
---

# Chroma cutout — transparent art from generators that can't do alpha

Image models (Gemini, Imagen, DALL·E, SD, Midjourney…) paint opaque pixels.
Ask one for a "transparent background" and it draws a **picture of**
transparency — a grey checkerboard — which no tool can key cleanly. And
segmentation removers (rembg, "remove background" buttons) keep "the object",
so they cannot clear background **enclosed by the art**: the gap between two
towers, the hole under a walkway, the space inside a wheel. Those pockets stay
opaque and show up as a coloured box the moment the image sits on anything
other than the original backdrop.

The fix is old film-industry green-screen thinking: put the object on a flat,
unusual, solid colour and remove **every pixel of that colour, wherever it is**.

## Workflow

1. **Generate on flat magenta.** Append the suffix below to the image prompt.
   Magenta `#FF00FF` is the key because it almost never occurs in real art
   (rust, wood, metal, skin, foliage, sky, teal glow, amber lights are all far
   from it). If the subject itself is pink/magenta, pick another key colour and
   see `references/prompting.md` → "Choosing a different key".

   ```
   IMPORTANT: place the object against a completely FLAT SOLID PURE MAGENTA
   background, hex #FF00FF, filling every pixel that is not the object — do NOT
   draw a checkerboard, gradient or scenery, only flat solid magenta everywhere
   behind and around it.
   ```

   Also say: centered and isolated, no text, no UI, no ground shadow. Pass an
   existing finished tile as a style reference when the provider supports
   image input, so the new piece matches the set. Full prompt recipe and
   per-provider notes: `references/prompting.md`.

2. **Key it out** with the bundled script (Python 3, Pillow, numpy —
   `pip install -r scripts/requirements.txt`):

   ```
   python3 scripts/chroma-cut.py in.png out.webp          # default: solid subjects
   python3 scripts/chroma-cut.py in.png out.webp --soft   # fine mesh / nets / rigging / hair
   ```

   The output format follows the extension (`.png` or `.webp`, both RGBA).
   Default mode keys on magenta dominance (`min(R,B) − G`) with a **steep**
   alpha ramp over a narrow band — a clean ~1px antialias, no halo — and a
   targeted despill that neutralises only genuinely magenta-tinted rim pixels
   so amber windows and teal edge-glow in the art survive untouched. It
   deliberately does **no erosion** (a 1px erode eats antennas, propeller
   blades, cables, scaffolding) and **no wide feather** (a blurred matte
   leaves a ring of half-transparent pixels that reads as an "ethereal glow"
   on a dark page). `--soft` instead estimates each pixel's magenta
   *fraction*, keeps it as partial alpha and algebraically unmixes the key
   colour out of the RGB — use it only when the art has sub-pixel detail,
   because on big solid shapes the default's hard edge is cleaner (no faint
   film in enclosed pockets). Why each of these choices: `references/why-magenta.md`.

3. **Check the result** before shipping it — you often cannot see the image:

   ```
   python3 scripts/check-cutout.py out.webp
   ```

   It reports the opaque bounding box, how many pixels are semi-transparent
   (a healthy antialias is a thin ring; thousands of them means a halo or a
   mesh that wanted `--soft`), and whether any opaque pixel still carries a
   magenta cast (a rim that needs `--soft`, or the generator drew a gradient
   instead of flat colour — regenerate). Exit code 0 = clean, 1 = look at it.

4. **Place it** where the project expects transparent art, and do whatever
   the project does after an art swap (regenerate sprite anchors, bump an
   asset-version cache key, add the gallery entry). If the project has its
   own conventions file, follow it; this skill only owns the cutout.

## Rules that save re-generations

- **Never overwrite a generated image.** Generations cost money and are not
  reproducible — re-running the same prompt yields a different picture. Keep
  every take (`_history/<name>-v<n>.png` or similar); the rejected ones are the
  record of why the final one looks the way it does.
- **Flat means flat.** If the model paints a vignette, gradient or scenery
  behind the object, the key will leave a halo or a box. Regenerate with the
  suffix intact rather than trying to rescue it.
- **Magenta subjects need a different key.** Pink neon, orchids, a magenta
  flag — pick a key absent from the subject (pure green `#00FF00` or blue
  `#0000FF`), and note the script's maths assume magenta; see
  `references/prompting.md` for the two-line change.
- **Default first, `--soft` on evidence.** Run default, run the checker; only
  switch to `--soft` when the checker or your eyes show swiss-cheese mesh or a
  pink rim. Soft mode on a solid building leaves a faint film in pockets.
- **Verify the install once** with `python3 scripts/selftest.py` — it
  synthesises a test tile (enclosed pocket, 1px hairline, coloured rim) and
  asserts the cutout keeps the hairline, clears the pocket and leaves no cast.

## Files

- `scripts/chroma-cut.py` — the keyer (default + `--soft`), the whole tool.
- `scripts/check-cutout.py` — post-cut inspector, exit code for agents.
- `scripts/selftest.py` — synthetic round-trip proving the install works.
- `scripts/requirements.txt` — Pillow, numpy.
- `references/prompting.md` — the prompt suffix, style references, per-provider
  API notes (Gemini / OpenAI / Stability), changing the key colour.
- `references/why-magenta.md` — the reasoning behind every parameter.
- `README.md` — provider-agnostic usage for humans and non-Claude agents.
