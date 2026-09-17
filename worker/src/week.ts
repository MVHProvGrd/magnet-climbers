/**
 * ISO week, UTC — the league's clock, kept in its own file so the game's tests can check it
 * without pulling the Worker (and its Cloudflare types) in behind it.
 *
 * A week belongs to the year of its Thursday, which is what keeps the turn of the year sane:
 * 1 January 2027 is a Friday, so it is still 2026-W53.
 */
export function weekKey(at = Date.now()): string {
  const d = new Date(at);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const first = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thursday.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
