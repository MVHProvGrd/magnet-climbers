// Gameplay renderer review at real logical size, sampled throughout a fling.
import { build } from "vite";
import { createCanvas } from "../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
await build({ configFile: false, logLevel: "warn", build: {
  lib: { entry: "tests/visual-entry.ts", formats: ["es"], fileName: () => "visual.mjs" },
  outDir: "node_modules/.cache/magnet-climbers-action", minify: false,
} });
const { Game, UPGRADES, render, setSound } = await import(pathToFileURL(resolve("node_modules/.cache/magnet-climbers-action/visual.mjs")).href);
globalThis.document = { createElement: () => createCanvas(256, 256) }; setSound(false);
const ids = ["gecko", "frog", "crab", "octopus", "robot", "dino"];
const sheet = createCanvas(1080, 760), ctx = sheet.getContext("2d");
ctx.fillStyle = "#1c2936"; ctx.fillRect(0, 0, 1080, 760);
ctx.fillStyle = "#fff"; ctx.font = "20px sans-serif";
ctx.fillText("Gameplay samples / actual logical size / same launch", 20, 30);
for (let col = 0; col < ids.length; col++) {
  const game = new Game(Object.fromEntries(UPGRADES.map(u => [u.key, 0])),
    { onPower() {}, onGameOver() {}, onCoins() {}, onGems() {} },
    { seed: 12345, rules: "solo", chill: true, lineup: [{ creature: ids[col], pattern: "classic" }] });
  game.viewH = 700;
  const phone = createCanvas(400, 700);
  const toy = game.climbers[0];
  game.launch(toy, { x: 60, y: -580 });
  for (let row = 0; row < 5; row++) {
    for (let tick = 0; tick < 18; tick++) game.update(1 / 120);
    render(phone.getContext("2d"), game, 700, 1);
    const x = col * 180, y = 48 + row * 140;
    ctx.drawImage(phone, toy.x - 80, toy.y - game.camY - 60, 160, 110, x + 10, y, 160, 110);
    ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif";
    ctx.fillText(`${ids[col]} / ${game.time.toFixed(2)}s`, x + 14, y + 128);
  }
}
await writeFile("artifacts/creature-action-review.png", sheet.toBuffer("image/png"));
console.log("Rendered 30 gameplay samples using the actual simulation and renderer.");
