import { UPGRADES, type UpgradeKey } from "./config";

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
  reserves: number;
  skin: string;
  skins: string[];
  /** placeholder until real accounts exist */
  playerId: string;
  /** display name for the leaderboard; empty until the player picks one */
  name: string;
  introSeen: boolean;
  tutorialDone: boolean;
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
    reserves: 0,
    skin: "classic",
    skins: ["classic"],
    playerId: "p-" + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8),
    name: "",
    introSeen: false,
    tutorialDone: false,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const d = defaults();
    return {
      ...d,
      ...parsed,
      upgrades: { ...d.upgrades, ...(parsed.upgrades ?? {}) },
      version: 1,
    };
  } catch {
    return defaults();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage may be unavailable (private mode) — play on without persistence */
  }
}
