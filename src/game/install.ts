/**
 * Installing the game to a home screen.
 *
 * A browser tab is a worse place to play this than an icon on a home screen: no address bar
 * eating the top of the door, no accidental back-swipe mid-fling, and the game is there the
 * next morning without anyone having to remember a URL. Chrome and Edge will offer that
 * themselves, eventually, in a banner most people dismiss without reading. Better to ask
 * once, in our own words, at a moment the player is already pleased.
 *
 * Two platforms, two different jobs:
 *
 * - Chrome, Edge and Android fire `beforeinstallprompt` before showing their own UI. We
 *   swallow it and keep it, so an "Install" button of ours can raise the real dialog.
 * - iOS has no install API at all. Safari can only do it through Share -> Add to Home
 *   Screen, so there is nothing to call: all we can do is say which buttons to press.
 *
 * The event fires once, early, usually before the menu exists, so this module listens at
 * import time and hands the captured event to whoever asks later.
 */

/** Not in the DOM lib types, so declare the part we use. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Already launched from a home screen: there is nothing left to install. */
function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

/**
 * iPhone and iPad, where installing is a manual errand. iPadOS 13 and later claim to be a
 * Mac, so a Mac that answers to touch is really an iPad.
 */
function detectIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && "ontouchend" in document);
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = detectStandalone();
const subs = new Set<() => void>();
const notify = () => subs.forEach((s) => s());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

/** Called when the answer changes, so an open Settings panel can redraw its row. */
export function onInstallChange(fn: () => void): () => void {
  subs.add(fn);
  return () => { subs.delete(fn); };
}

export interface InstallState {
  /** Running from a home screen already. */
  installed: boolean;
  /** A real install dialog is available right now. */
  canPrompt: boolean;
  /** iOS, not installed: show the Share -> Add to Home Screen steps instead. */
  isIOS: boolean;
}

export function installState(): InstallState {
  const home = installed || detectStandalone();
  return { installed: home, canPrompt: !!deferred && !home, isIOS: detectIOS() && !home };
}

/** Raise the browser's own install dialog. A captured prompt can only be spent once. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  if (outcome === "accepted") installed = true;
  deferred = null;
  notify();
  return outcome;
}

/**
 * Whether to nudge, and remember that we did. One offer, after a player has climbed enough
 * times to have decided they like it; never again if they said no. A prompt on the first
 * run is a prompt to an audience that has not played the game yet.
 */
const ASKED_KEY = "mc-install-asked";
export const RUNS_BEFORE_ASKING = 3;

export function shouldOfferInstall(runs: number): boolean {
  const s = installState();
  if (s.installed || runs < RUNS_BEFORE_ASKING) return false;
  if (!s.canPrompt && !s.isIOS) return false;
  try { return !localStorage.getItem(ASKED_KEY); } catch { return false; }
}

export function markInstallAsked(): void {
  try { localStorage.setItem(ASKED_KEY, "1"); } catch { /* private window: ask again, no harm */ }
}
