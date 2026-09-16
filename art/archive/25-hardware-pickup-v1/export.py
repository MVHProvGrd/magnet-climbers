"""Exact rotor sizing while preserving native cutout."""
from pathlib import Path
from PIL import Image,ImageOps
import shutil
p=Path(__file__).resolve().parent
(p/'keyed').mkdir(exist_ok=True)
for name in ['rotor-snack-v1','rotor-travel-v1','rotor-doodle-v1','pickup-candy-v1','door-gap-v4','grip-bar-v1']:
    f=p/'ready'/f'{name}.webp';n=p/'keyed'/f.name
    if not n.exists(): shutil.copy2(f,n)
    im=Image.open(n).convert('RGBA')
    if name in ['door-gap-v4','grip-bar-v1']:
        w,h,body=(768,160,112) if name=='door-gap-v4' else (512,128,56)
        im=im.crop(im.getbbox()).resize((w//2,body),Image.Resampling.LANCZOS)
        out=Image.new('RGBA',(w,h));out.alpha_composite(im,(0,(h-body)//2));out.alpha_composite(ImageOps.mirror(im),(w//2,(h-body)//2))
        assert out.getpixel((0,h//2))==out.getpixel((w-1,h//2))
        out.save(f,lossless=True)
    else: im.resize((1024,1024),Image.Resampling.LANCZOS).save(f,lossless=True)
