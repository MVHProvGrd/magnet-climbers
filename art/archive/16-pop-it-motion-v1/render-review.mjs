import {createCanvas,loadImage} from '../../../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js';
import {writeFile} from 'node:fs/promises';
import '../../../public/art-archive/pop-it-v1/review.js';
const art=await loadImage(new URL('../14-toy-bumper-keychains-v1/ready/bumper-4-v1.webp',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const {draw,toggle,state}=globalThis.PopItReview;
const sheet=createCanvas(840,936),c=sheet.getContext('2d');draw(c,art,1);
for(let i=0;i<10;i++){const before=state[i];toggle(i,1);if(state[i]===before)throw Error('State failed');}
c.save();c.translate(0,468);draw(c,art,2);c.restore();
await writeFile(new URL('motion-review-sheet.png',import.meta.url),sheet.toBuffer('image/png'));
console.log('Rendered original and all bubbles toggled; ten state transitions checked.');
