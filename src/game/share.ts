/** Challenge links: ?c=<mode>.<cm>.<name>. Opening one shows the friend's height as a target line in your run. */
export interface Challenge {
  mode: "solo" | "crew";
  cm: number;
  name: string;
}

/** Share links go through the Worker so chat apps unfurl a score card; it redirects people to the game. */
const SHARE_BASE = (import.meta.env.VITE_SHARE_URL as string | undefined) || "https://share.magnetclimbers.com";

export function buildChallengeUrl(c: Challenge): string {
  const code = `${c.mode}.${c.cm}.${c.name}`;
  if (SHARE_BASE === "off") {
    const u = new URL(location.href);
    u.search = ""; u.hash = "";
    u.searchParams.set("c", code);
    return u.toString();
  }
  return `${SHARE_BASE}/c/${encodeURIComponent(code)}`;
}

export function parseChallenge(): Challenge | null {
  const raw = new URLSearchParams(location.search).get("c");
  if (!raw) return null;
  const [mode, cmS, ...rest] = raw.split(".");
  const cm = Math.floor(Number(cmS));
  if ((mode !== "solo" && mode !== "crew") || !Number.isFinite(cm) || cm <= 0) return null;
  return { mode, cm, name: (rest.join(".") || "a friend").slice(0, 12) };
}

/** Drop the ?c= param so a reload does not re-trigger the challenge. */
export function clearChallengeParam(): void {
  const u = new URL(location.href);
  if (!u.searchParams.has("c")) return;
  u.searchParams.delete("c");
  history.replaceState(history.state, "", u.pathname + u.search + u.hash);
}

/** Native share sheet where available, clipboard otherwise. Returns how it was delivered. */
export async function shareChallenge(c: Challenge): Promise<"shared" | "copied" | "failed"> {
  const url = buildChallengeUrl(c);
  const text = `I climbed ${c.cm} cm up the fridge in Magnet Climbers (${c.mode}). Beat me:`;
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
