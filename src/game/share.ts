/** Challenge links: ?c=<mode>.<cm>.<name>. Opening one shows the friend's height as a target line in your run. */
export interface Challenge {
  /** Kept in the link for the older links already out in the world; every run is solo now. */
  mode: "solo";
  cm: number;
  name: string;
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
    return u.toString();
  }
  return `${SHARE_BASE}/c/${encodeURIComponent(code)}${c.playerId ? `/${encodeURIComponent(c.playerId)}` : ""}${c.raceId ? `?r=${c.raceId}` : ""}`;
}

export function parseChallenge(): Challenge | null {
  const raw = new URLSearchParams(location.search).get("c");
  if (!raw) return null;
  const [mode, cmS, ...rest] = raw.split(".");
  const cm = Math.floor(Number(cmS));
  if ((mode !== "solo" && mode !== "crew") || !Number.isFinite(cm) || cm <= 0) return null;
  const race = new URLSearchParams(location.search).get("r") ?? "";
  // a link shared from the crew days still opens: its height becomes a solo target
  return { mode: "solo", cm, name: (rest.join(".") || "a friend").slice(0, 12), ...(/^[a-z0-9]{6,16}$/.test(race) ? { raceId: race } : {}) };
}

/** Drop the ?c= param so a reload does not re-trigger the challenge. */
export function clearChallengeParam(): void {
  const u = new URL(location.href);
  if (!u.searchParams.has("c")) return;
  u.searchParams.delete("c"); u.searchParams.delete("r");
  history.replaceState(history.state, "", u.pathname + u.search + u.hash);
}

/** Native share sheet where available, clipboard otherwise. Returns how it was delivered. */
export async function shareChallenge(c: Challenge): Promise<"shared" | "copied" | "failed"> {
  const url = buildChallengeUrl(c);
  const text = c.raceId
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
