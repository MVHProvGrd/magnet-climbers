/**
 * ISO week of the Central date — the league's clock, kept in its own file so the game's tests
 * can check it without pulling in the Worker. A week turns over at midnight Central on Monday.
 */
import { zoned } from "../../src/game/day";

export function weekKey(at = Date.now()): string {
  const { y, m, d } = zoned(at);
  // the ISO week is the one holding the date's Thursday; computed on a UTC calendar of the
  // Central date so no zone shift can move it
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(y, m - 1, d - day + 3));
  const first = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thursday.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
