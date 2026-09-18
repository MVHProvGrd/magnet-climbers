import assert from "node:assert/strict";
import { test } from "node:test";
import { CREATURES, PATTERNS, creaturesEarned, drawPrize, patternColors, unlockText } from "../src/game/creatures";
import { migrateLooks, type SaveData } from "../src/game/save";
import { Game } from "../src/game/game";
import { UPGRADES, type UpgradeKey } from "../src/game/config";

const levels = () => { const l = {} as Record<UpgradeKey, number>; for (const u of UPGRADES) l[u.key] = 0; return l; };
const events = { onPower() {}, onGameOver() {}, onCoins() {}, onGems() {} };

test("creature contract: ids unique, every pattern has six colours, every rule has text", () => {
  assert.equal(new Set(CREATURES.map((c) => c.id)).size, CREATURES.length);
  assert.equal(new Set(PATTERNS.map((p) => p.id)).size, PATTERNS.length);
  for (const p of PATTERNS) assert.equal(p.colors.length, 6, p.id);
  for (const c of CREATURES) assert.ok(unlockText(c.unlock).length > 4);
  assert.equal(CREATURES[0].id, "toy");
});

test("creatures unlock from run facts; chill runs never unlock by height or coins", () => {
  const base = { mode: "solo" as const, cm: 0, chill: false, maxChain: 0, gadgetRides: 0, coins: 0, hitsTotal: 0, stars: 0, paints: 0 };
  assert.deepEqual(creaturesEarned(["toy"], base), []);
  assert.deepEqual(creaturesEarned(["toy"], { ...base, cm: 1000 }).map((c) => c.id), ["gecko"]);
  assert.deepEqual(creaturesEarned(["toy"], { ...base, cm: 5000, chill: true, coins: 99 }), []);
  // Expeditions is hidden, so neither expedition stars nor crew chains can unlock anything.
  assert.deepEqual(creaturesEarned(["toy"], { ...base, stars: 9, maxChain: 3 }), [], "stars and chains no longer unlock");
  // Tree Frog moved onto paint buckets, Octopus onto a deeper solo climb.
  assert.deepEqual(creaturesEarned(["toy"], { ...base, paints: 3 }).map((c) => c.id), ["frog"]);
  assert.deepEqual(creaturesEarned(["toy"], { ...base, paints: 3, chill: true }), [], "chill unlocks nothing");
  assert.deepEqual(creaturesEarned(["toy"], { ...base, cm: 5000 }).map((c) => c.id).sort(), ["gecko", "octopus"]);
  assert.deepEqual(creaturesEarned(["toy"], { ...base, mode: "crew", cm: 1200 }), [], "crew height no longer unlocks anything");
  assert.deepEqual(creaturesEarned(["toy", "crab"], { ...base, hitsTotal: 15, gadgetRides: 5, coins: 40 }).map((c) => c.id).sort(), ["dino", "robot"]);
});

test("prize machine never repeats, respects tier odds, and stops when complete", () => {
  // a month's limited pattern is earned by climbing that month, so the machine never offers one
  const sellable = PATTERNS.filter((p) => !p.limited);
  const owned = ["classic"]; let seed = 7;
  const roll = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
  for (let i = 0; i < sellable.length - 1; i++) { const p = drawPrize(owned, roll)!; assert.ok(p && !owned.includes(p.id)); owned.push(p.id); }
  assert.equal(owned.length, sellable.length);
  assert.equal(drawPrize(owned, roll), null);
  assert.ok(!owned.some((id) => PATTERNS.find((p) => p.id === id)?.limited), "no limited pattern came out of the machine");
  // with only epics left, an epic must come out even on a "common" roll
  assert.equal(drawPrize(sellable.filter((p) => p.rarity !== "epic").map((p) => p.id), () => 0.01)!.rarity, "epic");
});

test("old skin saves migrate into patterns and everyone owns the toy", () => {
  const d = { skin: "glow", skins: ["classic", "glow"], creature: "", pattern: "", creatures: [], patterns: [] } as unknown as SaveData;
  migrateLooks(d);
  assert.deepEqual(d.patterns.sort(), ["classic", "glow"]);
  assert.equal(d.pattern, "glow");
  assert.deepEqual(d.creatures, ["toy"]);
  assert.equal(d.creature, "toy");
});

test("the lineup dresses the climber, colours come from the pattern, snapshots keep feats", () => {
  const g = new Game(levels(), events, { seed: 3, lineup: [{ creature: "gecko", pattern: "lemon" }] });
  assert.equal(g.climbers.length, 1, "one climber: crew left with the crew code");
  assert.equal(g.climbers[0].creature, "gecko"); assert.equal(g.climbers[0].color, patternColors("lemon")[0]);
  g.phase = "running"; g.feats.gadgetRides = 2; g.feats.hits = 1;
  const snap = g.snapshot()!;
  const back = Game.restore(levels(), events, snap, undefined, [{ creature: "dino", pattern: "classic" }]);
  assert.deepEqual(back.feats, { maxChain: 0, gadgetRides: 2, hits: 1, paints: 0, unhurtCm: 0 });
  assert.equal(back.climbers[0].creature, "gecko", "restored climbers keep the look they were spawned with");
});
