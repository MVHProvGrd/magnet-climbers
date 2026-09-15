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
    # pack 10 hanging keepsakes: clipped papers become the clip gadgets' charms, the cat photo a paper card
    ("10-hanging-keepsakes-v1/ready/pancake-recipe-v1.webp", "gadgets/clip-snack.webp", (384, 384)),
    ("10-hanging-keepsakes-v1/ready/seaside-postcard-v1.webp", "gadgets/clip-travel.webp", (384, 384)),
    ("10-hanging-keepsakes-v1/ready/dinosaur-drawing-v1.webp", "gadgets/clip-doodle.webp", (384, 384)),
    ("10-hanging-keepsakes-v1/ready/cat-snapshot-v1.webp", "paper/paper-1.webp", (320, 384)),
    # pack 13: the other five business magnets
    *[(f"13-business-magnets-v1/ready/business-{n}-v1.webp", f"business/business-{n}.webp", (480, 288)) for n in range(3, 8)],
    # pack 14: toy bumpers as keychain payloads (hardware layer comes from the lemon at runtime)
    *[(f"14-toy-bumper-keychains-v1/ready/bumper-{n}-v1.webp", f"bumpers/bumper-{n}.webp", (320, 240)) for n in range(0, 5)],
    # pack 19: clean robot (replaces pack 14's), COOL penguin, six photographed papers; papers keep their own shape
    ("19-bumpers-paper-v1/ready/bumper-2-v2.webp", "bumpers/bumper-2.webp", (320, 240)),
    ("19-bumpers-paper-v1/ready/bumper-5-v1.webp", "bumpers/bumper-5.webp", (320, 240)),
    *[(f"19-bumpers-paper-v1/ready/paper-{n}.webp", f"paper/paper-{n.split('-')[0]}.webp", (384, 384)) for n in ("0-v1", "2-v2", "3-v2", "4-v1", "5-v1", "6-v1")],
    # pack 20: four more photographed notes
    *[(f"20-paper-notes-v1/ready/paper-{n}-v1.webp", f"paper/paper-{n}.webp", (384, 384)) for n in (7, 9, 10, 11)],
    # lemon keychain keeps its full source frame so the hook pivot (510,285 of 1024x1536) stays a fixed fraction
    ("10-hanging-keepsakes-v1/ready/lemon-keychain-v1.webp", "gadgets/swing-snack.webp", None),
]
for src, dst, size in JOBS:
    im = Image.open(ROOT / src).convert("RGBA")
    if size is None:
        # no crop, quarter scale: pivots given as fractions of the source stay valid
        out = im.resize((im.width // 4, im.height // 4), Image.Resampling.LANCZOS); size = out.size
    else:
        box = im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()
        im = im.crop(box)
        f = min((size[0] - 8) / im.width, (size[1] - 8) / im.height)
        dims = (round(im.width * f), round(im.height * f))
        im = im.resize(dims, Image.Resampling.LANCZOS)
        # tight canvas at the object's own proportions so contain-fit placement is exact
        size = (dims[0] + 8, dims[1] + 8)
        out = Image.new("RGBA", size); out.alpha_composite(im, (4, 4))
    path = PUB / dst; path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path, format="WEBP", quality=92, method=6)
    a = np.asarray(Image.open(path).getchannel("A")); assert a.min() == 0 and a.max() == 255, dst
    print(dst, size, path.stat().st_size // 1024, "KB")
