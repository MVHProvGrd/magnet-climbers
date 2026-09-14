"""Extract approved review objects and remove their photographic backdrops.

Offline production step only; rembg segmentation, alpha trimming and resampling.
The source boards remain untouched. Run with an isolated rembg[cpu] environment.
"""
from pathlib import Path
from PIL import Image, ImageDraw
from rembg import remove, new_session
import json
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT/'art'/'review-alternatives'
session = new_session('u2net')
jobs = [
 ('pickups','coin','pickups.png',(55,145,335,425)),
 ('pickups','gem','pickups.png',(785,125,1055,415)),
 ('pickups','heart','pickups.png',(1145,140,1435,415)),
 ('pickups','magnet','pickups.png',(42,500,410,875)),
 ('pickups','reach','pickups.png',(465,520,1060,853)),
 ('pickups','slowmo','pickups.png',(1120,510,1450,850)),
 ('pickups','extra','pocket-pal.png',(45,65,530,740)),
 ('obstacles','attract','obstacles.png',(88,80,345,300)),
 ('obstacles','repel','obstacles.png',(480,80,755,300)),
 ('obstacles','glass','obstacles.png',(817,80,1163,301)),
 ('obstacles','plastic','obstacles.png',(1215,118,1565,262)),
 ('obstacles','gap','obstacles.png',(1660,43,1919,302)),
 ('obstacles','vent','obstacles.png',(35,448,380,650)),
 ('obstacles','dispenser','obstacles.png',(451,381,753,695)),
 ('obstacles','calendar','obstacles.png',(809,386,1159,690)),
 ('obstacles','ice-tray','obstacles.png',(1210,434,1572,653)),
 ('obstacles','handle','obstacles.png',(1599,482,1969,610)),
]
manifest=[]
for family, name, source, bounds in jobs:
    im=Image.open(SOURCE/source).convert('RGB').crop(bounds)
    im=remove(im, session=session).convert('RGBA')
    # The segmenter mistakes enclosed background for material. Clear only the
    # negative space between the red arms, using the red paint as its boundary.
    if name=='magnet':
        a=np.array(im); rgb=a[:,:,:3].astype(float)
        red=(rgb[:,:,0]>rgb[:,:,1]*1.45)&(rgb[:,:,0]>rgb[:,:,2]*1.45)&(rgb[:,:,0]>85)
        last=None
        for y in range(im.height):
            xs=np.flatnonzero(red[y]); mid=im.width//2
            left=xs[xs<mid];right=xs[xs>mid]
            if len(left)>8 and len(right)>8:
                l=int(left[-1])+2;r=int(right[0])-2
                if r-l>6:
                    a[y,l:r,3]=0
                    if last is None: a[:y,l:r,3]=0
                    last=(l,r)
        im=Image.fromarray(a)
    if name=='handle':
        # Negative spaces above/below the crossbar, between the two mounts.
        a=im.getchannel('A');mask=ImageDraw.Draw(a)
        mask.rectangle((66,0,300,45),fill=0)
        mask.rectangle((66,115,300,127),fill=0)
        im.putalpha(a)
    # Discard segmentation haze when finding the physical object's bounds.
    alpha=im.getchannel('A')
    bbox=alpha.point(lambda v: 255 if v>100 else 0).getbbox()
    if not bbox: raise RuntimeError(name+' has no foreground')
    im=im.crop(bbox)
    if family=='pickups':
        im.thumbnail((232,232),Image.Resampling.LANCZOS)
        canvas=Image.new('RGBA',(256,256))
        canvas.alpha_composite(im,((256-im.width)//2,(256-im.height)//2))
        im=canvas
    else:
        im.thumbnail((640,640),Image.Resampling.LANCZOS)
    dest=ROOT/'public'/'art'/'real-v1'/family/(name+'.png')
    dest.parent.mkdir(parents=True,exist_ok=True)
    im.save(dest,optimize=True)
    manifest.append(dict(id=name,family=family,source=source,crop=bounds,size=im.size))
    print(f'{family}/{name}: {im.size}',flush=True)
out=ROOT/'art'/'approved-import';out.mkdir(exist_ok=True)
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
# Inspect alpha edges and 34px readability on a steel-colored background.
sheet=Image.new('RGB',(1200,1000),'#b8c0c5');d=ImageDraw.Draw(sheet)
for i,j in enumerate(manifest):
    x=20+(i%5)*240;y=20+(i//5)*245
    im=Image.open(ROOT/'public'/'art'/'real-v1'/j['family']/(j['id']+'.png'))
    im.thumbnail((210,165),Image.Resampling.LANCZOS)
    sheet.paste(im,(x+(210-im.width)//2,y),im)
    d.text((x,y+175),j['family']+'/'+j['id'],fill='#17232b')
    if j['family']=='pickups':
        im.thumbnail((34,34),Image.Resampling.LANCZOS);sheet.paste(im,(x+80,y+198),im)
sheet.save(out/'import-contact-sheet.png')
