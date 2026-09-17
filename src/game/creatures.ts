/**
 * Creature + pattern contract shared by the save, the UI and the renderer.
 *
 * A climber is `creature` (body and animation rules, drawn by climber-render.ts)
 * plus `pattern` (colours and effects). All creatures share the same four
 * magnetic contact points and identical stats; cosmetics never touch physics.
 * The renderer must fall back to "toy" for any creature id it does not know.
 */

export type CreatureId = "toy" | "gecko" | "frog" | "crab" | "octopus" | "robot" | "dino";
export type PatternId = string;
export type Rarity = "common" | "rare" | "epic";

/** How a creature is earned. Creatures come from moments; patterns from the prize machine. */
export type UnlockRule =
  | { kind: "start" }
  | { kind: "height"; mode: "solo" | "crew"; cm: number }
  | { kind: "chain"; size: number }
  | { kind: "gadgets"; rides: number }
  | { kind: "hits"; total: number }
  | { kind: "coins"; perRun: number }
  | { kind: "stars"; total: number }
  | { kind: "paint"; perRun: number };

export interface CreatureDef {
  id: CreatureId;
  name: string;
  blurb: string;
  /** signature detail the renderer should sell */
  detail: string;
  unlock: UnlockRule;
}

export interface PatternDef {
  id: PatternId;
  name: string;
  rarity: Rarity;
  /** six crew colours; solo uses the first */
  colors: string[];
  /** optional renderer effect hint; ignored by renderers that do not know it */
  effect?: "glow" | "sparkle" | "chrome";
  /** body marking the renderer draws in the accent colour */
  marking?: "plain" | "spots" | "stripes";
  /** accent colour for markings, bellies and eyes; defaults to a lightened first colour */
  accent?: string;
}

/** What one climber wears. */
export interface Look { creature: string; pattern: PatternId }

export const CREATURES: CreatureDef[] = [
  { id: "toy", name: "Magnet Person", blurb: "The original fridge toy. Rubbery, cheerful, indestructible.", detail: "classic bendy limbs", unlock: { kind: "start" } },
  { id: "gecko", name: "Gecko", blurb: "Huge sticky toe pads and a tail that whips on every fling.", detail: "toe pads on the magnets, whipping tail", unlock: { kind: "height", mode: "solo", cm: 1000 } },
  { id: "frog", name: "Tree Frog", blurb: "Big fingertips, legs tucked in flight, stretchy catches.", detail: "tucked legs mid-air, throat puff on landing", unlock: { kind: "paint", perRun: 3 } },
  { id: "octopus", name: "Octopus", blurb: "Four arms grip, four more curl along for the ride.", detail: "four decorative curling arms", unlock: { kind: "height", mode: "solo", cm: 5000 } },
  { id: "robot", name: "Robot", blurb: "Spring joints, four grippers and a little face screen.", detail: "face screen reacts to landings", unlock: { kind: "gadgets", rides: 5 } },
  { id: "crab", name: "Crab", blurb: "Two claws and two feet grip. Sideways stance, frantic tumbles.", detail: "claws as magnets, sideways idle", unlock: { kind: "hits", total: 15 } },
  { id: "dino", name: "Dino", blurb: "Stubby arms, big feet, tiny roar on every stick.", detail: "tail counterweight, tiny arms", unlock: { kind: "coins", perRun: 40 } },
];

export const PATTERNS: PatternDef[] = [
  { id: "classic", name: "Classic", rarity: "common", colors: ["#ff8a3d", "#4fc3f7", "#9be15d", "#f06292", "#ffd54f", "#b388ff"] },
  { id: "lemon", name: "Lemon", rarity: "common", colors: ["#fff176", "#ffe94d", "#fff59d", "#ffd600", "#ffee58", "#f9e04b"] },
  { id: "mint", name: "Mint", rarity: "common", colors: ["#7ef0c8", "#5ce0b0", "#a8f5dc", "#3fd1a1", "#90f0d0", "#62e6bd"] },
  { id: "bubblegum", name: "Bubblegum", rarity: "common", colors: ["#ff9ad5", "#ff7cc8", "#ffb6e1", "#ff5fbf", "#ffa8db", "#ff8ad0"] },
  { id: "ocean", name: "Ocean", rarity: "common", colors: ["#4fc3f7", "#29b6f6", "#81d4fa", "#03a9f4", "#5fcbf8", "#39bdf6"] },
  { id: "candy", name: "Candy", rarity: "common", colors: ["#ff9ad5", "#ffd1a1", "#a1e3ff", "#d3a1ff", "#a1ffb8", "#fff3a1"] },
  { id: "watermelon", name: "Watermelon", rarity: "rare", colors: ["#ff5c7a", "#5ad46b", "#ff7a93", "#3cc352", "#ff6b86", "#6ee07e"], marking: "spots", accent: "#e9ffe0" },
  { id: "tiger", name: "Tiger", rarity: "rare", colors: ["#ff9f1c", "#ffb84d", "#ff8c00", "#ffae42", "#ff9a2e", "#ffc266"], marking: "stripes", accent: "#fff0c2" },
  { id: "lava", name: "Lava", rarity: "rare", colors: ["#ff4e1c", "#ff7a2e", "#ff3d00", "#ff9140", "#ff5a1f", "#ff6f3c"], effect: "glow" },
  { id: "stealth", name: "Stealth", rarity: "rare", colors: ["#3a3f47", "#5b6470", "#8a94a1", "#2c3036", "#b0b8c2", "#6f7986"] },
  { id: "glow", name: "Glow in the dark", rarity: "rare", colors: ["#c8ff5a", "#9bff8a", "#e6ffb0", "#7cf0c8", "#d4ff3d", "#b8ffe0"], effect: "glow" },
  { id: "galaxy", name: "Galaxy", rarity: "epic", colors: ["#7c4dff", "#536dfe", "#b388ff", "#3d5afe", "#9575ff", "#6a5cff"], effect: "sparkle", marking: "spots", accent: "#ffe9a8" },
  { id: "chrome", name: "Chrome", rarity: "epic", colors: ["#d8dde2", "#c0c8d0", "#eef1f4", "#aeb7c0", "#cfd6dc", "#e3e8ec"], effect: "chrome" },
  { id: "midnight", name: "Midnight", rarity: "epic", colors: ["#1b2340", "#22305a", "#2c3c70", "#17203a", "#253466", "#1f2b4f"], effect: "sparkle", marking: "spots", accent: "#8fb8ff" },
];

export const PRIZE_COST = 100;
/** Where the doubling stops. Nine spins in, a spin costs this and keeps costing it. */
export const PRIZE_CAP = 25_600;
/**
 * Every spin costs double the last one -- 100, 200, 400, 800 -- until it reaches the ceiling.
 * The doubling is what makes coins keep mattering as a wallet grows; the ceiling is what keeps
 * the last few patterns reachable, because uncapped the fourteenth spin wanted 819,200 coins
 * and the collection was effectively closed. Capped, a complete set costs about 179k.
 */
export const prizeCost = (spins: number) => Math.min(PRIZE_CAP, PRIZE_COST * 2 ** Math.max(0, spins));
/** Odds shown to the player; the draw uses the same numbers. */
export const PRIZE_ODDS: Record<Rarity, number> = { common: 65, rare: 28, epic: 7 };

export const creatureById = (id: string): CreatureDef => CREATURES.find((c) => c.id === id) ?? CREATURES[0];
export const patternById = (id: string): PatternDef => PATTERNS.find((p) => p.id === id) ?? PATTERNS[0];
export const patternColors = (id: string): string[] => patternById(id).colors;

/** Human text for a locked creature's unlock rule. */
export function unlockText(rule: UnlockRule): string {
  switch (rule.kind) {
    case "start": return "Yours from the start";
    case "height": return `Reach ${rule.cm} cm in a ${rule.mode === "solo" ? "Solo" : "Crew"} climb`;
    case "chain": return `Hang ${rule.size} climbers in one chain`;
    case "gadgets": return `Ride ${rule.rides} gadgets in one run`;
    case "hits": return `Take ${rule.total} bumper hits (lifetime)`;
    case "coins": return `Collect ${rule.perRun} coins in one run`;
    case "stars": return `Earn ${rule.total} expedition stars`;
    case "paint": return `Grab ${rule.perRun} paint buckets in one run`;
  }
}

/** Run facts the unlock rules are checked against. */
export interface RunFacts {
  mode: "solo" | "crew";
  cm: number;
  chill: boolean;
  maxChain: number;
  gadgetRides: number;
  coins: number;
  /** lifetime bumper hits after this run */
  hitsTotal: number;
  /** expedition stars held after this run or level */
  stars: number;
  /** paint buckets grabbed this run */
  paints: number;
}

/** Creatures this run newly earns. Chill runs unlock nothing height-based. */
export function creaturesEarned(owned: string[], f: RunFacts): CreatureDef[] {
  return CREATURES.filter((c) => {
    if (owned.includes(c.id)) return false;
    const r = c.unlock;
    switch (r.kind) {
      case "start": return true;
      case "height": return !f.chill && f.mode === r.mode && f.cm >= r.cm;
      case "chain": return f.maxChain >= r.size;
      case "gadgets": return f.gadgetRides >= r.rides;
      case "hits": return f.hitsTotal >= r.total;
      case "coins": return !f.chill && f.coins >= r.perRun;
      case "stars": return f.stars >= r.total;
      case "paint": return !f.chill && f.paints >= r.perRun;
    }
  });
}

/** Prize machine draw with duplicate protection: only unowned patterns are in the pool. */
export function drawPrize(owned: string[], roll: () => number = Math.random): PatternDef | null {
  const pool = PATTERNS.filter((p) => !owned.includes(p.id));
  if (!pool.length) return null;
  const tiers: Rarity[] = ["common", "rare", "epic"];
  const available = tiers.filter((t) => pool.some((p) => p.rarity === t));
  const total = available.reduce((n, t) => n + PRIZE_ODDS[t], 0);
  let r = roll() * total; let tier = available[0];
  for (const t of available) { r -= PRIZE_ODDS[t]; if (r <= 0) { tier = t; break; } }
  const choices = pool.filter((p) => p.rarity === tier);
  return choices[Math.floor(roll() * choices.length)];
}

/** Lighten a hex colour toward white; used for default accents. */
function lighten(hex: string, amount = 0.55): string {
  const n = parseInt(hex.slice(1), 16); if (!Number.isFinite(n)) return "#fff0ba";
  const ch = (v: number) => Math.round(v + (255 - v) * amount).toString(16).padStart(2, "0");
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/** Renderer-facing appearance for a climber: the renderer takes resolved colours, not ids. */
export interface CreatureAppearance { creatureId?: string; color?: string; accent?: string; marking?: "plain" | "spots" | "stripes" }
/** Resolved appearances are pure and few; the render loop asks for the same ones every frame. */
const appearanceCache = new Map<string, CreatureAppearance>();
export function appearanceFor(c: { creature?: string; pattern?: string; color: string }): CreatureAppearance {
  const key = `${c.creature ?? ""}|${c.pattern ?? ""}|${c.color}`;
  const hit = appearanceCache.get(key);
  if (hit) return hit;
  const creatureId = !c.creature || c.creature === "toy" ? "human" : c.creature;
  const pattern = c.pattern ? patternById(c.pattern) : null;
  // Treated as read-only by every caller (the renderer resolves colours, it does not own them).
  const out: CreatureAppearance = { creatureId, color: c.color, accent: pattern?.accent ?? lighten(c.color), marking: pattern?.marking ?? "plain" };
  if (appearanceCache.size > 256) appearanceCache.clear();
  appearanceCache.set(key, out);
  return out;
}
