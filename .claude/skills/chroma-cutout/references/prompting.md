# Prompting for a keyable image

The whole trick is getting the generator to paint a **flat, solid, single
colour** everywhere the subject isn't. Everything below serves that.

## The suffix (append verbatim to any subject prompt)

```
IMPORTANT: place the object against a completely FLAT SOLID PURE MAGENTA
background, hex #FF00FF, filling every pixel that is not the object — do NOT
draw a checkerboard, gradient or scenery, only flat solid magenta everywhere
behind and around it.
```

Why the wording is this heavy: models have a strong prior toward "nice"
backgrounds — vignettes, a floor plane, a soft gradient, a drop shadow — and
each of those becomes a halo or a box after keying. Naming the hex, saying
"every pixel", and explicitly forbidding checkerboard / gradient / scenery is
what reliably suppresses that prior. "Transparent background" does the
opposite: it makes the model *draw* a checkerboard.

## The rest of a good subject prompt

- **One object, centered, isolated.** "Single centered <thing>, one object only".
  Multiple objects or a cropped edge both produce cut-off silhouettes.
- **No text, no UI, no watermark, no ground shadow.** A shadow is a gradient
  on the key colour and keys as a grey smear.
- **Style anchors in words** (palette hexes, "chunky readable silhouette",
  "soft rim light") — and a **style reference image** when the API takes one
  (see per-provider notes). A reference is the single biggest lever for
  keeping a set of tiles consistent.
- **Resolution:** ask for the size you ship (e.g. 1024×1024 for isometric
  tiles). Upscaling a keyed image re-blurs the edge.

Example, a game resource icon:

```
Single centered game resource icon, one object only: a coil of salvaged copper
wire — salvaged-industrial post-flood palette, subtle teal accent glow (#3fd0d8),
soft rim light, chunky readable silhouette, clean high-detail concept-art icon,
centered and isolated, no text, no UI, no shadow. IMPORTANT: place the object
against a completely FLAT SOLID PURE MAGENTA background, hex #FF00FF, filling
every pixel that is not the object — do NOT draw a checkerboard, gradient or
scenery, only flat solid magenta everywhere behind and around it.
```

## Per-provider notes

The suffix is the same everywhere; only the plumbing differs.

**Google Gemini image models** (`gemini-3-pro-image-preview`,
`gemini-3.1-flash-image`, …): `POST …/v1beta/models/<model>:generateContent`,
`generationConfig.responseModalities: ["Image"]`. A style reference goes in
the same `contents[0].parts` as an `inline_data` part (base64 PNG/WebP) before
the text part. Output is base64 in `candidates[0].content.parts[].inline_data`.
These models ignore "transparent" entirely — the suffix is mandatory.

**OpenAI images** (`gpt-image-*`): the API *does* offer
`background: "transparent"` with `output_format: "png"`; try it first. When
the alpha comes back with a fringe or with enclosed pockets filled, fall back
to the magenta suffix and key it — the script doesn't care where the image
came from. `images.edit` accepts reference images.

**Stability / Stable Diffusion**: no native alpha. Use the suffix. If you run
your own pipeline, a plain "solid magenta background" in the prompt plus a
negative prompt of "checkerboard, gradient, shadow, vignette" works well.

**Midjourney and chat-only UIs**: paste the suffix; download the result; key
it locally. Same tool, same result.

## Choosing a different key

Magenta is the default because it is rare in natural and painted subjects. If
the subject is itself pink/magenta, pick pure green `#00FF00` or pure blue
`#0000FF` instead — whichever is furthest from the subject's palette — and
swap the suffix's colour name and hex.

`chroma-cut.py` computes "how magenta is this pixel" as `min(R, B) − G` and
unmixes against `K = (255, 0, 255)`. For another key, change both:

| key            | dominance expression   | `Kr, Kg, Kb`     |
|----------------|------------------------|------------------|
| magenta #FF00FF | `min(R, B) − G`       | `255, 0, 255`    |
| green #00FF00   | `G − max(R, B)`       | `0, 255, 0`      |
| blue #0000FF    | `B − max(R, G)`       | `0, 0, 255`      |

Everything else in the script (the ramp, the despill caps, soft-mode unmix)
is written in terms of that dominance value and the key vector, so those two
edits are the whole change.

## When to regenerate instead of rescuing

- Background is a gradient or has a floor/horizon → regenerate.
- The model added a shadow → regenerate (a keyed shadow is a grey smear).
- Subject touches the frame edge → regenerate; nothing recovers a cropped
  silhouette.
- Thin details look chewed after the default cut → do **not** regenerate,
  run `--soft`.
