/**
 * Accounts: a Firebase sign-in on the phone, checked here without Firebase.
 *
 * The phone signs in with Google or Apple through the Firebase Auth SDK and gets an ID token:
 * a JWT signed by Google with keys it publishes. Verifying one needs no admin SDK and no
 * secret -- fetch the public keys, check the signature with WebCrypto, and check the claims
 * say this project, this time, this user. The `uid` that falls out is the account; the
 * `accounts` table maps it to the player profile (player_id + token) the game already runs
 * on, so signing in on a second phone is the same adoption a link code does today.
 */

export interface FirebaseIdentity {
  uid: string;
  email?: string;
  name?: string;
  /** "google.com", "apple.com" ... whatever Firebase says signed them in */
  provider?: string;
}

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

interface Jwk { kid: string; kty: string; alg: string; n: string; e: string; use?: string }
export type Jwks = () => Promise<Jwk[]>;

/** Google's current signing keys, kept for as long as their Cache-Control allows. */
let cached: { keys: Jwk[]; until: number } | null = null;
export const googleJwks: Jwks = async () => {
  if (cached && cached.until > Date.now()) return cached.keys;
  const r = await fetch(JWKS_URL);
  if (!r.ok) throw new Error(`jwks ${r.status}`);
  const j = (await r.json()) as { keys: Jwk[] };
  const maxAge = /max-age=(\d+)/.exec(r.headers.get("Cache-Control") ?? "")?.[1];
  cached = { keys: j.keys, until: Date.now() + (maxAge ? Number(maxAge) * 1000 : 3600_000) };
  return j.keys;
};

const b64url = (s: string): Uint8Array => {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const utf8 = (b: Uint8Array): string => new TextDecoder().decode(b);

/**
 * Verify a Firebase ID token for `projectId` and return who it names. Throws with a short
 * reason on anything wrong: a bad signature, a token for another project, one that has
 * expired or was issued in the future, one with no subject.
 */
export async function verifyFirebaseIdToken(idToken: string, projectId: string, jwks: Jwks = googleJwks, now = Date.now()): Promise<FirebaseIdentity> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  let header: { alg?: string; kid?: string }, claims: Record<string, unknown>;
  try {
    header = JSON.parse(utf8(b64url(parts[0])));
    claims = JSON.parse(utf8(b64url(parts[1])));
  } catch { throw new Error("malformed token"); }
  if (header.alg !== "RS256" || !header.kid) throw new Error("unexpected algorithm");
  const key = (await jwks()).find((k) => k.kid === header.kid);
  if (!key) throw new Error("unknown signing key");
  const pub = await crypto.subtle.importKey("jwk", { kty: key.kty, n: key.n, e: key.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", pub, b64url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new Error("bad signature");
  const sec = Math.floor(now / 1000);
  const num = (k: string) => (typeof claims[k] === "number" ? (claims[k] as number) : NaN);
  if (!(num("exp") > sec)) throw new Error("token expired");
  if (!(num("iat") <= sec + 60)) throw new Error("token from the future");
  if (!(num("auth_time") <= sec + 60)) throw new Error("token from the future");
  if (claims.aud !== projectId) throw new Error("token for another project");
  if (claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("token from another issuer");
  const uid = typeof claims.sub === "string" ? claims.sub : "";
  if (!uid || uid.length > 128) throw new Error("no subject");
  const firebase = claims.firebase as { sign_in_provider?: string } | undefined;
  return {
    uid,
    ...(typeof claims.email === "string" ? { email: claims.email } : {}),
    ...(typeof claims.name === "string" ? { name: claims.name } : {}),
    ...(firebase?.sign_in_provider ? { provider: firebase.sign_in_provider } : {}),
  };
}
