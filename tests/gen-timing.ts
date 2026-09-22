/** How long a door segment takes to generate, per segment, over many seeds: the frame hitch the audit measured. */
import { World } from "../src/game/world";
import { CFG } from "../src/game/config";
const times: number[] = []; const worst: { seed: number; i: number; ms: number }[] = [];
for (let s = 0; s < 40; s++) {
  const seed = 5000 + s * 331;
  const w = new World(seed, 0);
  for (let i = 0; i < 60; i++) {
    const t0 = performance.now();
    w.ensure(w.topY - CFG.segmentH); // exactly one more segment
    const ms = performance.now() - t0;
    times.push(ms); worst.push({ seed, i, ms });
  }
}
const q = (k: number) => { const s = [...times].sort((a, b) => a - b); return s[Math.floor(k * (s.length - 1))].toFixed(2); };
worst.sort((a, b) => b.ms - a.ms);
console.log(`segments ${times.length}: p50 ${q(.5)} ms · p90 ${q(.9)} · p99 ${q(.99)} · max ${q(1)} · over 4 ms: ${times.filter((t) => t > 4).length}`);
console.log("worst:", worst.slice(0, 6).map((x) => `seed ${x.seed} #${x.i} ${x.ms.toFixed(1)}ms`).join(" · "));
