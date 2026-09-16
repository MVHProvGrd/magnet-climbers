"""Pack the keyed avatars into public/art/avatars/sheet.webp: 96px cells, 12 per row, list order from avatars.json."""
import json, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "..", "..", "public", "art", "avatars")
AV = json.load(open(os.path.join(HERE, "avatars.json")))
CELL, COLS = 96, 12
rows = -(-len(AV) // COLS)
sheet = Image.new("RGBA", (COLS * CELL, rows * CELL))
contact = Image.new("RGBA", (COLS * CELL, rows * CELL), (40, 50, 60, 255))
for i, (aid, name, _) in enumerate(AV):
    im = Image.open(os.path.join(HERE, "ready", f"{aid}.webp")).convert("RGBA")
    box = im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()
    im = im.crop(box)
    # square-ish crop centred on the head area: fill the cell, allow a little bleed off the bottom for busts
    f = (CELL - 6) / max(im.width, im.height)
    im = im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.Resampling.LANCZOS)
    x, y = (i % COLS) * CELL + (CELL - im.width) // 2, (i // COLS) * CELL + (CELL - im.height) // 2
    sheet.alpha_composite(im, (x, y))
contact.alpha_composite(sheet)
os.makedirs(PUB, exist_ok=True)
sheet.save(os.path.join(PUB, "sheet.webp"), format="WEBP", quality=88, method=6)
contact.convert("RGB").save(os.path.join(HERE, "review-sheet.jpg"), quality=85)
print(len(AV), "avatars", sheet.size, os.path.getsize(os.path.join(PUB, "sheet.webp")) // 1024, "KB")
