"""No-erosion keying and coordinate fitting only; art edits were done by imagegen."""
from pathlib import Path
import json,subprocess,sys
import numpy as np
from PIL import Image,ImageDraw
P=Path(__file__).resolve().parent; repo=P.parents[2]
selected=['rotor-clock-faceless-v3','clock-hour-hand-v1','clock-minute-hand-v2']
for name in selected:
    dst=P/'keyed'/f'{name}.png'
    if not dst.exists():
        subprocess.run([sys.executable,str(repo/'.claude/skills/chroma-cutout/scripts/chroma-cut.py'),str(P/'sources'/f'{name}.png'),str(dst)],check=True)
im=Image.open(P/'keyed/rotor-clock-faceless-v3.png').convert('RGBA')
a=np.array(im)
# Measured against the cardinal ticks, not the outside plastic rim's bbox.
def dark_center(box):
    x0,y0,x1,y1=box;s=a[y0:y1,x0:x1]
    yy,xx=np.where((s[:,:,:3].max(axis=2)<90)&(s[:,:,3]>240))
    assert len(xx)>50
    return float(np.median(xx)+x0),float(np.median(yy)+y0)
top=dark_center((600,220,650,280));bottom=dark_center((600,990,650,1045))
left=dark_center((215,610,275,660));right=dark_center((970,610,1025,660))
source_pivot=((top[0]+bottom[0])/2,(left[1]+right[1])/2)
target=(380*.501,384*.4957)
box=im.getbbox(); px,py=source_pivot
# Complete silhouette, source-derived size, exact existing game pivot. Small safety margin.
scale=min((target[0]-1)/(px-box[0]),(379-target[0])/(box[2]-px),(target[1]-1)/(py-box[1]),(383-target[1])/(box[3]-py))
def fit(image,size,source,target,scale):
    if size==(380,384):
        return image.transform(size,Image.Transform.AFFINE,(1/scale,0,source[0]-target[0]/scale,0,1/scale,source[1]-target[1]/scale),Image.Resampling.BICUBIC)
    reduced=image.resize((round(image.width*scale),round(image.height*scale)),Image.Resampling.LANCZOS)
    sx,sy=reduced.width/image.width,reduced.height/image.height
    return reduced.transform(size,Image.Transform.AFFINE,(1,0,source[0]*sx-target[0],0,1,source[1]*sy-target[1]),Image.Resampling.BICUBIC)
face=fit(im,(380,384),source_pivot,target,scale)
face.save(P/'ready/rotor-clock-faceless-v1.webp',lossless=True)
meta={'face':{'file':'ready/rotor-clock-faceless-v1.webp','size':[380,384],'pivot':list(target),'pivotNormalized':[.501,.4957],'sourcePivot':list(source_pivot),'sourceScale':scale,'bbox':face.getbbox()},'hands':{}}
for name,length in [('clock-hour-hand-v1',160),('clock-minute-hand-v2',216)]:
    hand=Image.open(P/'keyed'/f'{name}.png').convert('RGBA')
    alpha=hand.getchannel('A'); binary=alpha.point(lambda v:255 if v>128 else 0)
    ImageDraw.floodfill(binary,(0,0),128)
    holes=np.array(binary)==0
    holes[:round(hand.height*.65)]=False
    ys,xs=np.where(holes); assert len(xs)>100
    pivot=(float(np.median(xs)),float(np.median(ys)))
    top=alpha.getbbox()[1];hs=length/(pivot[1]-top)
    fitted=fit(hand,(128,256),pivot,(64,240),hs)
    final='clock-minute-hand-v1' if 'minute' in name else name
    fitted.save(P/'ready'/f'{final}.webp',lossless=True)
    meta['hands'][final]={'file':f'ready/{final}.webp','size':[128,256],'pivot':[64,240],'tipLength':length,'sourcePivot':list(pivot),'clockScale':.55,'clockTipLength':length*.55}
(P/'anchors.json').write_text(json.dumps(meta,indent=2)+'\n')
records=[]
for f in sorted((P/'ready').glob('*.webp')):
    result=subprocess.run([sys.executable,str(repo/'.claude/skills/chroma-cutout/scripts/check-cutout.py'),str(f),'--json'],capture_output=True,text=True)
    r=json.loads(result.stdout);r['file']=f.relative_to(P).as_posix();records.append(r)
(P/'manifest.json').write_text(json.dumps(records,indent=2)+'\n')
# Review only: face on dark/light and hand geometry. No invented image content.
sheet=Image.new('RGB',(1000,560),'#17232b');draw=ImageDraw.Draw(sheet)
for col,bg in enumerate(['#17232b','#e9e5dc']):
    x=col*500;draw.rectangle((x,0,x+499,559),fill=bg)
    sheet.paste(face,(x+60,45),face)
    draw.text((x+20,15),'Hands-free face / existing pivot',fill='white' if col==0 else 'black')
    for idx,hand in enumerate(meta['hands'].values()):
        pic=Image.open(P/hand['file']);pic.thumbnail((64,128));sheet.paste(pic,(x+180+idx*70,425),pic)
sheet.save(P/'review-sheet.jpg',quality=94)
print(json.dumps(meta,indent=2));print([(r['file'],r['clean'],r['reasons']) for r in records])
