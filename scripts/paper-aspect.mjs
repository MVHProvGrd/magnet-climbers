// Writes src/game/data/paper-aspect.json: the real shape of every photographed paper card,
// straight from the files that ship. World generation cuts a card's slot to its art, and a
// hand-written table went stale the moment a pack landed - paper-13 is 384x270 and was being
// cut square, so it drew at two thirds the height it should have.
//
// It reads the image headers itself rather than decoding the pictures: this runs in CI, where
// the sandbox's canvas cache does not exist, and a width and a height are four numbers.
// Run: node scripts/paper-aspect.mjs   (part of `npm run build`)
import { readdir, readFile, writeFile } from "node:fs/promises";

/** Width and height from a PNG or WebP header. Throws rather than guessing. */
function imageSize(buf, name) {
  if (buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    const kind = buf.toString("latin1", 12, 16);
    // lossy: the frame header carries 14-bit dimensions; lossless packs them into 28 bits;
    // extended puts them up front as two 24-bit values, each one less than the real size
    if (kind === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") {
      const b = [buf[21], buf[22], buf[23], buf[24]];
      return { w: 1 + (((b[1] & 0x3f) << 8) | b[0]), h: 1 + (((b[3] & 0x0f) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6)) };
    }
    if (kind === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  }
  throw new Error(`${name}: not a PNG or WebP this script can measure`);
}

const dir = "public/art/paper";
const out = {};
for (const name of (await readdir(dir)).filter((n) => /\.(webp|png)$/.test(n)).sort()) {
  const { w, h } = imageSize(await readFile(`${dir}/${name}`), name);
  if (!(w > 0 && h > 0)) throw new Error(`${name}: measured ${w}x${h}`);
  out[name.replace(/\.(webp|png)$/, "")] = Number((w / h).toFixed(4));
}
await writeFile("src/game/data/paper-aspect.json", JSON.stringify(out, null, 1) + "\n");
console.log(`paper aspects: ${Object.keys(out).length} cards -> src/game/data/paper-aspect.json`);
