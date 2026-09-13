// Same optional @napi-rs/canvas install as tests/visual.mjs.
import assert from "node:assert/strict";
import { build } from "vite";
import { createCanvas, GlobalFonts } from "../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (existsSync("C:/Windows/Fonts/segoeui.ttf")) GlobalFonts.registerFromPath("C:/Windows/Fonts/segoeui.ttf", "system-ui");
await build({ configFile: false, logLevel: "warn", build: {
  lib: { entry: "tests/visual-entry.ts", formats: ["es"], fileName: () => "visual.mjs" },
  outDir: "node_modules/.cache/magnet-climbers-render", minify: false,
} });
const { Game, UPGRADES, attachGrip, findContacts, render, setSound, drawSurface, drawZone, drawBumper, drawPower, artVariant } =
  await import(pathToFileURL(resolve("node_modules/.cache/magnet-climbers-render/visual.mjs")).href);
globalThis.document = { createElement: () => createCanvas(256, 256) };
setSound(false);
const levels = Object.fromEntries(UPGRADES.map((u) => [u.key, 0]));
const events = { onPower() {}, onGameOver() {}, onCoins() {}, onGems() {} };
const gallery = createCanvas(1200, 760), ctx = gallery.getContext("2d");
const seeds = [113, 3219, 781];
for (let i = 0; i < seeds.length; i++) {
  const g = new Game(levels, events, { seed: seeds[i] });
  g.world.ensure(-7000);
  // Pick a view with a different mix of existing, seeded colliders.
  const candidates = g.world.segments.filter((s) => s.y < -1000);
  const chosen = candidates.sort((a, b) => {
    const score = (s) => i === 0 ? s.zones.filter((z) => z.kind === "sticker").length * 5
      : i === 1 ? s.zones.filter((z) => z.kind === "glass").length * 4 + s.bumpers.length
      : s.zones.filter((z) => z.kind === "repel").length * 6 + s.bumpers.length;
    return score(b) - score(a);
  })[0];
  g.camY = chosen.y - 90; g.floorY = g.camY + 730; g.highestY = chosen.y + 200;
  g.phase = "running"; g.time = 3.7; g.coins = 30 + i * 15;
  for (let j = 0; j < g.climbers.length; j++) {
    const c = g.climbers[j]; c.grip = undefined; c.state = "flying";
    c.x = 42 + j * 141; c.y = g.camY + 250 + j * 130; c.angle = j * 0.45; c.spin = j === 0 ? 0 : 3;
    attachGrip(c, findContacts(c, g.world, 4));
    if (c.grip) c.state = "stuck";
  }
  const phone = createCanvas(400, 720);
  const before = JSON.stringify({ climbers: g.climbers, segments: g.world.segments });
  render(phone.getContext("2d"), g, 720, 1);
  assert.equal(JSON.stringify({ climbers: g.climbers, segments: g.world.segments }), before, "drawing must not mutate the simulation");
  ctx.drawImage(phone, i * 400, 40);
  ctx.fillStyle = "#182733"; ctx.fillRect(i * 400, 0, 400, 40);
  ctx.fillStyle = "#fff"; ctx.font = "bold 15px system-ui"; ctx.textAlign = "center";
  ctx.fillText(["THE DOODLE DOOR", "KEEP IT COOL", "MAGNET MAYHEM"][i], i * 400 + 200, 26);
}
const collection = createCanvas(800, 690), art = collection.getContext("2d");
art.save(); art.scale(2, 1); drawSurface(art, 0, 690); art.restore();
art.fillStyle = "#283b49"; art.font = "bold 24px system-ui"; art.fillText("Little things on a very big fridge", 25, 37);
for (let i = 0; i < 12; i++) {
  const z = { x: 24 + (i % 4) * 196, y: 60 + Math.floor(i / 4) * 162, w: 162, h: 144, hue: 0, kind: "sticker" };
  let seed = 0; while (artVariant(z.x, z.y, seed, 12) !== i || artVariant(z.x, z.y, seed, 16) >= 12) seed++;
  drawZone(art, z, 1, seed);
}
for (let i = 0; i < 5; i++) drawBumper(art, { x: 28 + i * 154, y: 572, w: 90, h: 43, vx: 60, minX: 0, maxX: 400, hue: i * 71, label: ["A", "PIZZA", "MOM", "24/7", "M"][i] });
for (const [i, kind] of ["coin", "gem", "magnet", "extra", "slowmo", "reach"].entries()) drawPower(art, { x: 54 + i * 133, y: 653, kind, taken: false, bob: 0 }, 0);
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/scenery-gallery.png", gallery.toBuffer("image/png"));
await writeFile("artifacts/fridge-sticker-collection.png", collection.toBuffer("image/png"));
console.log("Rendered 12 sticker variants, 3 seeded game views, magnets and pickups; no simulation mutation.");
