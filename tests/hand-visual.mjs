import assert from "node:assert/strict";
import { build } from "vite";
import { createCanvas, GlobalFonts } from "../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
if (existsSync("C:/Windows/Fonts/segoeui.ttf")) GlobalFonts.registerFromPath("C:/Windows/Fonts/segoeui.ttf", "system-ui");
await build({ configFile: false, logLevel: "warn", build: { lib: { entry: "tests/visual-entry.ts", formats: ["es"], fileName: () => "visual.mjs" }, outDir: "node_modules/.cache/magnet-climbers-render", minify: false } });
const { drawKidHand, drawSurface } = await import(pathToFileURL(resolve("node_modules/.cache/magnet-climbers-render/visual.mjs")).href);
globalThis.document = { createElement: () => createCanvas(256, 256) };
const sheet = createCanvas(1200, 940), ctx = sheet.getContext("2d");
const cases = [["WATCH THE ARC", "warn", 0.6, -1], ["REACH IN", "sweep", 0.29, -1], ["WRIST LEADS", "sweep", 0.44, -1], ["FOLLOW THROUGH", "sweep", 0.7, -1], ["RECOIL", "retract", 0.18, -1], ["RIGHT-SIDE VARIANT", "sweep", 0.48, 1]];
for (const [i, [title, phase, t, side]] of cases.entries()) {
  ctx.save(); ctx.translate(i % 3 * 400, Math.floor(i / 3) * 470); ctx.beginPath(); ctx.rect(0, 0, 400, 470); ctx.clip();
  drawSurface(ctx, 45, 470);
  const hand = { side, phase, t, x: 0, y: 215, hit: new Set() }, before = JSON.stringify(hand);
  drawKidHand(ctx, hand); assert.equal(JSON.stringify(hand), before);
  ctx.fillStyle = "#253b49"; ctx.fillRect(0, 0, 400, 45); ctx.fillStyle = "#fff"; ctx.font = "bold 16px system-ui"; ctx.textAlign = "center"; ctx.fillText(title, 200, 29); ctx.restore();
}
await writeFile("artifacts/kid-hand-swipe.png", sheet.toBuffer("image/png"));
console.log("Rendered warning, four arc poses and recoil. No render-state mutation.");
