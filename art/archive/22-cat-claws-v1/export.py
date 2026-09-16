"""Fit generated sprites; retain native keyed originals for future fitting."""
from pathlib import Path
from PIL import Image,ImageDraw
import shutil
p=Path(__file__).resolve().parent
(p/'keyed').mkdir(exist_ok=True)
for f in (p/'ready').glob('*.webp'):
    native=p/'keyed'/f.name
    if not native.exists(): shutil.copy2(f,native)
    im=Image.open(native).convert('RGBA')
    if f.stem.startswith('cat'):
        im=im.resize((362,1085),Image.Resampling.LANCZOS)
    else:
        n=int(f.stem.split('-')[2]); heights={1:232,2:190,3:240}
        im=im.crop(im.getbbox()); im.thumbnail((42,heights[n]),Image.Resampling.LANCZOS)
        out=Image.new('RGBA',(64,256));out.alpha_composite(im,((64-im.width)//2,(256-im.height)//2));im=out
    im.save(f,lossless=True)
sheet=Image.new('RGB',(800,620),'#26343d'); d=ImageDraw.Draw(sheet)
for col,bg in enumerate(['#26343d','#deded9']):
    x=col*400;d.rectangle((x,0,x+399,619),fill=bg)
    im=Image.open(p/'ready/cat-paw-claws-v1.webp').convert('RGBA');im.thumbnail((180,540));sheet.paste(im,(x+10,35),im)
    for n in range(1,4):
        im=Image.open(p/f'ready/claw-mark-{n}-v1.webp').convert('RGBA');sheet.paste(im,(x+180+(n-1)*66,210),im)
    d.text((x+10,10),'Contact pose + 3 scratches',fill='white' if col==0 else 'black')
sheet.save(p/'export-review.jpg',quality=92)
