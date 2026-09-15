import {createCanvas,loadImage} from '../../../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import '../../../public/art-archive/cat-paw-v2/review.js';
const root=dirname(fileURLToPath(import.meta.url));
const art=await loadImage(join(root,'ready/cat-paw-back-claws-v2.webp'));
const {draw}=globalThis.CatPawReview;
const sheet=createCanvas(1600,960),ctx=sheet.getContext('2d');
for(const [i,t] of [.2,.55,.72,.94,1.10,1.31,1.65,2.5].entries()){
 ctx.save();ctx.translate(i%4*400,Math.floor(i/4)*480);draw(ctx,t,art);ctx.restore();
}
await writeFile(join(root,'motion-review-sheet.png'),sheet.toBuffer('image/png'));
const qc=createCanvas(800,600),g=qc.getContext('2d');
for(let i=0;i<2;i++){g.fillStyle=i?'#f4f3ee':'#151c23';g.fillRect(i*400,0,400,600);g.drawImage(art,i*400,0,400,600);}
await writeFile(join(root,'cutout-review.png'),qc.toBuffer('image/png'));
if(process.argv.includes('--frames')){
 const dir=join(root,'frames');await mkdir(dir,{recursive:true});
 const canvas=createCanvas(400,480),c=canvas.getContext('2d');
 for(let i=0;i<128;i++){draw(c,i/20,art);await writeFile(join(dir,String(i).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));}
}
console.log('Paw review rendered.');
