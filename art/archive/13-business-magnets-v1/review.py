"""Build review composites and record alpha checks; preserve original cutouts."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
files = sorted((root / 'ready').glob('*.webp'))
sheet = Image.new('RGB', (1200, len(files) * 300), '#202933')
draw = ImageDraw.Draw(sheet)
records = []
for row, path in enumerate(files):
    im = Image.open(path).convert('RGBA')
    alpha = im.getchannel('A')
    w, h = im.size
    borders = [alpha.crop((0, 0, w, 1)), alpha.crop((0, h-1, w, h)),
               alpha.crop((0, 0, 1, h)), alpha.crop((w-1, 0, w, h))]
    clear = all(b.getextrema()[1] == 0 for b in borders)
    assert clear and alpha.getextrema() == (0, 255), path.name
    for col, color in enumerate(('#202933', '#ecede8')):
        tile = Image.new('RGBA', (600, 300), color)
        thumb = im.copy()
        thumb.thumbnail((550, 250), Image.Resampling.LANCZOS)
        tile.alpha_composite(thumb, ((600-thumb.width)//2, 35))
        sheet.paste(tile.convert('RGB'), (col*600, row*300))
    draw.text((12, row*300+8), path.name, fill='white')
    records.append({'file': 'ready/'+path.name, 'size': [w,h], 'clearBorder': clear,
                    'alphaRange': list(alpha.getextrema()), 'status': 'review-only-assembly'})
sheet.save(root / 'review-sheet.jpg', quality=94)
(root / 'manifest.json').write_text(json.dumps(records, indent=2)+'\n', encoding='utf-8')
print('Verified', len(records), 'cutouts; wrote review-sheet.jpg and manifest.json')
