"""Fit keyed cutouts from packs 08/09 into the live public/art folders. Sources untouched. Run from any cwd."""
from pathlib import Path
from PIL import Image
import numpy as np
ROOT = Path(__file__).resolve().parent
PUB = ROOT.parent.parent / "public" / "art"
JOBS = [
    ("09-balanced-travel-v1/ready/attract-tahiti-v1.webp", "destinations/attract-tahiti.webp", (384, 384)),
    ("09-balanced-travel-v1/ready/attract-seychelles-v1.webp", "destinations/attract-seychelles.webp", (384, 384)),
    ("09-balanced-travel-v1/ready/attract-cape-town-v2.webp", "destinations/attract-cape-town.webp", (384, 384)),
    ("09-balanced-travel-v1/ready/attract-rio-v1.webp", "destinations/attract-rio.webp", (384, 384)),
    ("09-balanced-travel-v1/ready/repel-edinburgh-v1.webp", "destinations/repel-edinburgh.webp", (384, 384)),
    ("09-balanced-travel-v1/ready/repel-lapland-v1.webp", "destinations/repel-lapland.webp", (384, 384)),
    ("08-tactile-refresh-v1/ready/business-dentist-v1.webp", "business/business-0.webp", (480, 288)),
    ("08-tactile-refresh-v1/ready/business-pizza-v1.webp", "business/business-1.webp", (480, 288)),
    ("08-tactile-refresh-v1/ready/business-vet-v1.webp", "business/business-2.webp", (480, 288)),
    ("08-tactile-refresh-v1/ready/paper-grocery-v1.webp", "paper/paper-8.webp", (256, 384)),
]
for src, dst, size in JOBS:
    im = Image.open(ROOT / src).convert("RGBA")
    box = im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()
    im = im.crop(box)
    f = min((size[0] - 8) / im.width, (size[1] - 8) / im.height)
    dims = (round(im.width * f), round(im.height * f))
    im = im.resize(dims, Image.Resampling.LANCZOS)
    out = Image.new("RGBA", size); out.alpha_composite(im, ((size[0] - dims[0]) // 2, (size[1] - dims[1]) // 2))
    path = PUB / dst; path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path, format="WEBP", quality=92, method=6)
    a = np.asarray(Image.open(path).getchannel("A")); assert a.min() == 0 and a.max() == 255, dst
    print(dst, size, path.stat().st_size // 1024, "KB")
