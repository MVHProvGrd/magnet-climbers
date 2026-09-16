from pathlib import Path
from PIL import Image
import numpy as np
p=Path(__file__).resolve().parent
im=Image.open(p/'ready/attract-maldives-v2.webp').convert('RGBA');a=np.array(im).astype(int)
mask=(a[:,:,3]>=250)&(np.minimum(a[:,:,0],a[:,:,2])-a[:,:,1]>12)&(np.minimum(a[:,:,0],a[:,:,2])>0.55*np.maximum(a[:,:,0],a[:,:,2]))
out=Image.new('RGB',im.size,'#dcdcdc');out.paste(im,mask=im.getchannel('A'))
arr=np.array(out);arr[mask]=[0,255,0]
Image.fromarray(arr).save(p/'maldives-tint-locations.png')
