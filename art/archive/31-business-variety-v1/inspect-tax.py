from pathlib import Path
from PIL import Image
import numpy as np
p=Path(__file__).resolve().parent
im=Image.open(p/'ready/business-tax-prep-v1.webp').convert('RGBA')
a=np.array(im).astype(int)
mask=(a[:,:,3]>=250)&(np.minimum(a[:,:,0],a[:,:,2])-a[:,:,1]>12)
out=Image.new('RGB',im.size,'#dcdcdc');out.paste(im,mask=im.getchannel('A'))
arr=np.array(out);arr[mask]=[0,255,0]
Image.fromarray(arr).save(p/'tax-tint-locations.png')
print('Highlighted pixels:',int(mask.sum()))
