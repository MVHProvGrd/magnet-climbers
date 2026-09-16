"""Preserve native keyed sources and fit complete alpha bounds into delivery sizes."""
from pathlib import Path
from PIL import Image
import shutil,json
p=Path(__file__).resolve().parent
(p/'keyed').mkdir(exist_ok=True)
for name,size in json.loads((p/'sizes.json').read_text()).items():
    f=p/'ready'/f'{name}.webp'; n=p/'keyed'/f.name
    if not f.exists(): continue
    if not n.exists(): shutil.copy2(f,n)
    im=Image.open(n).convert('RGBA'); im=im.crop(im.getbbox())
    im.thumbnail((size[0]-8,size[1]-8),Image.Resampling.LANCZOS)
    out=Image.new('RGBA',tuple(size));out.alpha_composite(im,((size[0]-im.width)//2,(size[1]-im.height)//2));out.save(f,lossless=True)
