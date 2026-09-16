from pathlib import Path
from PIL import Image
import shutil,numpy as np,json
p=Path(__file__).resolve().parent
(p/'keyed').mkdir(exist_ok=True)
for f in (p/'ready').glob('*.webp'):
    n=p/'keyed'/f.name
    if not n.exists():shutil.copy2(f,n)
    im=Image.open(n).convert('RGBA');im.resize((1024,1024),Image.Resampling.LANCZOS).save(f,lossless=True)
im=Image.open(p/'ready/bumper-race-car-v1.webp').convert('RGBA');a=np.array(im).astype(int)
mask=(a[:,:,3]>=250)&(np.minimum(a[:,:,0],a[:,:,2])-a[:,:,1]>12)
ys,xs=np.where(mask);print(json.dumps({'count':len(xs),'bbox':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())]}))
out=Image.new('RGB',im.size,'#ddd');out.paste(im,mask=im.getchannel('A'));arr=np.array(out);arr[mask]=[0,255,0];Image.fromarray(arr).save(p/'race-car-tint-locations.png')
