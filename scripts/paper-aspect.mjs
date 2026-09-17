// Writes src/game/data/paper-aspect.json: the real shape of every photographed paper card,
// straight from the files that ship. World generation cuts a card's slot to its art, and a
// hand-written table went stale the moment a pack landed - paper-13 is 384x270 and was being
// cut square, so it drew at two thirds the height it should have.
// Run: node scripts/paper-aspect.mjs   (part of `npm run build`)
import { readdir, writeFile } from "node:fs/promises";
import { loadImage } from "../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js";

const dir = "public/art/paper";
const out = {};
for (const name of (await readdir(dir)).filter((n) => n.endsWith(".webp")).sort()) {
  const image = await loadImage(`${dir}/${name}`);
  out[name.replace(/\.webp$/, "")] = Number((image.width / image.height).toFixed(4));
}
await writeFile("src/game/data/paper-aspect.json", JSON.stringify(out, null, 1) + "\n");
console.log(`paper aspects: ${Object.keys(out).length} cards -> src/game/data/paper-aspect.json`);