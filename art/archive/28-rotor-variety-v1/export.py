"""Center visually measured spindle positions; preserve native images."""
from pathlib import Path
from PIL import Image
import numpy as np,shutil,json
p=Path(__file__).resolve().parent
pivots={'rotor-clock-v1':(625,604),'rotor-pinwheel-v1':(627,629),'rotor-thermometer-v1':(627,644),'rotor-fidget-spinner-v1':(627,694)}
(p/'keyed').mkdir(exist_ok=True)
for name,(cx,cy) in pivots.items():
    f=p/'ready'/f'{name}.webp';n=p/'keyed'/f.name
    if not n.exists():shutil.copy2(f,n)
    im=Image.open(n).convert('RGBA');a=np.asarray(im)[:,:,3];ys,xs=np.where(a>8)
    radius=np.sqrt((xs-cx)**2+(ys-cy)**2).max();s=474/radius
    l,t,r,b=im.getbbox();im=im.crop((l,t,r,b));im=im.resize((round(im.width*s),round(im.height*s)),Image.Resampling.LANCZOS)
    out=Image.new('RGBA',(1024,1024));out.alpha_composite(im,(round(512-(cx-l)*s),round(512-(cy-t)*s)));out.save(f,lossless=True)
(p/'pivots.json').write_text(json.dumps({'native_measured_estimates':pivots,'export_pivot':[512,512],'export_size':[1024,1024]},indent=2)+'\n')
