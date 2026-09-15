import {createCanvas,loadImage} from '../../../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js';
import {writeFile} from 'node:fs/promises';
const canvas=createCanvas(1200,1000),ctx=canvas.getContext('2d');
for(const [i,name] of ['cat-foreleg-long-v3','kid-arm-long-v2'].entries()){
 const img=await loadImage(new URL(`ready/${name}.webp`,import.meta.url));
 for(let bg=0;bg<2;bg++){
  const x=(i*2+bg)*300;ctx.fillStyle=bg?'#eeeae2':'#19252e';ctx.fillRect(x,0,300,1000);
  const s=290/img.width;ctx.drawImage(img,x+5,55,img.width*s,img.height*s);
  ctx.fillStyle=bg?'#18242b':'#fff';ctx.font='16px sans-serif';ctx.fillText(i?'LONG SLEEVE / BOTTOM':'LONG FORELEG / TOP',x+12,28);
 }
}
await writeFile(new URL('cutout-review.png',import.meta.url),canvas.toBuffer('image/png'));
