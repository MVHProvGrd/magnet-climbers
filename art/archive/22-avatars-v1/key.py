"""Hard magenta key for flat cartoon stickers. Same alpha ramp as chroma-cut.py, but despill ONLY inside the
antialias band: the shared keyer caps R wherever min(R,B)-G > 6, which turns saturated reds (horseshoe, candy
cane, vampire cape) black. Cartoon art has hard edges, so the rim is all the spill there is."""
import sys, numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
cast = np.minimum(R, B) - G
LO, HI = 24.0, 66.0
alpha = np.clip((HI - cast) / (HI - LO), 0.0, 1.0)
rim = (alpha > 0) & (alpha < 1)
lim = G + 12.0
R2 = np.where(rim, np.minimum(R, lim), R)
B2 = np.where(rim, np.minimum(B, lim), B)
out = np.dstack([R2, G, B2, alpha * 255.0]).astype(np.uint8)
Image.fromarray(out, "RGBA").save(dst, format="WEBP", lossless=True)
