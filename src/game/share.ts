/** Challenge links: ?c=<mode>.<cm>.<name>. Opening one shows the friend's height as a target line in your run. */
export interface Challenge {
  /** solo, or the daily climb; crew is kept in old links and read as solo */
  mode: "solo" | "daily";
  cm: number;
  name: string;
  /** a daily card: the day, and the streak it made, for the card and the invitation */
  day?: string;
  streak?: number;
  /** Sharer's scoreboard id; the share card checks the number against their recorded best. */
  playerId?: string;
  /** The shared run's tape on the Worker: opening the link races its ghost on the same fridge. */
  raceId?: string;
}

/** Share links go through the Worker so chat apps unfurl a score card; it redirects people to the game. */
const SHARE_BASE = (import.meta.env.VITE_SHARE_URL as string | undefined) || "https://share.magnetclimbers.com";

export function buildChallengeUrl(c: Challenge): string {
  const code = `${c.mode}.${c.cm}.${c.name}`;
  if (SHARE_BASE === "off") {
    const u = new URL(location.href);
    u.search = ""; u.hash = "";
    u.searchParams.set("c", code);
    if (c.raceId) u.searchParams.set("r", c.raceId);
    if (c.day) u.searchParams.set("d", c.day);
    return u.toString();
  }
  const q = [c.raceId ? `r=${c.raceId}` : "", c.day ? `d=${c.day}` : "", c.streak ? `st=${c.streak}` : ""].filter(Boolean).join("&");
  return `${SHARE_BASE}/c/${encodeURIComponent(code)}${c.playerId ? `/${encodeURIComponent(c.playerId)}` : ""}${q ? `?${q}` : ""}`;
}

export function parseChallenge(): Challenge | null {
  const raw = new URLSearchParams(location.search).get("c");
  if (!raw) return null;
  const [mode, cmS, ...rest] = raw.split(".");
  const cm = Math.floor(Number(cmS));
  if ((mode !== "solo" && mode !== "crew" && mode !== "daily") || !Number.isFinite(cm) || cm <= 0) return null;
  const q = new URLSearchParams(location.search);
  const race = q.get("r") ?? "", day = q.get("d") ?? "";
  // a link shared from the crew days still opens: its height becomes a solo target
  return { mode: mode === "daily" ? "daily" : "solo", cm, name: (rest.join(".") || "a friend").slice(0, 12),
    ...(/^[a-z0-9]{6,16}$/.test(race) ? { raceId: race } : {}), ...(/^\d{4}-\d{2}-\d{2}$/.test(day) ? { day } : {}) };
}

/** Drop the ?c= param so a reload does not re-trigger the challenge. */
export function clearChallengeParam(): void {
  const u = new URL(location.href);
  if (!u.searchParams.has("c")) return;
  u.searchParams.delete("c"); u.searchParams.delete("r"); u.searchParams.delete("d");
  history.replaceState(history.state, "", u.pathname + u.search + u.hash);
}

/** Native share sheet where available, clipboard otherwise. Returns how it was delivered. */
export async function shareChallenge(c: Challenge): Promise<"shared" | "copied" | "failed"> {
  const url = buildChallengeUrl(c);
  const text = c.mode === "daily"
    ? `I climbed ${c.cm} cm on today's fridge in Magnet Climbers${c.streak && c.streak > 1 ? `, ${c.streak} days running` : ""}. Same fridge for everyone, one go each:`
    : c.raceId
    ? `I climbed ${c.cm} cm up the fridge in Magnet Climbers. Race my ghost:`
    : `I climbed ${c.cm} cm up the fridge in Magnet Climbers (${c.mode}). Beat me:`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Magnet Climbers", text, url });
      return "shared";
    }
  } catch {
    /* user cancelled or share failed; fall through to clipboard */
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
