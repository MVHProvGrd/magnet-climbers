/**
 * Accounts, from the phone's side: a Firebase sign-in, then the Worker ties the account to
 * the profile (see worker/src/auth.ts).
 *
 * The Firebase SDK is not in the bundle. It is fetched from Google's CDN the first time
 * somebody taps Sign in, so the game a player who never signs in downloads is the same size
 * as before. Everything is off until VITE_FIREBASE_CONFIG is set at build time.
 */
import { API, leaderboardEnabled } from "./leaderboard";

interface FirebaseConfig { apiKey: string; authDomain: string; projectId: string }

const CONFIG: FirebaseConfig | null = (() => {
  const raw = ((import.meta.env.VITE_FIREBASE_CONFIG as string | undefined) ?? "").trim();
  if (!raw) return null;
  try { const c = JSON.parse(raw) as FirebaseConfig; return c.apiKey && c.authDomain && c.projectId ? c : null; } catch { return null; }
})();

export const accountsEnabled = !!CONFIG && leaderboardEnabled;

export type Provider = "google" | "apple";

/** What the Worker answers: either the account already plays as another profile (adopt it), or it now plays as this one. */
export type AuthResult =
  | { ok: true; adopted: false; playerId: string; uid: string; provider: string | null; email: string | null }
  | { ok: true; adopted: true; playerId: string; token: string; blob: string; rev: number; uid: string; provider: string | null; email: string | null };

const SDK = "https://www.gstatic.com/firebasejs/11.3.0";

/** The pieces of the SDK this needs, typed loosely: the SDK is loaded by URL, not by import. */
interface FirebaseAuth {
  auth: unknown;
  signInWithPopup: (auth: unknown, provider: unknown) => Promise<{ user: { getIdToken: (force?: boolean) => Promise<string> } }>;
  signInWithRedirect: (auth: unknown, provider: unknown) => Promise<never>;
  getRedirectResult: (auth: unknown) => Promise<{ user: { getIdToken: (force?: boolean) => Promise<string> } } | null>;
  signOut: (auth: unknown) => Promise<void>;
  GoogleAuthProvider: new () => unknown;
  OAuthProvider: new (id: string) => unknown;
}

let sdk: Promise<FirebaseAuth> | null = null;
function load(): Promise<FirebaseAuth> {
  if (!CONFIG) return Promise.reject(new Error("accounts are off"));
  if (sdk) return sdk;
  sdk = (async () => {
    const [app, auth] = await Promise.all([
      import(/* @vite-ignore */ `${SDK}/firebase-app.js`),
      import(/* @vite-ignore */ `${SDK}/firebase-auth.js`),
    ]);
    const a = app.initializeApp(CONFIG);
    return { auth: auth.getAuth(a), signInWithPopup: auth.signInWithPopup, signInWithRedirect: auth.signInWithRedirect, getRedirectResult: auth.getRedirectResult, signOut: auth.signOut, GoogleAuthProvider: auth.GoogleAuthProvider, OAuthProvider: auth.OAuthProvider };
  })();
  return sdk;
}

/** An installed app on iOS cannot open a sign-in popup; it leaves for the provider and comes back. */
const standalone = () => typeof matchMedia === "function" && (matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

/** Sign in with a provider and hand the ID token to the Worker. Null when the player backed out. */
export async function signIn(provider: Provider, playerId: string, token: string): Promise<AuthResult | null> {
  const f = await load();
  const p = provider === "google" ? new f.GoogleAuthProvider() : new f.OAuthProvider("apple.com");
  if (standalone()) {
    try { sessionStorage.setItem("mc-auth-redirect", "1"); } catch { /* fine */ }
    await f.signInWithRedirect(f.auth, p); return null;
  }
  let idToken: string;
  try { idToken = await (await f.signInWithPopup(f.auth, p)).user.getIdToken(); }
  catch (err) {
    const code = String((err as { code?: string })?.code ?? "");
    if (/cancelled|closed-by-user|popup-blocked/.test(code)) return null;
    throw err;
  }
  return tie(idToken, playerId, token);
}

/** After a redirect sign-in the app comes back with the result waiting; pick it up on boot. */
export async function finishRedirect(playerId: string, token: string): Promise<AuthResult | null> {
  if (!accountsEnabled) return null;
  // nothing to pick up unless we left for a provider; the SDK is not fetched for a plain boot
  let left = false;
  try { left = sessionStorage.getItem("mc-auth-redirect") === "1"; sessionStorage.removeItem("mc-auth-redirect"); } catch { /* fine */ }
  if (!left) return null;
  const f = await load();
  const r = await f.getRedirectResult(f.auth);
  if (!r) return null;
  return tie(await r.user.getIdToken(), playerId, token);
}

async function tie(idToken: string, playerId: string, token: string): Promise<AuthResult> {
  const r = await fetch(`${API}/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, playerId, token }) });
  const j = (await r.json().catch(() => ({}))) as AuthResult & { error?: string; reason?: string };
  if (!r.ok || !j.ok) throw new Error(j.reason ?? j.error ?? `auth ${r.status}`);
  return j;
}

export async function signOut(): Promise<void> {
  if (!sdk) return;
  const f = await sdk;
  await f.signOut(f.auth);
}
