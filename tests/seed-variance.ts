/** How much of a run is the door: the same fixed policy on many seeds, offline. Run via scripts/seed-variance.mjs. */
import { Game } from "../src/game/game";
import { World } from "../src/game/world";
import { CFG, W, type UpgradeKey } from "../src/game/config";
import { STEP } from "../src/game/recorder";
const KIT = { magnet: 0, power: 0, floor: 0 } as Record<UpgradeKey, number>;
const FULL = CFG.maxDrag * CFG.launchScale;
const NO = { onPower: () => {}, onGameOver: () => {}, onCoins: () => {}, onGems: () => {} };
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
type Profile = { name: string; reaction: number; aim: number; power: number; reach: number };
const PROFILES: Profile[] = [
  { name: "timid", reaction: 0.9, aim: 24, power: 0.8, reach: 200 },
  { name: "mid", reaction: 0.6, aim: 12, power: 0.9, reach: 280 },
  { name: "strong", reaction: 0.4, aim: 6, power: 1.0, reach: 340 },
];
function run(seed: number, p: Profile): { cm: number; s: number; cause: string | null; flings: number; stalls: number } {
  const g = new Game(KIT, NO, { rules: "solo", seed, worldVersion: new World(1, 0).version, silent: true, lineup: [] });
  g.phase = "running";
  const r = rng(seed * 7 + 1);
  let cool = 0, flings = 0, stallMax = 0;
  for (let n = 0; n < 120 * 300 && g.phase === "running"; n++) {
    const c = g.climbers[0];
    cool -= STEP;
    if (c && (c.state === "stuck" || c.state === "linked") && cool <= 0) {
      const w = g.world; w.ensure(c.y - 900);
      let best: { x: number; y: number; d: number } | null = null;
      for (let dy = p.reach * 0.55; dy <= p.reach * 1.6; dy += 28) for (let tx = 34; tx <= W - 34; tx += 22) {
        if (Math.abs(tx - W / 2) < 28 || !w.isMetal(tx, c.y - dy)) continue;
        const d = Math.abs(tx - c.x) * 0.8 + Math.abs(dy - p.reach);
        if (!best || d < best.d) best = { x: tx, y: c.y - dy, d };
      }
      // no hold in sight: a full pull straight up, which is what clears a glass band
      const tx = (best?.x ?? c.x) + (r() - 0.5) * p.aim, dy = best ? c.y - best.y : 260;
      let vx = (tx - c.x) * 1.7, vy = best && dy <= 180 ? -(dy * 1.35 + 260) : -FULL;
      const len = Math.hypot(vx, vy), cap = FULL * (best && dy <= 180 ? p.power : 1);
      if (len > cap) { vx *= cap / len; vy *= cap / len; }
      if (g.launch(c, { x: vx, y: vy })) { flings++; cool = p.reaction * (0.7 + r() * 0.6); } else cool = 0.15;
    }
    g.update(STEP);
    stallMax = Math.max(stallMax, g.stalls);
  }
  return { cm: g.heightCm, s: Math.round(g.runTime), cause: g.lastCause, flings, stalls: stallMax };
}
const N = Number(process.env.SEEDS ?? 60);
const out: Record<string, ReturnType<typeof run>[]> = {};
for (const p of PROFILES) {
  out[p.name] = [];
  for (let i = 0; i < N; i++) out[p.name].push(run(100_000 + i * 7919, p));
}
const q = (xs: number[], k: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(k * (s.length - 1)))]; };
for (const p of PROFILES) {
  const cms = out[p.name].map((x) => x.cm);
  const causes: Record<string, number> = {}; for (const x of out[p.name]) causes[x.cause ?? "?"] = (causes[x.cause ?? "?"] ?? 0) + 1;
  console.log(`${p.name.padEnd(7)} seeds ${N}: min ${q(cms, 0)} p10 ${q(cms, .1)} median ${q(cms, .5)} p90 ${q(cms, .9)} max ${q(cms, 1)} · p90/p10 ${(q(cms, .9) / Math.max(1, q(cms, .1))).toFixed(1)}x · causes ${JSON.stringify(causes)} · stalls≥3 in ${out[p.name].filter((x) => x.stalls >= 3).length}`);
}
// which seeds are bad for everyone: the door, not the policy
const bad = Array.from({ length: N }, (_, i) => i).filter((i) => PROFILES.every((p) => out[p.name][i].cm < q(out[p.name].map((x) => x.cm), .25)));
console.log(`seeds in the bottom quarter for all three policies: ${bad.length} of ${N} -> ${bad.map((i) => 100_000 + i * 7919).slice(0, 12).join(",")}`);
console.log(JSON.stringify({ seeds: Array.from({ length: N }, (_, i) => 100_000 + i * 7919), out }));
