from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json
p=Path(__file__).resolve().parent
im=Image.open(p/'ready/clip-coupon-sheet-v1.webp').convert('RGBA');a=np.array(im).astype(int)
mask=(a[:,:,3]>=250)&(np.minimum(a[:,:,0],a[:,:,2])-a[:,:,1]>12)
ys,xs=np.where(mask);print(json.dumps({'count':len(xs),'bbox':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())]}))
out=Image.new('RGB',im.size,'#dcdcdc');out.paste(im,mask=im.getchannel('A'));arr=np.array(out);arr[mask]=[0,255,0];Image.fromarray(arr).save(p/'coupon-tint-locations.png')
