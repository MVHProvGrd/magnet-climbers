/** Can a full pull straight up clear the bottle door? Put a toy under each band the bots died under and try. */
import { Game } from "../src/game/game";
import { World } from "../src/game/world";
import { CFG, W, type UpgradeKey } from "../src/game/config";
import { STEP } from "../src/game/recorder";
const KIT = { magnet: 0, power: 0, floor: 0 } as Record<UpgradeKey, number>;
const NO = { onPower: () => {}, onGameOver: () => {}, onCoins: () => {}, onGems: () => {} };
const FULL = CFG.maxDrag * CFG.launchScale;
const seeds = [234623, 282137, 100000 + 7919 * 3, 100000 + 7919 * 11, 100000 + 7919 * 20, 100000 + 7919 * 33];
for (const seed of seeds) {
  const w = new World(seed, 0); w.ensure(-2600);
  // find the first full-width no-steel band above the start
  let bandTop = NaN, bandBottom = NaN;
  for (let y = -40; y > -2400; y -= 4) {
    let metal = 0; for (let x = 24; x <= W - 24; x += 8) if (w.isMetal(x, y)) metal++;
    if (metal === 0 && Number.isNaN(bandBottom)) bandBottom = y;
    if (metal > 0 && !Number.isNaN(bandBottom) && Number.isNaN(bandTop)) { bandTop = y; break; }
  }
  if (Number.isNaN(bandBottom)) { console.log(`seed ${seed}: no band in the first 24 m`); continue; }
  const height = bandBottom - bandTop; // px, y grows down
  // the highest steel below the band, on the left door
  let holdY = NaN; for (let y = bandBottom + 4; y < bandBottom + 400; y += 4) if (w.isMetal(W * 0.27, y)) { holdY = y; break; }
  const gap = holdY - bandTop; // px the toy must rise to reach steel again
  // try it: a toy stuck at the hold, full pull straight up, and a little to each side
  const results: string[] = [];
  for (const vx of [0, 60, -60, 120]) {
    const g = new Game(KIT, NO, { rules: "solo", seed, silent: true, lineup: [] }); g.phase = "running";
    const c = g.climbers[0]; c.x = W * 0.27; c.y = holdY; c.state = "stuck"; g.world.ensure(holdY - 900);
    const len = Math.hypot(vx, FULL); g.launch(c, { x: vx * FULL / len, y: -FULL * FULL / len });
    let apex = c.y; for (let n = 0; n < 480 && c.state === "flying"; n++) { g.update(STEP); apex = Math.min(apex, c.y); }
    results.push(`${vx === 0 ? "straight" : "vx" + vx}: apex ${Math.round(holdY - apex)}px ${c.state === "stuck" ? (c.y < bandTop ? "STUCK ABOVE" : c.y > bandBottom ? "back below" : "on the band?") : c.state}`);
  }
  console.log(`seed ${seed}: band ${Math.round(-bandBottom / 10)}–${Math.round(-bandTop / 10)} cm, ${height}px tall, hold ${gap}px below its top · ${results.join(" · ")}`);
}
