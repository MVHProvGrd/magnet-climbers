// Uses the same optional @napi-rs/canvas dependency as library-visual.mjs.
import assert from "node:assert/strict";
import { build } from "vite";
import { createCanvas, GlobalFonts, loadImage } from "../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
if (existsSync("C:/Windows/Fonts/segoeui.ttf")) GlobalFonts.registerFromPath("C:/Windows/Fonts/segoeui.ttf", "system-ui");
await build({ configFile: false, logLevel: "warn", build: { lib: { entry: "tests/visual-entry.ts", formats: ["es"], fileName: () => "visual.mjs" }, outDir: "node_modules/.cache/magnet-climbers-render", minify: false } });
const api = await import(pathToFileURL(resolve("node_modules/.cache/magnet-climbers-render/visual.mjs")).href);
globalThis.document = { createElement: () => createCanvas(256, 256) }; api.setSound(false);
for (const theme of api.THEMES) {
  const image = await loadImage(`public/art/gadgets/${theme}.png`); api.setGadgetArt(theme, image);
  assert.equal(image.width, 256); assert.equal(image.height, 256);
  const c = createCanvas(256, 256), ctx = c.getContext("2d"); ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, 256, 256).data;
  assert.ok(pixels.some((v, i) => i % 4 === 3 && v === 0));
  assert.ok(pixels.some((v, i) => i % 4 === 3 && v === 255));
  const meta = JSON.parse(await readFile(`artifacts/gadgets/${theme}/pipeline-meta.json`, "utf8"));
  assert.deepEqual(meta.edge_touch_frames, []);
}
const sheet = createCanvas(1600, 720), ctx = sheet.getContext("2d");
const levels = Object.fromEntries(api.UPGRADES.map((u) => [u.key, 0]));
for (const [i, kind] of api.GADGET_KINDS.entries()) {
  const g = new api.Game(levels, { onPower() {}, onGameOver() {}, onCoins() {}, onGems() {} }, { seed: 12345, rules: "solo" });
  g.world.generateTo(18); g.phase = "running"; g.world.gadgetTime = 1.1;
  const segment = g.world.segments.find((s) => s.gadgets?.[0].kind === kind);
  g.camY = segment.y - 140; g.floorY = g.camY + 620; g.viewH = 640; g.time = 2;
  const hold = api.gadgetPose(segment.gadgets[0], g.world.gadgetTime).hold, c = g.climbers[0];
  Object.assign(c, { x: hold.x + 21, y: hold.y + 20, angle: 0, state: "flying", grip: undefined, ragdoll: undefined });
  if (g.world.isMetal(hold.x, hold.y)) { api.attachGrip(c, api.findContacts(c, g.world, 0).filter((p) => p.limb === 0)); c.state = "stuck"; }
  g.highestY = c.y; g.tricks.score = 150; g.tricks.combo = 2; g.tricks.lastAt = 1.5;
  const scene = createCanvas(400, 640), before = JSON.stringify(g.snapshot()); api.render(scene.getContext("2d"), g, 640, 1);
  assert.equal(JSON.stringify(g.snapshot()), before, "render cannot change the run");
  ctx.drawImage(scene, i * 400, 60); ctx.fillStyle = "#253b49"; ctx.fillRect(i * 400, 0, 400, 60);
  ctx.fillStyle = "#fff"; ctx.font = "bold 18px system-ui"; ctx.textAlign = "center"; ctx.fillText(kind.toUpperCase(), i * 400 + 200, 27);
  ctx.font = "12px system-ui"; ctx.fillText("Actual game render / moving grips + clear edge routes", i * 400 + 200, 47);
}
await writeFile("artifacts/gadget-gameplay.png", sheet.toBuffer("image/png"));
console.log("Verified three alpha sprites, no clipped edges, four real gameplay scenes and read-only drawing.");
