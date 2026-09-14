// Renders the hand-drawn canvas art into art/archive/01-canvas-drawn. Needs the optional @napi-rs/canvas install (see tests/visual.mjs).
import { build } from "vite";
import { createCanvas } from "../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url"; import { resolve } from "node:path";
await build({ configFile: false, logLevel: "warn", build: { lib: { entry: "tests/art-archive-entry.ts", formats: ["es"], fileName: () => "archive.mjs" }, outDir: "node_modules/.cache/magnet-climbers-render", minify: false } });
const m = await import(pathToFileURL(resolve("node_modules/.cache/magnet-climbers-render/archive.mjs")).href);
globalThis.document = { createElement: () => createCanvas(256, 256) }; m.setSound(false);
const out = "art/archive/01-canvas-drawn"; await mkdir(out + "/pickups-badges", { recursive: true }); await mkdir(out + "/pickups-objects", { recursive: true }); await mkdir(out + "/obstacles", { recursive: true }); await mkdir(out + "/stickers", { recursive: true }); await mkdir(out + "/bumpers", { recursive: true });
const S = 4;
const tile = (w, h, draw) => { const c = createCanvas(w * S, h * S), g = c.getContext("2d"); g.scale(S, S); draw(g); return c; };
const kinds = ["coin", "gem", "magnet", "extra", "slowmo", "reach", "heart"];
const sheets = [];
const sheet = (name, tiles, tw, th) => { const cols = Math.min(6, tiles.length), rows = Math.ceil(tiles.length / cols); const c = createCanvas(cols * (tw * S + 16) + 16, rows * (th * S + 40) + 16), g = c.getContext("2d"); g.fillStyle = "#c9d1d8"; g.fillRect(0, 0, c.width, c.height); g.fillStyle = "#243040"; g.font = "bold 18px sans-serif"; tiles.forEach(([label, img], i) => { const x = 16 + (i % cols) * (tw * S + 16), y = 16 + Math.floor(i / cols) * (th * S + 40); g.drawImage(img, x, y); g.fillText(label, x, y + th * S + 24); }); sheets.push([name, c]); };
let t = [];
for (const k of kinds) { const c = tile(48, 48, (g) => m.drawLegacyPower(g, { x: 24, y: 24, kind: k, taken: false, bob: 0 }, 0)); await writeFile(`${out}/pickups-badges/${k}.png`, c.toBuffer("image/png")); t.push([k, c]); }
sheet("pickups-badges", t, 48, 48); t = [];
for (const k of kinds) { const c = tile(48, 48, (g) => { g.translate(24, 24); m.drawPickupObject(g, k); }); await writeFile(`${out}/pickups-objects/${k}.png`, c.toBuffer("image/png")); t.push([k, c]); }
sheet("pickups-objects", t, 48, 48); t = [];
for (const k of ["glass", "plastic", "gap", "vent"]) { const c = tile(100, 100, (g) => m.drawObstacleObject(g, k)); await writeFile(`${out}/obstacles/${k}.png`, c.toBuffer("image/png")); t.push([k, c]); }
for (const [k, repel] of [["attract", false], ["repel", true]]) { const c = tile(100, 100, (g) => m.drawFieldMagnet(g, { x: 5, y: 5, w: 90, h: 90, kind: k }, repel)); await writeFile(`${out}/obstacles/${k}.png`, c.toBuffer("image/png")); t.push([k, c]); }
for (let v = 0; v < 4; v++) { const c = tile(100, 40, (g) => m.drawHardwareGrip(g, { x: 5, y: 8, w: 90, h: 24 }, v)); await writeFile(`${out}/obstacles/handle-${v}.png`, c.toBuffer("image/png")); t.push([`handle-${v}`, c]); }
for (const [id, n] of [["dispenser", 20], ["calendar", 21], ["ice-tray", 22]]) { const c = tile(100, 100, (g) => m.drawObject(g, n)); await writeFile(`${out}/obstacles/${id}.png`, c.toBuffer("image/png")); t.push([id, c]); }
sheet("obstacles", t, 100, 100); t = [];
for (let v = 0; v < 12; v++) { const c = tile(100, 100, (g) => m.drawPaperPrint(g, v)); await writeFile(`${out}/stickers/paper-${v}.png`, c.toBuffer("image/png")); t.push([`paper-${v}`, c]); }
for (let v = 0; v < 12; v++) { const c = tile(100, 100, (g) => m.drawBusinessMagnet(g, v)); await writeFile(`${out}/stickers/business-${v}.png`, c.toBuffer("image/png")); t.push([`business-${v}`, c]); }
sheet("stickers", t, 100, 100); t = [];
for (const item of m.FRIDGE_ITEMS.filter((i) => i.family === "bumper")) { const c = tile(100, 60, (g) => m.drawBumper(g, { x: 5, y: 10, w: 90, h: 40, vx: 0, minX: 0, maxX: 100, label: item.label, hue: item.hue, itemId: item.id, motion: "slide", vy: 0, minY: 10, maxY: 10 })); await writeFile(`${out}/bumpers/${item.id}.png`, c.toBuffer("image/png")); t.push([item.id, c]); }
sheet("bumpers", t, 100, 60);
for (const [name, c] of sheets) await writeFile(`${out}/${name}-sheet.png`, c.toBuffer("image/png"));
console.log("done", sheets.map(s => s[0]).join(", "));
