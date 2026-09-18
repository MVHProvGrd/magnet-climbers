/**
 * Missions: three at a time, each written against something the run already counts.
 *
 * Nothing here instruments anything new. Height, coins, gadget rides, bumper hits, paint
 * buckets and run time are all kept by the run anyway; a mission is a sentence about one of
 * them plus a target and a price. Finish one, it pays coins and another rotates in, so a door
 * you have climbed a hundred times has something in it you have not done yet.
 *
 * The pool is deliberately small and concrete. A mission a player cannot picture is noise.
 */
export type MissionStat = "cm" | "coins" | "gadgetRides" | "hits" | "paints" | "seconds" | "daily";

export interface MissionDef {
  id: string;
  /** what the player reads, with `${n}` already substituted */
  text: (n: number) => string;
  stat: MissionStat;
  /** the targets this mission can roll, smallest first */
  targets: readonly number[];
  /** coins per target, same order */
  pays: readonly number[];
}

export interface Mission {
  id: string;
  n: number;
  pay: number;
  /** progress toward `n`, kept across runs */
  at: number;
  done: boolean;
}

/** How far along a mission is right now, mid-run, without settling anything. */
export function liveProgress(m: Mission, run: RunTally): number {
  const def = missionById(m.id);
  if (!def || m.done) return m.at;
  return Math.min(m.n, progressFor(def, m, run));
}

/** What one finished run contributes to every stat a mission can watch. */
export interface RunTally {
  cm: number;
  coins: number;
  gadgetRides: number;
  hits: number;
  paints: number;
  seconds: number;
  daily: number;
  /** how high the run got before its first hit; the whole run when it took none */
  unhurtCm: number;
}

export const MISSIONS: readonly MissionDef[] = [
  { id: "climb", text: (n) => `Climb ${n.toLocaleString()} cm in one run`, stat: "cm", targets: [800, 1500, 3000], pays: [60, 110, 220] },
  { id: "purse", text: (n) => `Collect ${n} coins in one run`, stat: "coins", targets: [15, 30, 60], pays: [50, 90, 180] },
  { id: "rides", text: (n) => `Ride ${n} hanging gadgets in one run`, stat: "gadgetRides", targets: [3, 6, 10], pays: [60, 110, 200] },
  { id: "unhurt", text: (n) => `Reach ${n.toLocaleString()} cm without taking a hit`, stat: "hits", targets: [600, 1200, 2000], pays: [80, 150, 260] },
  { id: "paint", text: (n) => `Grab ${n} paint buckets in one run`, stat: "paints", targets: [2, 3, 5], pays: [60, 110, 200] },
  { id: "stay", text: (n) => `Last ${n} seconds in one run`, stat: "seconds", targets: [60, 120, 240], pays: [50, 100, 190] },
  // One target, deliberately. The board is rolled fresh each day, so a mission asking for
  // two or three days running reset to nought every midnight and could never be finished --
  // it sat there all day as a job that could not be done. The habit across days is the
  // streak's business, and the streak already pays for it.
  { id: "today", text: () => "Take today's daily climb", stat: "daily", targets: [1], pays: [40] },
];

/** A mission's progress after a run: the best single run for a per-run goal, a total for a tally. */
export function progressFor(def: MissionDef, mission: Mission, run: RunTally): number {
  // reaching the height before the first hit is the feat; a hit after that does not undo it
  if (def.id === "unhurt") return Math.max(mission.at, run.unhurtCm);
  if (def.stat === "daily") return mission.at + run.daily;
  // everything else is "in one run", so a bigger run replaces a smaller one rather than adding
  return Math.max(mission.at, run[def.stat as keyof RunTally]);
}

export const missionById = (id: string): MissionDef | undefined => MISSIONS.find((m) => m.id === id);
export const missionText = (m: Mission): string => missionById(m.id)?.text(m.n) ?? "";

/**
 * Roll a mission that is not already on the board. The target climbs with how many the player
 * has finished: the first ones are small enough to fall out of a normal run, and a mission that
 * has already been beaten this session is not worth writing down.
 */
export function rollMission(taken: readonly string[], done: number, roll: () => number = Math.random): Mission | null {
  const pool = MISSIONS.filter((m) => !taken.includes(m.id));
  if (!pool.length) return null;
  const def = pool[Math.floor(roll() * pool.length) % pool.length];
  const tier = Math.min(def.targets.length - 1, Math.floor(done / 6));
  return { id: def.id, n: def.targets[tier], pay: def.pays[tier], at: 0, done: false };
}

/**
 * Three for the day, and the same three all day.
 *
 * They used to be replaced the moment one was finished, which meant the board a player
 * looked at after a run was rarely the board they had been climbing for -- the thing they
 * had just earned vanished and a stranger took its place. A day's three stay put, finished
 * ones included, so you can see what you did as well as what is left.
 */
export function dailyBoard(done: number, roll: () => number = Math.random): Mission[] {
  return refill([], done, roll);
}

/** Fill a board up to three. Used to build a day's set; finished ones are never replaced. */
export function refill(current: Mission[], done: number, roll: () => number = Math.random): Mission[] {
  const out = current.filter((m) => !m.done);
  for (let guard = 0; out.length < 3 && guard < 20; guard++) {
    const next = rollMission(out.map((m) => m.id), done + guard, roll);
    if (!next) break;
    out.push(next);
  }
  return out;
}

/** Apply a finished run to the board. Returns the finished missions and what they paid. */
export function settle(board: Mission[], run: RunTally): { board: Mission[]; finished: Mission[]; paid: number } {
  const finished: Mission[] = [];
  const next = board.map((m) => {
    const def = missionById(m.id);
    if (!def || m.done) return m;
    const at = progressFor(def, m, run);
    const done = at >= m.n;
    const updated = { ...m, at: Math.min(at, m.n), done };
    if (done) finished.push(updated);
    return updated;
  });
  return { board: next, finished, paid: finished.reduce((n, m) => n + m.pay, 0) };
}

/**
 * The streak reward. Taking the daily climb pays a coin drop that grows with the streak, and
 * the seventh day in a row pays a pattern instead of coins. A missed day starts again at one:
 * the point is the habit, so the reward has to be worth protecting rather than worth grinding.
 */
export const STREAK_PAY = [40, 60, 80, 110, 150, 200, 0] as const;
export const STREAK_PATTERN_DAY = 7;
export function streakReward(days: number): { coins: number; pattern: boolean } {
  if (days <= 0) return { coins: 0, pattern: false };
  if (days % STREAK_PATTERN_DAY === 0) return { coins: 0, pattern: true };
  return { coins: STREAK_PAY[Math.min(STREAK_PAY.length - 2, (days - 1) % STREAK_PATTERN_DAY)], pattern: false };
}
