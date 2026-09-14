import { UPGRADES, type UpgradeKey } from "./config";
import type { Look } from "./creatures";

export interface SaveData {
  version: 1;
  coins: number;
  gems: number;
  bestCm: number;
  bestSolo: number;
  runs: number;
  totalCm: number;
  upgrades: Record<UpgradeKey, number>;
  sound: boolean;
  music: boolean;
  reserves: number;
  /** legacy skin fields; migrated into `pattern`/`patterns` on load and kept for older clients */
  skin: string;
  skins: string[];
  /** what the solo climber (and crew slot defaults) wear */
  creature: string;
  pattern: string;
  creatures: string[];
  patterns: string[];
  /** per-slot looks for crew runs; missing slots fall back to creature/pattern */
  crew: Look[];
  /** the one-time "pick your first creature" offer has been taken */
  picked: boolean;
  /** lifetime bumper hits, for the crab unlock */
  hitsTotal: number;
  spins: number;
  /** placeholder until real accounts exist */
  playerId: string;
  /** per-player secret for cloud save; never shown */
  token: string;
  /** cloud save revision this device last synced */
  cloudRev: number;
  /** display name for the leaderboard; empty until the player picks one */
  name: string;
  introSeen: boolean;
  /** the one-time name offer has been shown */
  namePrompted: boolean;
  tutorialDone: boolean;
  chill: boolean;
}

const KEY = "magnet-climbers:save:v1";

function defaults(): SaveData {
  const upgrades = {} as Record<UpgradeKey, number>;
  for (const u of UPGRADES) upgrades[u.key] = 0;
  return {
    version: 1,
    coins: 0,
    gems: 10,
    bestCm: 0,
    bestSolo: 0,
    runs: 0,
    totalCm: 0,
    upgrades,
    sound: true,
    music: true,
    reserves: 0,
    skin: "classic",
    skins: ["classic"],
    creature: "toy",
    pattern: "classic",
    creatures: ["toy"],
    patterns: ["classic"],
    crew: [],
    picked: false,
    hitsTotal: 0,
    spins: 0,
    playerId: "p-" + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8),
    token: newToken(),
    cloudRev: 0,
    name: "",
    introSeen: false,
    namePrompted: false,
    tutorialDone: false,
    chill: false,
  };
}

export function newToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Guest name so every score has a label even when the player skips naming. */
export function guestName(): string {
  return "Climber" + String(1000 + Math.floor(Math.random() * 9000));
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults(), name: guestName() };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const d = defaults();
    const merged = {
      ...d,
      ...parsed,
      music: parsed.music ?? parsed.sound ?? d.music,
      // saves from before creatures wore a "skin"; keep that palette on
      pattern: parsed.pattern ?? parsed.skin ?? d.pattern,
      upgrades: { ...d.upgrades, ...(parsed.upgrades ?? {}) },
      version: 1 as const,
    };
    // players who already chose a name never see the one-time offer
    if (parsed.name && parsed.namePrompted === undefined) merged.namePrompted = true;
    if (!merged.name) merged.name = guestName();
    if (!merged.token) merged.token = newToken();
    migrateLooks(merged);
    return merged;
  } catch {
    return { ...defaults(), name: guestName() };
  }
}

/** Old saves had skins (palettes); those become owned patterns. Everyone owns the starter toy. */
export function migrateLooks(d: SaveData): void {
  d.patterns = Array.from(new Set([...(d.patterns ?? []), ...(d.skins ?? []), "classic"]));
  d.creatures = Array.from(new Set([...(d.creatures ?? []), "toy"]));
  if (!d.pattern || !d.patterns.includes(d.pattern)) d.pattern = d.patterns.includes(d.skin) ? d.skin : "classic";
  if (!d.creature || !d.creatures.includes(d.creature)) d.creature = "toy";
  d.crew = (d.crew ?? []).filter((l) => l && d.creatures.includes(l.creature) && d.patterns.includes(l.pattern));
  d.skin = d.pattern; d.skins = d.patterns;
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage may be unavailable (private mode) — play on without persistence */
  }
}
