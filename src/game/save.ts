import type { Lang } from "./i18n";
import { UPGRADES, type UpgradeKey } from "./config";

export interface SaveData {
  version: 1;
  coins: number;
  gems: number;
  bestCm: number;
  bestSolo: number;
  /** When each best was set and how long that run took. The board heals itself from these,
   *  so it needs to know the run's duration, and whether the owner cleared the board since. */
  bestCmAt?: number;
  bestSoloAt?: number;
  bestCmSeconds?: number;
  bestSoloSeconds?: number;
  runs: number;
  totalCm: number;
  upgrades: Record<UpgradeKey, number>;
  /** Kit bought for one run. Spent coins buy a single climb, not a permanent stat, and this
   *  is wiped the moment that run ends. `upgrades` is the old permanent table, kept for crew. */
  kit: Record<UpgradeKey, number>;
  sound: boolean;
  music: boolean;
  /** "" = follow the browser language */
  lang: "" | Lang;
  /** legacy skin fields; migrated into `pattern`/`patterns` on load and kept for older clients */
  skin: string;
  skins: string[];
  /** what the climber wears */
  creature: string;
  pattern: string;
  creatures: string[];
  patterns: string[];
  /** the one-time "pick your first creature" offer has been taken */
  picked: boolean;
  /** lifetime bumper hits, for the crab unlock */
  hitsTotal: number;
  /** intro cards already shown */
  intros: string[];
  spins: number;
  /** placeholder until real accounts exist */
  playerId: string;
  /** per-player secret for cloud save; never shown */
  token: string;
  /** cloud save revision this device last synced */
  cloudRev: number;
  /** display name for the leaderboard; empty until the player picks one */
  name: string;
  /** chat and profile portrait id from `avatars.ts`; empty = coloured initial */
  avatar: string;
  introSeen: boolean;
  /** the daily climb already taken: its UTC day, what it scored, and the streak it continued */
  daily: { day: string; cm: number } | null;
  /** consecutive days with a daily climb, and the last day counted */
  streak: { days: number; last: string };
  /** the one-time name offer has been shown */
  namePrompted: boolean;
  tutorialDone: boolean;
  chill: boolean;
}

const KEY = "magnet-climbers:save:v1";

function defaults(): SaveData {
  const upgrades = {} as Record<UpgradeKey, number>;
  for (const u of UPGRADES) upgrades[u.key] = 0;
  const kit = { ...upgrades };
  return {
    version: 1,
    coins: 0,
    gems: 10,
    bestCm: 0,
    bestSolo: 0,
    runs: 0,
    totalCm: 0,
    upgrades,
    kit,
    daily: null,
    streak: { days: 0, last: "" },
    sound: true,
    music: true,
    lang: "",
    skin: "classic",
    skins: ["classic"],
    creature: "toy",
    pattern: "classic",
    creatures: ["toy"],
    patterns: ["classic"],
    picked: false,
    hitsTotal: 0,
    intros: [],
    spins: 0,
    playerId: "p-" + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8),
    token: newToken(),
    cloudRev: 0,
    name: "",
    avatar: "",
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
      kit: { ...d.kit, ...(parsed.kit ?? {}) },
      streak: { ...d.streak, ...(parsed.streak ?? {}) },
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
  d.intros = d.intros ?? [];
  d.skin = d.pattern; d.skins = d.patterns;
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage may be unavailable (private mode) — play on without persistence */
  }
}
