#!/usr/bin/env python3
"""Round-trip self-test: proves the install works and the keyer keeps what it
should keep and clears what it should clear. No network, no model — it paints
a synthetic "tile" and runs both modes over it.

    python3 selftest.py

The synthetic tile has, on flat magenta:
  * a solid rust-coloured block with an ENCLOSED magenta pocket (the case
    segmentation removers fail)
  * a 1px teal hairline sticking out of the block (the case erosion fails)
  * an amber window inside the block (must survive the despill untouched)
  * a 50% magenta/50% tan mixed strip (the mesh case `--soft` exists for)
"""
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(sys.argv[0]))
CUT = os.path.join(HERE, "chroma-cut.py")
CHECK = os.path.join(HERE, "check-cutout.py")


def make_tile(path: str) -> None:
    w = h = 160
    a = np.zeros((h, w, 3), dtype=np.uint8)
    a[..., 0], a[..., 1], a[..., 2] = 255, 0, 255           # flat magenta
    a[40:120, 40:120] = (150, 82, 46)                       # rust block
    a[70:90, 70:90] = (255, 0, 255)                         # enclosed pocket
    a[100:108, 50:62] = (240, 170, 60)                      # amber window
    a[60, 120:150] = (63, 208, 216)                         # 1px teal hairline
    a[130:140, 40:120] = (217, 70, 172)                     # 50/50 mix of tan (180,140,90) over magenta
    Image.fromarray(a, "RGB").save(path)


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def main() -> int:
    fails = []
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, "tile.png")
        make_tile(src)

        out = os.path.join(d, "cut.png")
        r = run([sys.executable, CUT, src, out])
        if r.returncode != 0:
            print(r.stderr); return 1
        im = np.asarray(Image.open(out).convert("RGBA")).astype(int)
        A = im[..., 3]
        if A[80, 80] != 0: fails.append(f"enclosed pocket not cleared (alpha {A[80, 80]})")
        if A[10, 10] != 0: fails.append(f"outer background not cleared (alpha {A[10, 10]})")
        if A[60, 135] < 250: fails.append(f"1px hairline eaten (alpha {A[60, 135]})")
        if A[80, 50] < 250: fails.append(f"solid block not opaque (alpha {A[80, 50]})")
        win = im[104, 56, :3]
        if abs(int(win[0]) - 240) > 2 or abs(int(win[2]) - 60) > 2: fails.append(f"amber window altered by despill {win.tolist()}")
        strip_alpha = A[135, 80]
        # Default mode is EXPECTED to delete a 50/50 mixed strip — that's the
        # documented reason --soft exists. Assert it so a future "improvement"
        # that quietly changes the ramp is noticed.
        if strip_alpha != 0: fails.append(f"default mode kept the 50/50 strip (alpha {strip_alpha}); ramp changed?")

        soft = os.path.join(d, "soft.png")
        r = run([sys.executable, CUT, src, soft, "--soft"])
        if r.returncode != 0:
            print(r.stderr); return 1
        sm = np.asarray(Image.open(soft).convert("RGBA")).astype(int)
        sa = sm[135, 80, 3]
        if not (60 <= sa <= 200): fails.append(f"--soft did not keep the mixed strip as partial alpha (alpha {sa})")
        sr, sg, sb = sm[135, 80, :3]
        if min(sr, sb) - sg > 12: fails.append(f"--soft left a magenta tint on the strip {(sr, sg, sb)}")
        if sm[80, 80, 3] != 0: fails.append(f"--soft left film in the enclosed pocket (alpha {sm[80, 80, 3]})")

        r = run([sys.executable, CHECK, out])
        if r.returncode != 0: fails.append("check-cutout flagged the default cut:\n" + r.stdout)

    if fails:
        print("SELFTEST FAILED")
        for f in fails: print(" -", f)
        return 1
    print("selftest OK — pocket cleared, hairline kept, window untouched, --soft keeps mesh, checker clean")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
