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
    reserves: 0,
    skin: "classic",
    skins: ["classic"],
    playerId: "p-" + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8),
    name: "",
    introSeen: false,
    namePrompted: false,
    tutorialDone: false,
    chill: false,
  };
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
      upgrades: { ...d.upgrades, ...(parsed.upgrades ?? {}) },
      version: 1 as const,
    };
    // players who already chose a name never see the one-time offer
    if (parsed.name && parsed.namePrompted === undefined) merged.namePrompted = true;
    if (!merged.name) merged.name = guestName();
    return merged;
  } catch {
    return { ...defaults(), name: guestName() };
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage may be unavailable (private mode) — play on without persistence */
  }
}
