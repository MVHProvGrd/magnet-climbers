"""Build a local-file-friendly audition page and explicit runtime-ID handoff map."""
import json
from pathlib import Path
from html import escape
ROOT=Path(__file__).resolve().parent
records=json.loads((ROOT/'manifest.json').read_text())
mapping={f'swing-{key}':key for key in ['keys','bottle-opener','disco-ball','rubber-duck','bead-lanyard','carabiner-whistle','wind-chime','baby-shoe','scissors','measuring-spoons','souvenir-spoon','fishing-lure']}
mapping.update({'swing-snack':'lemon','swing-travel':'trail','swing-doodle':'star'})
toys=['donut','rubber-duck','robot','dino','pop-out','penguin','taxi','race-car','banana','space-shuttle','letter-block','plastic-brick','gummy-bear']
for i,key in enumerate(toys):
    mapping[f'bumper-{i}']=key
    mapping[f'swing-toy-{i}']=key
for key in ['clock','pinwheel','thermometer','fidget-spinner']:
    mapping[f'rotor-{key}']=key
for theme in ['snack','travel','doodle']: mapping[f'rotor-{theme}']='alphabet-rotor'
data={'items':mapping,'bubbleEvents':{'inward':'pop-in','outward':'pop-out'},
      'note':'POP bumper/swing mapping is for lookup only: play once from the existing bubble event, never a second generic impact. These are samples, NOT engine effect names.'}
(ROOT/'item-map.json').write_text(json.dumps(data,indent=2)+'\n')
assert all(key in {r['id'] for r in records} for key in mapping.values())
cards=[]
for r in records:
    buttons=''.join(f'<button data-src="{v["file"]}" data-label="{escape(r["label"])} / take {i+1}">Take {i+1}</button>' for i,v in enumerate(r['variants']))
    cards.append(f'<article id="{r["id"]}"><h2>{escape(r["label"])}</h2><p>{escape(r["description"])}</p><div>{buttons}</div><small>{r["variants"][0]["seconds"]:.2f}s · <a href="{r["variants"][0]["file"]}">WAV</a></small></article>')
html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Object sounds — review only</title>
<style>*{box-sizing:border-box}body{background:#121820;color:#eef1f4;font:16px system-ui;margin:0;padding:24px;max-width:1200px;margin-inline:auto}header{position:sticky;top:0;background:#121820f5;padding:16px 0;z-index:1}h1{font-size:26px;margin:0 0 8px}p{color:#b8c5d1;line-height:1.45}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}article{background:#202b37;border:1px solid #354555;border-radius:16px;padding:18px}h2{font-size:19px;margin-top:0}button{background:#344c64;color:white;border:1px solid #637d96;border-radius:9px;padding:10px 14px;cursor:pointer;margin:4px 5px 8px 0}button:hover,button:focus-visible{background:#496984}a{color:#9bd5ff}small{display:block;color:#91a9bd}#status{min-height:24px;color:#f0d489}label{display:inline-flex;gap:10px;align-items:center;margin-right:16px}input{max-width:150px}</style></head><body>
<header><h1>Object-matched bump sounds</h1><p>33 original synthesized sound identities · 3 takes each · review candidates, not live. Start at low volume. No autoplay. This page works directly from disk.</p>
<label>Volume <input id="volume" type="range" min="0" max="1" step="0.01" value="0.55"></label><button id="stop">Stop</button><a href="../index.html">Art archive</a><div id="status" role="status">Choose a take. Fidget spinner is near the bottom.</div></header><main>CARDS</main>
<script>
let current=null;const volume=document.querySelector('#volume'),status=document.querySelector('#status');
function stop(){if(current){current.pause();current.src='';current=null;}status.textContent='Stopped';}
document.querySelector('#stop').onclick=stop;
volume.oninput=()=>{if(current)current.volume=Number(volume.value);};
document.querySelectorAll('[data-src]').forEach(button=>button.onclick=async()=>{
 stop();const sound=new Audio(button.dataset.src);current=sound;sound.volume=Number(volume.value);
 status.textContent=button.dataset.label;sound.onended=()=>{if(current===sound){current=null;status.textContent='Finished — '+button.dataset.label;}};
 try{await sound.play();}catch(e){if(current===sound)status.textContent='Could not play: '+e.message;}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
</script></body></html>'''.replace('CARDS','\n'.join(cards))
(ROOT/'index.html').write_text(html,encoding='utf-8')
print(f'Review page built; {len(mapping)} item IDs + directional bubble events mapped.')
