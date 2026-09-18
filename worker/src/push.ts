/**
 * Web Push from the Worker, with nothing but WebCrypto.
 *
 * A push is a small encrypted message posted to the URL a browser handed the game when the
 * player said yes to reminders. Two standards make it up, and both are short enough to do
 * here rather than pull in a Node library that would not run on a Worker anyway:
 *
 *  - VAPID (RFC 8292): the Worker proves it is the one sending, with a short-lived JWT signed
 *    by an ES256 key whose public half the browser was given when it subscribed.
 *  - aes128gcm (RFC 8291 / 8188): the payload is encrypted to the subscription's own P-256
 *    key, so the push service in the middle carries bytes it cannot read.
 *
 * The private key lives in a secret (VAPID_PRIVATE_KEY, a JWK), the public one in a var;
 * scripts/vapid-keys.mjs makes a pair.
 */

export interface PushSubscriptionRow { endpoint: string; p256dh: string; auth: string }

const enc = new TextEncoder();
const b64url = (b: ArrayBuffer | Uint8Array): string =>
  btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string): Uint8Array => {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad), (c) => c.charCodeAt(0));
};
const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

/** The VAPID token: who is sending, to which push service, until when. Twelve hours is the spec's ceiling in spirit. */
export async function vapidJwt(privateJwk: JsonWebKey, audience: string, subject: string, now = Date.now()): Promise<string> {
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64url(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource }, key, length * 8));
}

/** RFC 8291: the payload, encrypted to the subscription, in one aes128gcm record. */
export async function encryptPayload(sub: PushSubscriptionRow, plaintext: string): Promise<Uint8Array> {
  const uaPublic = fromB64url(sub.p256dh);
  const authSecret = fromB64url(sub.auth);
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey } as unknown as Parameters<SubtleCrypto["deriveBits"]>[0], local.privateKey, 256));
  // the key the two sides share, bound to both public keys and the subscription's auth secret
  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  // one record: the plaintext, then the 0x02 delimiter that marks the last record
  const padded = concat(enc.encode(plaintext), new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aes, padded as BufferSource));
  // the header: salt, record size, the sender's public key
  const header = concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic);
  return concat(header, cipher);
}

export interface PushOutcome { ok: boolean; status: number; gone: boolean }

/**
 * Deliver one push. `gone` says the subscription is dead (404/410) and should be dropped;
 * anything else that fails is left for next time.
 */
export async function sendPush(sub: PushSubscriptionRow, payload: unknown, keys: { publicKey: string; privateJwk: JsonWebKey; subject: string }, ttlSeconds = 6 * 3600): Promise<PushOutcome> {
  const url = new URL(sub.endpoint);
  const jwt = await vapidJwt(keys.privateJwk, url.origin, keys.subject);
  const body = await encryptPayload(sub, JSON.stringify(payload));
  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: String(ttlSeconds),
      Urgency: "normal",
      Authorization: `vapid t=${jwt}, k=${keys.publicKey}`,
    },
    body: body as BufferSource,
  }).catch(() => null);
  if (!r) return { ok: false, status: 0, gone: false };
  return { ok: r.ok, status: r.status, gone: r.status === 404 || r.status === 410 };
}
