"""Exact rotor sizing while preserving native cutout."""
from pathlib import Path
from PIL import Image
import shutil
p=Path(__file__).resolve().parent
f=p/'ready/rotor-snack-v1.webp'
(p/'keyed').mkdir(exist_ok=True)
n=p/'keyed'/f.name
if not n.exists(): shutil.copy2(f,n)
Image.open(n).resize((1024,1024),Image.Resampling.LANCZOS).save(f,lossless=True)
