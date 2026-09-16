"""Reproducible chroma cleanup/QC using existing no-erosion scripts."""
from pathlib import Path
import subprocess,sys,json
from PIL import Image,ImageDraw
pack=Path(__file__).resolve().parent
repo=pack.parents[2]
scripts=repo/'.claude/skills/chroma-cutout/scripts'
records=[]
retired={'attract-maldives-v1','attract-zanzibar-v1','repel-hokkaido-v1'}
for src in sorted((pack/'sources').glob('*.png')):
    if 'rejected' in src.stem: continue
    dst=pack/('_history/ready' if src.stem in retired else 'ready')/f'{src.stem}.webp'
    if not dst.exists():
        original=Image.open(src)
        if original.mode=='RGBA' and original.getchannel('A').getextrema()[0]==0:
            original.save(dst,lossless=True)
        else:
            subprocess.run([sys.executable,str(scripts/'chroma-cut.py'),str(src),str(dst)],check=True)
    result=subprocess.run([sys.executable,str(scripts/'check-cutout.py'),str(dst),'--json'],capture_output=True,text=True)
    record=json.loads(result.stdout);record['file']=dst.relative_to(pack).as_posix()
    record['selected']=src.stem not in retired;records.append(record)
(pack/'manifest.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf-8')
records=[r for r in records if r['selected']]
sheet=Image.new('RGB',(1200,len(records)*250),'#17232b');draw=ImageDraw.Draw(sheet)
for row,record in enumerate(records):
    im=Image.open(pack/record['file']).convert('RGBA');im=im.crop(im.getbbox());im.thumbnail((470,205))
    for col,bg in enumerate(['#17232b','#e9e5dc']):
        x,y=col*600,row*250;draw.rectangle((x,y,x+599,y+249),fill=bg)
        sheet.paste(im,(x+300-im.width//2,y+30),im)
        draw.text((x+12,y+8),Path(record['file']).stem+(' / PASS' if record['clean'] else ' / REVIEW'),fill='white' if col==0 else 'black')
sheet.save(pack/'review-sheet.jpg',quality=92)
print(json.dumps([{ 'file':r['file'],'clean':r['clean'],'reasons':r['reasons']} for r in records],indent=2))
