from pathlib import Path
from PIL import Image
p=Path(__file__).resolve().parent
im=Image.open(p/'ready/paint-v1.webp').convert('RGBA')
im=im.crop(im.getbbox());im.thumbnail((236,236),Image.Resampling.LANCZOS)
out=Image.new('RGBA',(256,256));out.alpha_composite(im,((256-im.width)//2,(256-im.height)//2));out.save(p/'ready/paint.png')
