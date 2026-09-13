// Asset optimization only; source artwork is made with the built-in image tool.
// Uses the optional Canvas dependency documented in tests/visual.mjs.
import { createCanvas, loadImage } from "../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js";
import { writeFile } from "node:fs/promises";
const source = process.argv[2];
if (!source) throw new Error("Usage: node tests/prepare-title-art.mjs <generated-image-path>");
const image = await loadImage(source), width = 720, height = Math.round(image.height * width / image.width);
const canvas = createCanvas(width, height), ctx = canvas.getContext("2d");
ctx.drawImage(image, 0, 0, width, height);
const bytes = canvas.toBuffer("image/webp", 88);
await writeFile("public/art/title-fridge.webp", bytes);
console.log(`Title background optimized: ${width}x${height}, ${Math.round(bytes.length / 1024)} KiB`);
