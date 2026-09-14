// Offline art QA. ART_QA_MODULE_ROOT may point to an existing checkout's node_modules.
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const modules = resolve(process.env.ART_QA_MODULE_ROOT || 'node_modules');
const { build } = await import(pathToFileURL(join(modules,'vite/dist/node/index.js')));
const { createCanvas } = await import(pathToFileURL(join(modules,'.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js')));
const out = resolve('node_modules/.cache/art-ready-qa');
await build({configFile:false,logLevel:'warn',build:{lib:{entry:'src/game/scenery-materials.ts',formats:['es'],fileName:()=> 'materials.mjs'},outDir:out,minify:false}});
globalThis.document={createElement:()=>createCanvas(256,256)};
const { drawSteel, drawSeam, drawPanelJoint }=await import(pathToFileURL(join(out,'materials.mjs')));
const canvas=createCanvas(800,1600), c=canvas.getContext('2d'); c.scale(2,2);
drawSteel(c,0,800); drawSeam(c,0,800);
for(const y of [0,340,680])drawPanelJoint(c,y);
const dest='art/archive/07-souvenir-ready-v1/previews';await mkdir(dest,{recursive:true});
await writeFile(join(dest,'actual-fridge-background.png'),canvas.toBuffer('image/png'));
console.log('Rendered actual current game steel, center seam and 340px panel joints.');
