/**
 * When the reminders go out, and what they say. Kept apart from the Worker so the clock
 * can be tested: the cron runs every hour, and this decides which notices that hour is.
 *
 * Three nudges, all on the game's Central clock:
 *  - daily, 6 pm: today's fridge is still waiting (only to those who have not climbed it)
 *  - league, Monday 9 am: how last week ended and where that leaves you
 *  - month, the 1st at 9 am: a new door and a new pattern to earn
 */
import { zoned, dayKeyAt } from "../../src/game/day";
import { weekKey } from "./week";

export type NoticeKind = "daily" | "league" | "month";

/** The notices due at this instant, each with the key that stops it going out twice. */
export function dueNotices(now = Date.now()): { kind: NoticeKind; key: string }[] {
  const t = zoned(now);
  const out: { kind: NoticeKind; key: string }[] = [];
  const day = dayKeyAt(now);
  if (t.h === 18) out.push({ kind: "daily", key: day });
  // Monday in Chicago: the date's weekday, taken on a UTC calendar of the Central date
  const weekday = new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay();
  if (t.h === 9 && weekday === 1) out.push({ kind: "league", key: weekKey(now) });
  if (t.h === 9 && t.d === 1) out.push({ kind: "month", key: day.slice(0, 7) });
  return out;
}

export interface Notice { title: string; body: string; url: string; tag: string }

export const dailyNotice = (): Notice => ({
  title: "Today's fridge is still waiting",
  body: "One go each, same door for everyone. Six hours until it changes.",
  url: "https://magnetclimbers.com/?open=daily", tag: "daily",
});

export const monthNotice = (name: string, month: string): Notice => ({
  title: `${month}'s door is up: ${name}`,
  body: "A fresh fridge for the month, and a pattern only this month gives out. Climb once to keep it.",
  url: "https://magnetclimbers.com/", tag: "month",
});

export const leagueNotice = (tierName: string, rank: number | null, members: number, moved: "up" | "down" | "held"): Notice => ({
  title: moved === "up" ? `Up a tier: welcome to ${tierName}` : moved === "down" ? `Down a tier, to ${tierName}` : `Still ${tierName} this week`,
  body: rank ? `You finished #${rank} of ${members} in your bucket last week. A new week starts now.` : "A new league week starts now. Every metre counts.",
  url: "https://magnetclimbers.com/?open=league", tag: "league",
});
