// Optional, isolated QA dependency:
// npm install --prefix node_modules/.cache/magnet-climbers-visual --no-package-lock --no-save @napi-rs/canvas
import { build } from "vite";
import { createCanvas, loadImage } from "../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

await build({ configFile: false, logLevel: "warn", build: {
  lib: { entry: "tests/visual-entry.ts", formats: ["es"], fileName: () => "visual.mjs" },
  outDir: "node_modules/.cache/magnet-climbers-render", minify: false,
} });
const { Game, UPGRADES, attachGrip, findContacts, stepGrip, drawClimber, drawClimberShadow, render, setSound } =
  await import(pathToFileURL(resolve("node_modules/.cache/magnet-climbers-render/visual.mjs")).href);
globalThis.document = { createElement: () => createCanvas(256, 256) };
setSound(false);
const levels = Object.fromEntries(UPGRADES.map((u) => [u.key, 0]));
const game = new Game(levels, { onPower() {}, onGameOver() {}, onCoins() {}, onGems() {} }, { seed: 12345 });
const sheet = createCanvas(1000, 640), ctx = sheet.getContext("2d");
ctx.fillStyle = "#1a222d"; ctx.fillRect(0, 0, 1000, 640);
ctx.fillStyle = "#fff"; ctx.font = "bold 26px sans-serif"; ctx.fillText("Magnetic landings / window light", 34, 44);
ctx.font = "16px sans-serif"; ctx.fillStyle = "#b8c5d4";
ctx.fillText("Actual Canvas renderer • enlarged 2.8x • fixed silver tips, flexible bodies", 34, 72);
const cases = [
  ["Flat / four tips", 0.1, 0, null], ["Feet attached", 0, 3, null], ["Hands attached", Math.PI, 3, null],
  ["One-hand swing", 0.7, 3, [0]], ["Hand + opposite foot", 0.4, 0, [0, 3]], ["In flight", 0.8, 3, []],
];
const colors = ["#ff8a3d", "#4fc3f7", "#9be15d", "#ff5c8a", "#c77dff", "#ffd23f"];
for (let i = 0; i < cases.length; i++) {
  const [label, angle, spin, ids] = cases[i], x = 24 + i % 3 * 326, y = 96 + Math.floor(i / 3) * 260;
  const steel = ctx.createLinearGradient(x, y, x + 310, y + 235);
  steel.addColorStop(0, "#d9dfe1"); steel.addColorStop(0.45, "#bcc3c7"); steel.addColorStop(1, "#919eaa");
  ctx.fillStyle = steel; ctx.fillRect(x, y, 306, 238);
  ctx.fillStyle = "#293542"; ctx.font = "bold 17px sans-serif"; ctx.fillText(label, x + 15, y + 27);
  ctx.save(); ctx.translate(x + 144, y + 127); ctx.scale(2.8, 2.8);
  const c = { ...game.climbers[0], x: 100, y: -100, angle, spin, vx: 0, vy: 30, color: colors[i], state: "flying", grip: undefined, airTime: 0.5 };
  if (ids?.length !== 0) {
    let contacts = findContacts(c, game.world, 4);
    if (ids) contacts = contacts.filter((p) => ids.includes(p.limb));
    attachGrip(c, contacts); c.state = "stuck";
    for (let j = 0; j < 80; j++) stepGrip(c, 1 / 120);
  }
  ctx.translate(-100, 100); drawClimberShadow(ctx, c); drawClimber(ctx, c, false, 1);
  ctx.restore();
}
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/magnetism-poses.png", sheet.toBuffer("image/png"));
const phone = createCanvas(800, 1400);
game.launch(game.climbers[0], { x: 80, y: -580 });
for (let i = 0; i < 110; i++) game.update(1 / 120);
render(phone.getContext("2d"), game, 700, 2);
await writeFile("artifacts/magnetism-game.png", phone.toBuffer("image/png"));
for (const file of ["public/art/title-logo.webp", "public/art/title-fridge.webp", "public/icons/toy-icon-512.png"]) {
  const img = await loadImage(file);
  console.log(`${file}: ${img.width}x${img.height}`);
}
console.log("Rendered artifacts/magnetism-poses.png and artifacts/magnetism-game.png");
