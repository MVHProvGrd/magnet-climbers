#!/usr/bin/env python3
"""Chroma-key a solid-magenta-background tile to clean transparency.

Why magenta, not rembg?  rembg does *subject segmentation* — it keeps "the
object" and so it CANNOT remove background pockets enclosed by the art (a gap
between two towers, a hole under a walkway): those pixels aren't connected to
the outer background, so it leaves them opaque.  Keying on an unusual flat
colour removes every matching pixel *wherever it is*, interior pockets included.

Two things this version is careful about (learned the hard way):
  * NO erosion.  A 1px erode eats hairline details — antennas, propeller blades,
    cables, scaffolding — so they vanish.  We keep every pixel of the subject.
  * NO wide feather.  A Gaussian blur on the matte leaves a ring of semi-
    transparent pixels that reads as an "ethereal glow" on a dark background.
    Instead we map alpha with a STEEP ramp over a narrow magenta-distance band,
    giving a clean ~1px antialias with no halo.
A targeted despill only neutralises genuinely magenta-tinted rim pixels, so
amber windows and teal edge-glow in the art are left alone.

    python3 design/flotillas/chroma-cut.py <in.png> <out.(png|webp)> [--soft]

--soft: UNMIX keying for tiles with fine mesh / lattice / rigging (drift-nets!).
The default steep ramp treats a 50/50 strand-over-magenta pixel as background
and deletes it, which chews fishing nets into swiss cheese. Soft mode instead
estimates each pixel's magenta FRACTION (alpha = 1 - cast/cast_bg), keeps that
as partial transparency, and algebraically removes the key colour from the RGB
(F = (P - (1-a)K) / a) so the surviving strand keeps its true colour. Use it
only when the art has sub-pixel detail — on big solid buildings the default's
hard edge is cleaner (no faint film in enclosed pockets).
"""
import sys
import numpy as np
from PIL import Image


def main() -> int:
    soft = "--soft" in sys.argv[1:]
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    # (--key kept for signature compat; the maths below assume magenta #FF00FF.)
    if len(args) < 2:
        print("usage: chroma-cut.py <in.png> <out.(png|webp)> [--soft]", file=sys.stderr)
        return 1
    src, dst = args[0], args[1]

    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    # Magenta dominance: R and B both exceed G. High on the flat background (and
    # any interior magenta pockets), ~0 or negative on rust/teal/amber art.
    cast = np.minimum(R, B) - G

    if soft:
        # cast is ~linear in the key fraction: pure background ≈ cast_bg, pure
        # art ≈ 0. So alpha = 1 - cast/cast_bg recovers the art fraction of
        # every mixed pixel — a strand crossing magenta keeps ~its coverage as
        # partial alpha instead of dying at a threshold cliff.
        cast_bg = max(60.0, float(np.percentile(cast, 99.5)))
        alpha01 = np.clip(1.0 - cast / cast_bg, 0.0, 1.0)
        # Snap the extremes so the flat background is EXACTLY empty and solid
        # art exactly opaque; only genuinely mixed pixels stay fractional.
        alpha01 = np.where(alpha01 < 0.06, 0.0, alpha01)
        alpha01 = np.where(alpha01 > 0.94, 1.0, alpha01)
        # Unmix: P = a·F + (1-a)·K  =>  F = (P - (1-a)·K) / a. Removes the
        # magenta contribution from the colour itself, so no pink rim and no
        # despill needed — the strand keeps its true rope/paint colour.
        Kr, Kg, Kb = 255.0, 0.0, 255.0
        safe = np.maximum(alpha01, 1e-3)
        R2 = np.clip((R - (1.0 - alpha01) * Kr) / safe, 0.0, 255.0)
        G2 = np.clip((G - (1.0 - alpha01) * Kg) / safe, 0.0, 255.0)
        B2 = np.clip((B - (1.0 - alpha01) * Kb) / safe, 0.0, 255.0)
        # The alpha estimate assumes art has cast≈0, but rope/wood is G-rich
        # (cast<0), so mixed strands keep a whisper of key in the unmixed
        # colour and mesh reads pink. Despill the RESULT: anything still
        # magenta-dominant gets R/B capped toward G — tan rope (min(R,B)<G)
        # never trips it, so real colours survive.
        cast2 = np.minimum(R2, B2) - G2
        lim2 = G2 + 10.0
        R2 = np.where(cast2 > 4, np.minimum(R2, lim2), R2)
        B2 = np.where(cast2 > 4, np.minimum(B2, lim2), B2)
        alpha = alpha01 * 255.0
        out = np.dstack([R2, G2, B2, alpha]).astype(np.uint8)
        Image.fromarray(out, "RGBA").save(dst)
        print(f"wrote {dst}  opaque={int((alpha > 200).sum())}px  (soft unmix)")
        return 0

    # Steep alpha ramp: fully opaque where cast<=LO, fully transparent where
    # cast>=HI, a narrow band between for a clean antialias. No erosion, no blur —
    # so thin protruding details survive and there's no glow halo.
    LO, HI = 24.0, 66.0
    alpha = np.clip((HI - cast) / (HI - LO), 0.0, 1.0) * 255.0

    # Despill: only where the pixel actually reads magenta, cap R and B down near
    # G so the thin rim goes neutral instead of pink. Amber (low B) and teal
    # (low R) never trip this, so real edge-glow in the art is preserved.
    spill = cast
    lim = G + 12.0
    R2 = np.where(spill > 6, np.minimum(R, lim), R)
    B2 = np.where(spill > 6, np.minimum(B, lim), B)

    out = np.dstack([R2, G, B2, alpha]).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(dst)
    print(f"wrote {dst}  opaque={int((alpha > 200).sum())}px")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
