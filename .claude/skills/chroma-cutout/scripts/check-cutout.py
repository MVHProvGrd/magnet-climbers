#!/usr/bin/env python3
"""Inspect a keyed cutout and say, in numbers, whether it is clean.

    python3 check-cutout.py out.png|out.webp [--json]

Reports:
  * size and the opaque bounding box (a box touching the frame edge means the
    generator cropped the subject — regenerate)
  * fully transparent / semi-transparent / opaque pixel counts. A healthy
    antialias is a THIN ring of semi-transparent pixels (roughly the perimeter
    length); thousands mean a halo (feathered matte) or a mesh that wanted
    `--soft`
  * opaque pixels that still carry a magenta cast (min(R,B) − G > 12): a pink
    rim that needs `--soft`, or a gradient / vignette the generator painted
    instead of flat colour (regenerate)

Exit 0 = clean, 1 = look at it before shipping (reasons printed).
"""
import json
import sys

import numpy as np
from PIL import Image


def analyse(path: str) -> dict:
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im).astype(np.int32)
    R, G, B, A = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    h, w = A.shape
    opaque = A >= 250
    clear = A == 0
    semi = ~opaque & ~clear
    cast = np.minimum(R, B) - G
    tinted = opaque & (cast > 12)

    ys, xs = np.where(A > 0)
    if len(ys):
        bbox = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
        touches_edge = bbox[0] == 0 or bbox[1] == 0 or bbox[2] == w - 1 or bbox[3] == h - 1
    else:
        bbox, touches_edge = None, False

    # Perimeter estimate: count opaque pixels with at least one non-opaque
    # 4-neighbour. A clean antialias has semi ≈ perimeter (give or take 2x).
    pad = np.pad(opaque, 1)
    edge = opaque & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    perimeter = int(edge.sum())

    reasons = []
    if bbox is None:
        reasons.append("no visible pixels at all — wrong file, or the key ate everything")
    if touches_edge:
        reasons.append("subject touches the frame edge — likely cropped; regenerate")
    if perimeter and semi.sum() > 3 * perimeter:
        reasons.append(
            f"semi-transparent pixels ({int(semi.sum())}) far exceed the edge length ({perimeter}) — "
            "halo from a feathered matte, or a mesh that wants --soft"
        )
    if tinted.sum() > 0.002 * max(1, opaque.sum()):
        reasons.append(
            f"{int(tinted.sum())} opaque pixels still read magenta — pink rim (try --soft) or the "
            "background was a gradient, not flat (regenerate)"
        )
    if clear.sum() == 0:
        reasons.append("nothing is transparent — was the background actually magenta?")

    return {
        "file": path,
        "size": [w, h],
        "bbox": bbox,
        "touches_edge": touches_edge,
        "pixels": {"transparent": int(clear.sum()), "semi": int(semi.sum()), "opaque": int(opaque.sum())},
        "edge_pixels": perimeter,
        "magenta_tinted_opaque": int(tinted.sum()),
        "clean": not reasons,
        "reasons": reasons,
    }


def main() -> int:
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    if not args:
        print(__doc__, file=sys.stderr)
        return 2
    rc = 0
    for path in args:
        r = analyse(path)
        if "--json" in sys.argv:
            print(json.dumps(r))
        else:
            p = r["pixels"]
            print(
                f"{path}: {r['size'][0]}x{r['size'][1]}  bbox={r['bbox']}  "
                f"opaque={p['opaque']}  semi={p['semi']}  transparent={p['transparent']}  "
                f"edge≈{r['edge_pixels']}  magenta-tinted={r['magenta_tinted_opaque']}  "
                f"→ {'CLEAN' if r['clean'] else 'CHECK'}"
            )
            for why in r["reasons"]:
                print(f"   - {why}")
        if not r["clean"]:
            rc = 1
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
