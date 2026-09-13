// Optional isolated @napi-rs/canvas dependency, as documented in visual.mjs.
import assert from "node:assert/strict";
import { build } from "vite";
import { createCanvas, GlobalFonts, loadImage } from "../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
if (existsSync("C:/Windows/Fonts/segoeui.ttf")) GlobalFonts.registerFromPath("C:/Windows/Fonts/segoeui.ttf", "system-ui");
await build({ configFile: false, logLevel: "warn", build: { lib: { entry: "tests/visual-entry.ts", formats: ["es"], fileName: () => "visual.mjs" }, outDir: "node_modules/.cache/magnet-climbers-render", minify: false } });
const api = await import(pathToFileURL(resolve("node_modules/.cache/magnet-climbers-render/visual.mjs")).href);
for (const theme of api.THEMES) api.setGadgetArt(theme, await loadImage(`public/art/gadgets/${theme}.png`));
const { Game, UPGRADES, FRIDGE_ITEMS, drawItemPreview, drawClimber, drawClimberShadow, resetRagdoll, stepRagdoll, braceLanding, stepGrip, SET_PIECES, populateSetPiece, drawSurface, drawZone, drawPower, setSound } = api;
globalThis.document = { createElement: () => createCanvas(256, 256) }; setSound(false);
const levels = Object.fromEntries(UPGRADES.map((u) => [u.key, 0]));
const events = { onPower() {}, onGameOver() {}, onCoins() {}, onGems() {} };
const game = new Game(levels, events, { seed: 12345, rules: "solo" });
const library = createCanvas(1000, 60 + Math.ceil(FRIDGE_ITEMS.length / 7) * 184), ctx = library.getContext("2d");
ctx.fillStyle = "#192733"; ctx.fillRect(0, 0, 1000, library.height);
ctx.fillStyle = "#fff4d7"; ctx.font = "bold 25px system-ui"; ctx.fillText(`THE FRIDGE FIELD GUIDE / ${FRIDGE_ITEMS.length} ITEMS`, 24, 39);
for (let i = 0; i < FRIDGE_ITEMS.length; i++) {
  const x = 10 + i % 7 * 142, y = 60 + Math.floor(i / 7) * 184;
  ctx.fillStyle = "#b8c7ce"; ctx.beginPath(); ctx.roundRect(x, y, 132, 174, 10); ctx.fill();
  ctx.save(); ctx.translate(x + 11, y + 6); ctx.scale(1.1, 1.1); drawItemPreview(ctx, FRIDGE_ITEMS[i]); ctx.restore();
  ctx.fillStyle = "#283e4e"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "center"; ctx.fillText(FRIDGE_ITEMS[i].name, x + 66, y + 137);
  ctx.font = "10px system-ui"; ctx.fillText(FRIDGE_ITEMS[i].family.toUpperCase(), x + 66, y + 155);
}
const poses = createCanvas(1200, 590), p = poses.getContext("2d");
p.fillStyle = "#263846"; p.fillRect(0, 0, 1200, 590);
p.fillStyle = "#fff"; p.font = "bold 24px system-ui"; p.fillText("RAGDOLL FLIGHT / ARMS AND LEGS LAG, TUCK AND UNFOLD", 22, 35);
const toy = { ...game.climbers[0], state: "flying", grip: undefined, x: 100, y: -100, angle: 0.1, spin: 4.5, vx: 170, vy: -620, airTime: 0 };
resetRagdoll(toy);
for (let frame = 0; frame < 6; frame++) {
  for (let j = 0; j < 15; j++) { toy.vy += 800 / 120; toy.angle += toy.spin / 120; toy.airTime += 1 / 120; stepRagdoll(toy, 1 / 120); }
  const x = frame * 200;
  p.fillStyle = "#c6d2d5"; p.fillRect(x + 6, 58, 188, 245);
  p.save(); p.translate(x + 100, 178); p.scale(2.5, 2.5); p.translate(-toy.x, -toy.y);
  const before = JSON.stringify(toy); drawClimberShadow(p, toy); drawClimber(p, toy, false, 0); assert.equal(JSON.stringify(toy), before); p.restore();
  p.fillStyle = "#334956"; p.font = "bold 13px system-ui"; p.textAlign = "center"; p.fillText(`${toy.airTime.toFixed(2)}s`, x + 100, 282);
}
for (const [i, angle] of [0.7, Math.PI - 0.6].entries()) {
  const c = { ...toy, x: 100, y: -100, angle, state: "flying", grip: undefined };
  assert.ok(braceLanding(c, game.world)); c.state = "stuck";
  for (let j = 0; j < 240; j++) stepGrip(c, 1 / 120);
  p.fillStyle = "#c6d2d5"; p.fillRect(12 + i * 390, 325, 375, 247);
  p.save(); p.translate(105 + i * 390, 447); p.scale(2.7, 2.7); p.translate(-c.x, -c.y); drawClimberShadow(p, c); drawClimber(p, c, false, 0); p.restore();
  p.fillStyle = "#334956"; p.font = "bold 17px system-ui"; p.textAlign = "left"; p.fillText(i ? "HANDSTAND" : "FEET FIRST", 204 + i * 390, 420);
  p.font = "13px system-ui"; p.fillText("Two fixed magnets", 204 + i * 390, 451); p.fillText("Spring-settled torso", 204 + i * 390, 474);
}
p.fillStyle = "#dce7ea"; p.font = "15px system-ui"; p.fillText("Same readable flight arc.", 820, 406); p.fillText("Articulated magnetic tips.", 820, 439); p.fillText("One-tip swings still work.", 820, 472);
const layouts = createCanvas(1600, 470), l = layouts.getContext("2d");
for (let i = 0; i < 4; i++) {
  l.save(); l.translate(i * 400, 65); drawSurface(l, 0, 405);
  const segment = { y: 20, h: 340, zones: [], bumpers: [], powerUps: [{ x: 0, y: 0, kind: "coin", bob: 0, taken: false }] };
  populateSetPiece(segment, SET_PIECES[i], i % 2 === 1);
  const before = JSON.stringify(segment);
  for (const z of segment.zones) drawZone(l, z, 2, 42);
  for (const power of segment.powerUps) drawPower(l, power, 0);
  assert.equal(JSON.stringify(segment), before); l.restore();
  l.fillStyle = "#223543"; l.fillRect(i * 400, 0, 400, 65);
  l.fillStyle = "#fff"; l.font = "bold 17px system-ui"; l.textAlign = "center"; l.fillText(SET_PIECES[i].toUpperCase(), i * 400 + 200, 28);
  l.font = "12px system-ui"; l.fillText("Clear steel lane + optional handle route", i * 400 + 200, 49);
}
await mkdir("artifacts", { recursive: true });
for (const [name, canvas] of [["fridge-field-guide", library], ["ragdoll-flight", poses], ["obstacle-layouts", layouts]]) await writeFile(`artifacts/${name}.png`, canvas.toBuffer("image/png"));
console.log(`Rendered all ${FRIDGE_ITEMS.length} items, six flight frames, two upright landings and four obstacle layouts; drawing is read-only.`);
