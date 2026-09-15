import {createCanvas,loadImage} from '../../../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
await import('../../../public/art-archive/motion-v1/review.js');
const root=dirname(fileURLToPath(import.meta.url)), archive=dirname(root);
const art={lemon:await loadImage(join(archive,'10-hanging-keepsakes-v1/ready/lemon-keychain-v1.webp')),
 arm:await loadImage(join(root,'ready/kid-arm-open-v1.webp')),reach:await loadImage(join(root,'ready/reach-enamel-v2.webp')),
 oldReach:await loadImage(join(archive,'10-reach-badge-v1/reach-badge-v1.png'))};
const {drawScene,bump,step}=globalThis.MotionReview;
const sheet=createCanvas(1600,960),c=sheet.getContext('2d');
for(const [row,t] of [1.0,2.2].entries())for(const [col,mode] of ['lemon','side','bottom','reach'].entries()){
 c.save();c.translate(col*400,row*480);drawScene(c,mode,t,art,row?.3:-.3);c.restore();
}
await writeFile(join(root,'motion-review-sheet.png'),sheet.toBuffer('image/png'));
if(process.argv.includes('--frames')){
 const frames=join(root,'frames');await mkdir(frames,{recursive:true});
 const canvas=createCanvas(1200,480),g=canvas.getContext('2d');bump();
 for(let i=0;i<92;i++){step(.05);for(const [col,mode] of ['lemon','side','bottom'].entries()){
   g.save();g.translate(col*400,0);drawScene(g,mode,i*.05,art);g.restore();
 }await writeFile(join(frames,String(i).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));}
}
console.log('Rendered motion sheet'+(process.argv.includes('--frames')?' and 92 frames':''));
