import type { Lang } from "./i18n";
import { UPGRADES, type UpgradeKey } from "./config";
import type { Mission } from "./missions";

export interface SaveData {
  version: 1;
  coins: number;
  gems: number;
  /**
   * Running totals of what the wallet has ever taken in and paid out, and the balance last
   * seen when they were brought up to date. A balance goes up and down, so two devices
   * cannot merge it without one of them resurrecting money the other spent; the totals only
   * ever grow, so each side's high-water mark is the truth and the balance is in minus out.
   */
  ledger: { coinsIn: number; coinsOut: number; gemsIn: number; gemsOut: number; coinsSeen: number; gemsSeen: number };
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
  /** the month whose limited pattern has already been handed over, as "2026-10" */
  themeMonth: string;
  /** three at a time, and a count of every one ever finished (it sets how hard the next roll is) */
  missions: Mission[];
  missionsDone: number;
  /** the Central day the current three were rolled for; a new day rolls a new three */
  missionsDay: string;
  /** the daily climb already taken: its Central day, what it scored, and the streak it continued */
  daily: { day: string; cm: number } | null;
  /** the signed-in account this profile is tied to, for the settings page; the Worker holds the real mapping */
  account: { uid: string; provider: string | null; email: string | null } | null;
  /** consecutive days with a daily climb, and the last day counted */
  streak: { days: number; last: string };
  /** the one-time name offer has been shown */
  namePrompted: boolean;
  tutorialDone: boolean;
  chill: boolean;
  /** keep the plain stainless door all year instead of the month's tint; device-local, like chill */
  plainSteel: boolean;
  /** reminders are on for this phone, and whether the one-time offer after a daily has been made */
  push: boolean;
  pushAsked: boolean;
  /** Public chat is opt-in, off by default: a fridge with a cat and a kid on it plausibly draws
   *  a young audience, and this stays a device-local switch, never something a cloud sync flips on. */
  chatOptIn: boolean;
  /**
   * Spend what the kit costs without being asked, every run. Someone who has settled on a
   * kit does not want the shop between them and the next climb, and the kit is per-run, so
   * "buy it again" is the answer nearly every time once they have the coins for it.
   */
  autoKit: boolean;
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
    ledger: { coinsIn: 0, coinsOut: 0, gemsIn: 10, gemsOut: 0, coinsSeen: 0, gemsSeen: 10 },
    bestCm: 0,
    bestSolo: 0,
    runs: 0,
    totalCm: 0,
    upgrades,
    kit,
    themeMonth: "",
    missions: [],
    missionsDone: 0,
    missionsDay: "",
    daily: null,
    account: null,
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
    plainSteel: false,
    push: false,
    chatOptIn: false,
    pushAsked: false,
    autoKit: false,
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
      // a save from before the ledger opens its books at today's balance
      ledger: parsed.ledger ?? { coinsIn: parsed.coins ?? 0, coinsOut: 0, gemsIn: parsed.gems ?? d.gems, gemsOut: 0, coinsSeen: parsed.coins ?? 0, gemsSeen: parsed.gems ?? d.gems },
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
