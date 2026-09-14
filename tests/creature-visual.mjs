// Optional Canvas dependency setup: tests/visual.mjs.
import assert from "node:assert/strict";
import { build } from "vite";
import { createCanvas } from "../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
await build({ configFile: false, logLevel: "warn", build: {
  lib: { entry: "tests/visual-entry.ts", formats: ["es"], fileName: () => "visual.mjs" },
  outDir: "node_modules/.cache/magnet-climbers-creatures", minify: false,
} });
const { Game, UPGRADES, drawClimber, drawClimberShadow, resetRagdoll, stepRagdoll, findContacts, attachGrip } =
  await import(pathToFileURL(resolve("node_modules/.cache/magnet-climbers-creatures/visual.mjs")).href);
const game = new Game(Object.fromEntries(UPGRADES.map(u => [u.key, 0])),
  { onPower() {}, onGameOver() {}, onCoins() {}, onGems() {} }, { seed: 12345 });
const ids = ["human", "gecko", "frog", "crab", "octopus", "robot", "dino"];
const sheet = createCanvas(1260, 790), ctx = sheet.getContext("2d");
ctx.fillStyle = "#1f2d3b"; ctx.fillRect(0, 0, sheet.width, sheet.height);
ctx.fillStyle = "#fff2d1"; ctx.font = "bold 24px sans-serif";
ctx.fillText("RUBBER TOY CREW / shared magnetic contacts", 24, 36);
const poses = ["Planted", "Tumbling", "One-hand hang", "Pattern / actual size"];
const fingerprints = new Set();
for (let col = 0; col < ids.length; col++) for (let row = 0; row < poses.length; row++) {
  const appearance = { creatureId: ids[col], ...(row === 3 ? { color: "#ed94b7", accent: "#fff4b3", marking: "stripes" } : {}) };
  const toy = { ...game.climbers[0], x: 100, y: -100, angle: row === 1 ? .8 : row === 2 ? -.5 : 0,
    state: "flying", grip: undefined, vx: row === 1 ? 160 : 0, vy: 70, spin: 3, airTime: .4 };
  resetRagdoll(toy); stepRagdoll(toy, 1 / 120);
  if (row !== 1) {
    let contacts = findContacts(toy, game.world, 4);
    if (row === 2) contacts = contacts.filter(p => p.limb === 0);
    assert.ok(contacts.length); attachGrip(toy, contacts); toy.state = "stuck";
  }
  const before = JSON.stringify(toy);
  const x = col * 180 + 6, y = 58 + row * 180;
  ctx.fillStyle = "#b8c8cd"; ctx.fillRect(x, y, 168, 168);
  ctx.fillStyle = "#253b47"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(ids[col].toUpperCase(), x + 84, y + 21);
  ctx.font = "11px sans-serif"; ctx.fillText(poses[row], x + 84, y + 152);
  ctx.save(); ctx.translate(x + 84, y + 83); ctx.scale(row === 3 ? 1 : 1.8, row === 3 ? 1 : 1.8); ctx.translate(-toy.x, -toy.y);
  drawClimberShadow(ctx, toy, 1.2, appearance); drawClimber(ctx, toy, false, 1.2, appearance); ctx.restore();
  assert.equal(JSON.stringify(toy), before, "drawing must not mutate physics or saves");
  const tiny = createCanvas(100, 100), tc = tiny.getContext("2d");
  tc.translate(50 - toy.x, 45 - toy.y); drawClimber(tc, toy, false, 1.2, appearance);
  if (row === 0) fingerprints.add(tiny.toBuffer("image/png").toString("base64"));
  if (row === 1) {
    const a = tiny.toBuffer("image/png");
    tc.clearRect(toy.x - 50, toy.y - 45, 100, 100); drawClimber(tc, toy, false, 1.2, appearance);
    assert.deepEqual(tiny.toBuffer("image/png"), a, "same inputs render identically");
  }
}
assert.equal(fingerprints.size, ids.length, "each creature has distinct art");
// Missing or future IDs preserve the original starter appearance.
const fallback = id => {
  const canvas = createCanvas(100, 100), c = canvas.getContext("2d");
  const toy = { ...game.climbers[0], x: 50, y: 45 };
  drawClimber(c, toy, false, 0, id ? { creatureId: id } : undefined);
  return canvas.toBuffer("image/png");
};
assert.deepEqual(fallback("future-creature"), fallback());
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/creature-roster.png", sheet.toBuffer("image/png"));
console.log("Seven distinct forms, four poses, deterministic drawing, no state mutations, and fallback verified.");
