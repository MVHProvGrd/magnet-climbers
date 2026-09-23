/**
 * The game's clock: US Central time.
 *
 * The daily climb, the missions, the league week and the month's door all turn over at the
 * same moment for everyone, and that moment is midnight in Chicago rather than midnight UTC,
 * which fell at seven in the evening for the people who play most. One place decides what
 * "today" is, and both the game and the Worker ask it.
 */
export const GAME_ZONE = "America/Chicago";

const parts = new Intl.DateTimeFormat("en-US", { timeZone: GAME_ZONE, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" });

/** The calendar date in the game's zone at an instant. */
export function zoned(at = Date.now()): { y: number; m: number; d: number; h: number; min: number } {
  const p: Record<string, number> = {};
  for (const x of parts.formatToParts(new Date(at))) if (x.type !== "literal") p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute };
}

/** "YYYY-MM-DD" in the game's zone: the key the daily, the missions and the streak run on. */
export function dayKeyAt(at = Date.now()): string {
  const { y, m, d } = zoned(at);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The instant the next game day begins: the coming midnight in the game's zone. */
export function nextDayStart(at = Date.now()): number {
  const today = dayKeyAt(at);
  const { y, m, d } = zoned(at);
  // midnight Central is 05:00Z in summer and 06:00Z in winter; start at the earlier and step
  // forward while it is still today
  let t = Date.UTC(y, m - 1, d + 1, 5);
  for (let k = 0; k < 4 && dayKeyAt(t) === today; k++) t += 3600_000;
  return t;
}

/**
 * The world version a given day's fridge is built on. A generation change lands at midnight
 * Central, never mid-day: everyone who climbs today climbs the same door, whichever build
 * they are on, and tomorrow's is the new one. Older days stay on the version they were
 * climbed on, so their tapes still replay. `latest` is the newest world the caller can
 * build; a phone or Worker never claims a world it does not have.
 */
export const WORLD_BY_DAY: [string, number][] = [["2026-09-24", 28]];
export function dailyWorld(day: string, latest = 28): number {
  let v = 27;
  for (const [from, world] of WORLD_BY_DAY) if (day >= from) v = world;
  return Math.min(v, latest);
}
