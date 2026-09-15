# chroma-cutout

Clean transparent cutouts (sprites, tiles, icons, product shots) from AI image
generators that cannot produce real alpha — Gemini, Imagen, DALL·E, Stable
Diffusion, Midjourney, any of them.

**The method:** don't ask for "transparent" (the model draws a checkerboard),
and don't use a background remover (it can't clear background trapped inside
the art). Ask for a **flat solid pure-magenta `#FF00FF` background**, then
chroma-key it with the script here. Interior pockets clear, 1px details
survive, no halo.

Works for humans at a terminal and for any AI agent: `SKILL.md` is the
agent-facing instruction file (Claude Code / Claude.ai skill format, but plain
Markdown — drop its body into an `AGENTS.md`, a Cursor rule, a custom GPT, or
a system prompt and it works the same).

## Install

```
pip install -r scripts/requirements.txt      # Pillow + numpy, Python 3.9+
python3 scripts/selftest.py                  # prints "selftest OK"
```

## Use

1. Append this to your image prompt, whatever the provider:

   ```
   IMPORTANT: place the object against a completely FLAT SOLID PURE MAGENTA
   background, hex #FF00FF, filling every pixel that is not the object — do NOT
   draw a checkerboard, gradient or scenery, only flat solid magenta everywhere
   behind and around it.
   ```

2. Key it:

   ```
   python3 scripts/chroma-cut.py in.png out.webp          # solid subjects (default)
   python3 scripts/chroma-cut.py in.png out.webp --soft   # nets, mesh, rigging, hair
   ```

3. Check it (useful when you can't look at the image):

   ```
   python3 scripts/check-cutout.py out.webp               # exit 0 clean, 1 look at it
   ```

## What's in the box

| file | what |
|---|---|
| `SKILL.md` | the agent instructions: workflow, rules, when to use `--soft` |
| `scripts/chroma-cut.py` | the keyer — default steep-ramp mode + `--soft` unmix mode |
| `scripts/check-cutout.py` | inspector: bbox, halo, residual magenta, exit code |
| `scripts/selftest.py` | synthetic round-trip proving the install works |
| `references/prompting.md` | full prompt recipe, per-provider API notes, changing the key colour |
| `references/why-magenta.md` | the reasoning behind every parameter (no erosion, no feather, …) |

## Rules of thumb

- Never overwrite a generated image — generations are not reproducible. Keep every take.
- Flat means flat: a gradient, vignette or shadow behind the object → regenerate, don't rescue.
- Default mode first; switch to `--soft` only when thin mesh gets chewed or the checker reports a pink rim.
- Magenta subject? Use green or blue as the key instead (two-line script change, see `references/prompting.md`).

## License

MIT — do what you like, keep the notice.
