"""Deterministic compositing for QA only; delivered layers unchanged."""
from pathlib import Path
from PIL import Image,ImageDraw
import math,json
P=Path(__file__).resolve().parent
meta=json.loads((P/'anchors.json').read_text());pivot=meta['face']['pivot']
face=Image.open(P/meta['face']['file']).convert('RGBA')
sheet=Image.new('RGB',(800,880),'#17232b');draw=ImageDraw.Draw(sheet)
for i,(hour,minute) in enumerate([(0,0),(3,0),(6,30),(10,10)]):
    tile=face.copy()
    for name,angle in [('clock-hour-hand-v1',((hour%12)+minute/60)*math.pi/6),('clock-minute-hand-v1',minute*math.pi/30)]:
        hand=Image.open(P/meta['hands'][name]['file']).convert('RGBA');c=math.cos(angle)/.55;s=math.sin(angle)/.55;px,py=pivot
        layer=hand.transform(face.size,Image.Transform.AFFINE,(c,s,64-c*px-s*py,-s,c,240+s*px-c*py),Image.Resampling.BICUBIC)
        tile=Image.alpha_composite(tile,layer)
    x=(i%2)*400+10;y=(i//2)*440+36
    sheet.paste(tile,(x,y),tile);draw.text((x,y-22),f'{hour or 12}:{minute:02d}',fill='white')
sheet.save(P/'clock-times-review.jpg',quality=95)
checks=json.loads((P/'manifest.json').read_text())
assert len(checks)==3 and all(x['clean'] for x in checks)
assert face.size==(380,384)
assert meta['face']['pivotNormalized']==[.501,.4957]
for h in meta['hands'].values():
    im=Image.open(P/h['file']);assert im.size==(128,256)
    assert im.getpixel((64,240))[3]==0, 'mount eye must remain transparent'
print('PASS: three alpha checks, dimensions, face pivot contract, both mounting eyes; four-time QA sheet generated.')
