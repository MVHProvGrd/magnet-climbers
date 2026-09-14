// Proves every expedition level is beatable within its fling budget by random search over
// fling + climb moves. Run: node tests/expedition-solve.mjs   (not part of npm test; slow)
import { build } from "vite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
writeFileSync("tests/_solve-entry.ts", 'export { Game } from "../src/game/game";\nexport { UPGRADES, CFG } from "../src/game/config";\nexport { PACKS, EXPEDITION_LEVELS } from "../src/game/expeditions";\nexport { setSound } from "../src/game/audio";\n');
await build({ configFile: false, logLevel: "warn", build: { lib: { entry: "tests/_solve-entry.ts", formats: ["es"], fileName: () => "solve.mjs" }, outDir: "node_modules/.cache/mc-solve", minify: false, rollupOptions: { external: [/^node:/] } } });
const { Game, UPGRADES, CFG, PACKS, EXPEDITION_LEVELS, setSound } = await import(pathToFileURL(resolve("node_modules/.cache/mc-solve/solve.mjs")).href);
setSound(false);
const base = { ...Object.fromEntries(UPGRADES.map((u) => [u.key, 0])), ...EXPEDITION_LEVELS };
const ev = { onPower() {}, onGameOver() {}, onCoins() {}, onGems() {} };
const full = CFG.maxDrag * CFG.launchScale;
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function settle(g) { for (let i = 0; i < 120 * 3; i++) { g.update(1 / 120); if (g.phase === "dead") return; if (!g.climbers.some((c) => c.state === "flying") && g.pendingLaunches.length === 0 && i > 30) return; } }
function attempt(level, maxMoves) {
  const g = new Game(base, ev, { rules: "crew", seed: level.seed, level });
  let flings = 0;
  for (let m = 0; m < maxMoves && g.phase !== "dead"; m++) {
    const stuck = g.climbers.filter((c) => c.state === "stuck" || c.state === "linked");
    if (!stuck.length) break;
    // only climbers nobody hangs on can fling; prefer the highest of those
    const free = stuck.filter((c) => !g.climbers.some((o) => o.parent === c.id && o.state === "linked"));
    if (!free.length) break;
    free.sort((a, b) => a.y - b.y);
    const c = rnd() < 0.7 ? free[0] : free[Math.floor(rnd() * free.length)];
    const others = stuck.filter((o) => o !== c);
    const pull = 0.7 + rnd() * 0.3, ang = (rnd() - 0.5) * 0.8; // radians off straight up
    if (others.length && rnd() < 0.5) {
      // CLIMB: the lowest climber stacks above the highest teammate, or crawls up on steel
      const low = [...stuck].sort((a, b) => b.y - a.y)[0]; const high = [...stuck].sort((a, b) => a.y - b.y)[0];
      if (low !== high && rnd() < 0.7) g.move(low, { x: high.x + (rnd() - 0.5) * 20, y: high.y - 60 });
      else g.move(low, { x: low.x + (rnd() - 0.5) * 40, y: low.y - 60 });
      settle(g);
      continue;
    }
    if (g.level && g.flings >= g.level.flings) break;
    g.flings++; flings++;
    g.launch(c, { x: Math.sin(ang) * full * pull, y: -Math.cos(ang) * full * pull });
    settle(g);
  }
  return { won: g.won, flings, lost: g.climbers.filter((c) => c.state === "lost").length };
}
let bad = 0;
for (const pack of PACKS) for (const level of pack.levels) {
  let best = null, wins = 0; const tries = 400;
  for (let t = 0; t < tries; t++) { const r = attempt(level, level.flings + 12); if (r.won) { wins++; if (!best || r.flings < best.flings) best = r; } }
  const ok = wins > 0 && best.flings <= level.flings;
  if (!ok) bad++;
  console.log(`${ok ? "ok " : "BAD"} ${level.id.padEnd(9)} team ${level.team} goal ${level.goalCm}cm budget ${level.flings} par ${level.par}  wins ${wins}/${tries}  best ${best ? best.flings + " flings, " + best.lost + " lost" : "none"}`);
}
process.exit(bad ? 1 : 0);
