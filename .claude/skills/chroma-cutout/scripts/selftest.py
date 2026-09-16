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
  * a saturated red patch (must survive too: red reads faintly "magenta" by the
    min(R,B)-G test, and a colour-only despill turned it near-black)
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
    a[44:60, 44:60] = (230, 57, 70)                         # saturated red patch (min(R,B)-G = 13: must NOT be despilled)
    a[130:140, 40:120] = (217, 70, 172)                     # 50/50 mix of tan (180,140,90) over magenta
    Image.fromarray(a, "RGB").save(path)


def make_green_tile(path: str) -> None:
    """The pink-subject case: magenta would eat this art, so it is keyed on green."""
    w = h = 160
    a = np.zeros((h, w, 3), dtype=np.uint8)
    a[..., 0], a[..., 1], a[..., 2] = 0, 255, 0             # flat green
    a[40:120, 40:120] = (244, 143, 177)                     # pink frosting block
    a[70:90, 70:90] = (0, 255, 0)                           # enclosed pocket
    a[60, 120:150] = (255, 0, 255)                          # 1px magenta hairline (would die on a magenta key)
    Image.fromarray(a, "RGB").save(path)


def make_offhue_tile(path: str) -> None:
    """What generators actually return: a perfectly FLAT but off-hue screen.
    Asked for #FF00FF, Gemini paints rose (235,32,138). --key=auto samples it."""
    w = h = 160
    a = np.zeros((h, w, 3), dtype=np.uint8)
    a[..., 0], a[..., 1], a[..., 2] = 235, 32, 138          # flat rose "magenta"
    a[40:120, 40:120] = (244, 143, 177)                     # pink art, close to the screen in hue
    a[70:90, 70:90] = (235, 32, 138)                        # enclosed pocket of screen
    a[60, 120:150] = (63, 208, 216)                         # 1px teal hairline
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
        red = im[52, 52, :3]
        if abs(int(red[0]) - 230) > 2 or abs(int(red[2]) - 70) > 2: fails.append(f"saturated red crushed by despill {red.tolist()}")
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

        # --key=green: the escape hatch for pink subjects must key just as cleanly.
        gsrc, gout = os.path.join(d, "green.png"), os.path.join(d, "green-cut.png")
        make_green_tile(gsrc)
        r = run([sys.executable, CUT, gsrc, gout, "--key=green"])
        if r.returncode != 0:
            print(r.stderr); return 1
        gm = np.asarray(Image.open(gout).convert("RGBA")).astype(int)
        if gm[80, 80, 3] != 0: fails.append(f"green key left the enclosed pocket (alpha {gm[80, 80, 3]})")
        if gm[10, 10, 3] != 0: fails.append(f"green key left the background (alpha {gm[10, 10, 3]})")
        pink = gm[50, 50, :3]
        if abs(int(pink[0]) - 244) > 2 or abs(int(pink[2]) - 177) > 2: fails.append(f"green key altered the pink art {pink.tolist()}")
        if gm[60, 135, 3] < 250: fails.append(f"green key ate the magenta hairline (alpha {gm[60, 135, 3]})")
        r = run([sys.executable, CHECK, gout, "--key=green"])
        if r.returncode != 0: fails.append("check-cutout flagged the green cut:\n" + r.stdout)

        # --key=auto: flat but off-hue screens are the common real-world case.
        asrc, aout = os.path.join(d, "offhue.png"), os.path.join(d, "offhue-cut.png")
        make_offhue_tile(asrc)
        r = run([sys.executable, CUT, asrc, aout, "--key=auto"])
        if r.returncode != 0:
            print(r.stderr); return 1
        am = np.asarray(Image.open(aout).convert("RGBA")).astype(int)
        if am[10, 10, 3] != 0: fails.append(f"auto key left the off-hue background (alpha {am[10, 10, 3]})")
        if am[80, 80, 3] != 0: fails.append(f"auto key left the enclosed pocket (alpha {am[80, 80, 3]})")
        if am[50, 50, 3] < 250: fails.append(f"auto key ate the pink art (alpha {am[50, 50, 3]})")
        apink = am[50, 50, :3]
        if abs(int(apink[0]) - 244) > 3 or abs(int(apink[2]) - 177) > 3: fails.append(f"auto key altered the pink art {apink.tolist()}")
        if am[60, 135, 3] < 250: fails.append(f"auto key ate the 1px hairline (alpha {am[60, 135, 3]})")
        # A gradient backdrop must still be refused rather than rescued.
        gsrc2 = os.path.join(d, "gradient.png")
        grad = np.zeros((160, 160, 3), dtype=np.uint8)
        grad[..., 0] = np.linspace(180, 255, 160, dtype=np.uint8)[None, :]
        grad[..., 2] = 200
        Image.fromarray(grad, "RGB").save(gsrc2)
        if run([sys.executable, CUT, gsrc2, os.path.join(d, "g.png"), "--key=auto"]).returncode == 0:
            fails.append("auto key accepted a gradient backdrop; it must refuse and ask for a regeneration")

    if fails:
        print("SELFTEST FAILED")
        for f in fails: print(" -", f)
        return 1
    print("selftest OK — pocket cleared, hairline kept, window/red untouched, --soft keeps mesh, --key=green and --key=auto clean")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
