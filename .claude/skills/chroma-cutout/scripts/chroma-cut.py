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


# Every key is described by how "much of this key" a pixel reads (dominance) and
# by the key's own RGB, which soft mode unmixes against. Magenta is the default
# because it is rare in art; green and blue exist for subjects that are
# themselves pink (see references/prompting.md → Choosing a different key).
KEYS = {
    "magenta": (lambda R, G, B: np.minimum(R, B) - G, (255.0, 0.0, 255.0)),
    "green": (lambda R, G, B: G - np.maximum(R, B), (0.0, 255.0, 0.0)),
    "blue": (lambda R, G, B: B - np.maximum(R, G), (0.0, 0.0, 255.0)),
}

# How far from the sampled backdrop a pixel must sit (RGB euclidean) before
# --key=auto calls it art. 120 keeps shading and outlines while clearing the
# screen; the ramp below turns it into the same 0..100 dominance scale the
# named keys produce, so LO/HI and every downstream step are unchanged.
AUTO_RADIUS = 120.0


def sample_backdrop(a: np.ndarray) -> tuple:
    """Median colour of the frame's border ring, plus how flat that ring is.

    Image models will not paint an exact hex: ask for #FF00FF and you get a rose
    (235,32,138), ask for #00FF00 and you get a yellow-green. The backdrop is
    still perfectly FLAT, so sampling it beats assuming it.
    """
    ring = np.concatenate([
        a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3),
        a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3),
    ])
    key = np.median(ring, axis=0)
    spread = float(np.percentile(np.linalg.norm(ring - key, axis=1), 95))
    return key, spread


def main() -> int:
    flags = [a for a in sys.argv[1:] if a.startswith("--")]
    soft = "--soft" in flags
    key = "magenta"
    for f in flags:
        if f.startswith("--key"):
            key = f.split("=", 1)[1] if "=" in f else ""
    if key not in KEYS and key != "auto":
        print(f"usage: chroma-cut.py <in.png> <out.(png|webp)> [--soft] [--key={'|'.join(KEYS)}|auto]", file=sys.stderr)
        return 1
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2:
        print(f"usage: chroma-cut.py <in.png> <out.(png|webp)> [--soft] [--key={'|'.join(KEYS)}|auto]", file=sys.stderr)
        return 1
    src, dst = args[0], args[1]

    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    if key == "auto":
        K, spread = sample_backdrop(a)
        if spread > 16.0:
            print(f"{src}: border is not flat (95th pct spread {spread:.1f}) — a gradient or scenery, "
                  "not a key screen; regenerate", file=sys.stderr)
            return 1
        Kr, Kg, Kb = (float(K[0]), float(K[1]), float(K[2]))
        dist = np.sqrt((R - Kr) ** 2 + (G - Kg) ** 2 + (B - Kb) ** 2)
        dominance = lambda _R, _G, _B: 100.0 * np.clip(1.0 - dist / AUTO_RADIUS, 0.0, 1.0)
        print(f"{src}: keying on sampled backdrop rgb({Kr:.0f},{Kg:.0f},{Kb:.0f}) spread {spread:.1f}")
    else:
        dominance, (Kr, Kg, Kb) = KEYS[key]
    # Key dominance: high on the flat background (and any pocket of it enclosed
    # by the art), ~0 or negative on real subject colour. For magenta that is
    # min(R,B) - G: rust, teal, amber and skin all sit at or below zero.
    cast = dominance(R, G, B)

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
        safe = np.maximum(alpha01, 1e-3)
        R2 = np.clip((R - (1.0 - alpha01) * Kr) / safe, 0.0, 255.0)
        G2 = np.clip((G - (1.0 - alpha01) * Kg) / safe, 0.0, 255.0)
        B2 = np.clip((B - (1.0 - alpha01) * Kb) / safe, 0.0, 255.0)
        # The alpha estimate assumes art has cast≈0, but rope/wood is G-rich
        # (cast<0), so mixed strands keep a whisper of key in the unmixed
        # colour and mesh reads pink. Despill the RESULT: anything still
        # magenta-dominant gets R/B capped toward G — tan rope (min(R,B)<G)
        # never trips it, so real colours survive.
        cast2 = dominance(R2, G2, B2)
        # Pull whichever channels the key is made of back toward the one it is
        # missing, so the residue goes neutral whatever the key colour is.
        hi2 = [R2, G2, B2]
        on = [i for i, v in enumerate((Kr, Kg, Kb)) if v > 0]
        off = [i for i in range(3) if i not in on]
        floor2 = hi2[off[0]] + 10.0
        for i in on:
            hi2[i] = np.where(cast2 > 4, np.minimum(hi2[i], floor2), hi2[i])
        R2, G2, B2 = hi2
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

    # Despill: cap R and B down near G so the thin rim goes neutral instead of
    # pink. Confined to the EDGE — the partial-alpha band plus the first opaque
    # ring just inside it — because that is the only place key colour actually
    # mixes into the art on a hard-edged key. Gating on colour alone was wrong:
    # a saturated red (230,57,70) reads min(R,B)-G = 13, tripped the test and
    # came out near-black, which is how red magnets and candy canes died.
    # Interior amber, teal and red now keep their own colour by construction.
    a01 = alpha / 255.0
    partial = (a01 > 0.0) & (a01 < 1.0)
    edge = partial.copy()
    for shift, axis in ((1, 0), (-1, 0), (1, 1), (-1, 1)):
        edge |= np.roll(partial, shift, axis=axis)
    spill = edge & (cast > 6)
    if key == "auto":
        # The key colour is known exactly, so undo the mix algebraically on the
        # rim: F = (P - (1-a)K) / a. Cleaner than capping channels, and it works
        # for any backdrop hue rather than assuming which channels the key uses.
        safe = np.maximum(a01, 1e-3)
        hi = [np.where(spill, np.clip((C - (1.0 - a01) * Kc) / safe, 0.0, 255.0), C)
              for C, Kc in ((R, Kr), (G, Kg), (B, Kb))]
    else:
        hi = [R, G, B]
        on = [i for i, v in enumerate((Kr, Kg, Kb)) if v > 0]
        off = [i for i in range(3) if i not in on]
        floor = hi[off[0]] + 12.0
        for i in on:
            hi[i] = np.where(spill, np.minimum(hi[i], floor), hi[i])

    out = np.dstack([hi[0], hi[1], hi[2], alpha]).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(dst)
    print(f"wrote {dst}  opaque={int((alpha > 200).sum())}px")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
