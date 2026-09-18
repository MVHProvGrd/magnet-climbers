// One VAPID key pair for Web Push. Run once:
//   node scripts/vapid-keys.mjs
// Paste VAPID_PUBLIC_KEY into worker/wrangler.toml [vars], and give the private JWK to the
// Worker as a secret:  npx wrangler secret put VAPID_PRIVATE_KEY   (paste the JSON line)
import { webcrypto } from "node:crypto";
const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const pub = b64url(await webcrypto.subtle.exportKey("raw", pair.publicKey));
const priv = await webcrypto.subtle.exportKey("jwk", pair.privateKey);
console.log(`VAPID_PUBLIC_KEY = "${pub}"`);
console.log(`VAPID_PRIVATE_KEY (secret): ${JSON.stringify(priv)}`);
