from pathlib import Path
from PIL import Image,ImageOps
p=Path(__file__).resolve().parent
sheet=Image.new('RGB',(1020,227),'#171a22')
for i,name in enumerate(['story-1-life','story-2-bedtime','story-3-climb']):
 source=name+('-v2' if i==2 else '')
 im=Image.open(p/'sources'/f'{source}.png').convert('RGB')
 im=ImageOps.fit(im,(768,512),method=Image.Resampling.LANCZOS)
 im.save(p/'ready'/f'{name}.webp',quality=94)
 sheet.paste(im.resize((340,227),Image.Resampling.LANCZOS),(340*i,0))
sheet.save(p/'phone-review.jpg',quality=95)
