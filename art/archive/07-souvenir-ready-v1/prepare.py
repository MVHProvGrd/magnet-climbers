"""Prepare versioned art without changing live game assets. Run from any cwd."""
from pathlib import Path
import json
import subprocess
import sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'ready'
PREVIEW = ROOT / 'previews'
OUT.mkdir(exist_ok=True)
PREVIEW.mkdir(exist_ok=True)
JOBS = [
    ('attract-fiji', 'history/fiji-s.png', False, (384,384), None),
    ('repel-norway', 'history/norway-n.png', False, (384,384), None),
    ('attract-hawaii', 'sources/attract-hawaii-v1-magenta.png', True, (384,384), None),
    ('attract-bali', 'sources/attract-bali-v1-magenta.png', True, (384,384), None),
    ('repel-jurmala', 'sources/repel-jurmala-v1-magenta.png', True, (384,384), None),
    ('repel-kyiv', 'sources/repel-kyiv-v1-magenta.png', True, (384,384), None),
    ('repel-alaska', 'sources/repel-alaska-v1-magenta.png', True, (384,384), None),
    ('repel-iceland', 'sources/repel-iceland-v1-magenta.png', True, (384,384), None),
    ('crayon', 'history/crayon-v2-magenta.png', True, (640,192), None),
    ('candy-pole', 'history/candy-pole.png', False, (640,192), None),
    ('compass-base', 'sources/compass-base-v2-magenta.png', True, (512,512), (625,679)),
    ('compass-needle', 'sources/compass-needle-v1-magenta.png', True, (64,384), (511,760)),
    ('glass-door', 'sources/glass-door-v2-magenta.png', True, (384,640), None),
    ('glass-wide', 'history/glass-bottles-v2.png', False, (768,384), None),
    ('door-gap', 'sources/door-gap-v3-magenta.png', True, (768,160), None),
]
manifest = {'status':'ready-for-wiring-not-live', 'assets':{}, 'fieldEffects':{'attract':'blue inward', 'repel':'red outward'},
 'glassRule':'Split at world center x=195..205 (W=400); keep 8px inset at seam; use separate glass-door panels. Never nine-slice bottles.',
 'compassRule':'Rotate needle about its manifest pivot; place that pivot at compass-base pivot. Needle drawn height = base draw width * 0.47.',
 'gapRule':'Shallow horizontal trim texture only. Do not stretch to fill tall void collider. Keep existing procedural void treatment and NO_PHOTO until an explicit material layout integration.'}
for name, source, key, size, pivot in JOBS:
    src = ROOT / source
    if key:
        cut = PREVIEW / (name + '-keyed.png')
        subprocess.run([sys.executable,str(ROOT/'chroma-cut.py'),str(src),str(cut)],check=True)
        im = Image.open(cut).convert('RGBA')
    else:
        im = Image.open(src)
        if im.mode != 'RGBA': raise ValueError(f'{source}: missing alpha')
    a = im.getchannel('A')
    box = a.point(lambda v:255 if v>32 else 0).getbbox()
    if not box: raise ValueError('empty '+name)
    # Compass base preserves the source canvas so the dial pivot remains exact.
    if name=='compass-base': box=(0,0,im.width,im.height)
    im=im.crop(box)
    factor=min((size[0]-8)/im.width,(size[1]-8)/im.height)
    dims=(round(im.width*factor),round(im.height*factor))
    im=im.resize(dims,Image.Resampling.LANCZOS)
    dest=Image.new('RGBA',size)
    offset=((size[0]-dims[0])//2,(size[1]-dims[1])//2)
    dest.alpha_composite(im,offset)
    path=OUT/(name+'.webp')
    dest.save(path,format='WEBP',quality=92,method=6)
    check=Image.open(path).convert('RGBA')
    alpha=np.asarray(check.getchannel('A'))
    assert alpha.min()==0 and alpha.max()==255, name
    assert not np.any(alpha[0]) and not np.any(alpha[-1]) and not np.any(alpha[:,0]) and not np.any(alpha[:,-1]),name+' clipped'
    record={'file':'ready/'+name+'.webp','source':source,'size':list(size),'bytes':path.stat().st_size,
        'alpha':True,'clearBorder':True,'opaqueFraction':round(float(np.mean(alpha==255)),4)}
    if pivot: record['pivot']=[round((pivot[0]-box[0])*dims[0]/(box[2]-box[0])+offset[0],2),round((pivot[1]-box[1])*dims[1]/(box[3]-box[1])+offset[1],2)]
    manifest['assets'][name]=record
    comparison=Image.new('RGB',(size[0]*2,size[1]))
    for i,col in enumerate([(34,43,54),(234,239,241)]):
        bg=Image.new('RGBA',size,(*col,255));bg.alpha_composite(check)
        comparison.paste(bg.convert('RGB'),(size[0]*i,0))
    comparison.save(PREVIEW/(name+'-edges.jpg'),quality=95)

(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
sheet=Image.new('RGB',(1200,((len(JOBS)+2)//3)*340),'#293642'); d=ImageDraw.Draw(sheet)
for i,(name,record) in enumerate(manifest['assets'].items()):
    x=(i%3)*400; y=(i//3)*340
    d.text((x+15,y+12),name,fill='white')
    im=Image.open(ROOT/record['file']).convert('RGBA');im.thumbnail((350,270),Image.Resampling.LANCZOS)
    sheet.paste(im,(x+(400-im.width)//2,y+40+(270-im.height)//2),im)
sheet.save(ROOT/'ready-sheet.jpg',quality=94)
print(json.dumps({'ready':len(JOBS),'bytes':sum(a['bytes'] for a in manifest['assets'].values())}))
