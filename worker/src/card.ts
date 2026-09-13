/**
 * Challenge share cards: /c/<mode>.<cm>.<name> serves Open Graph HTML for link
 * unfurlers (Discord, iMessage, Slack...) and redirects people to the game;
 * /c/<code>.png is the 1200x630 score card, rendered from SVG with resvg.
 */
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import cardFont from "../assets/card-font.ttf";

export interface Challenge { mode: "solo" | "crew"; cm: number; name: string; code: string }

export const GAME_URL = "https://magnetclimbers.com/";

export function parseCode(raw: string): Challenge | null {
  let code: string;
  try { code = decodeURIComponent(raw); } catch { return null; }
  const [mode, cmS, ...rest] = code.split(".");
  const cm = Math.floor(Number(cmS));
  if ((mode !== "solo" && mode !== "crew") || !Number.isFinite(cm) || cm <= 0 || cm > 200_000) return null;
  const name = (rest.join(".") || "a friend").replace(/[^\p{L}\p{N} _.\-!?]/gu, "").slice(0, 12).trim() || "a friend";
  return { mode, cm, name, code: `${mode}.${cm}.${name}` };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (cm: number) => cm.toLocaleString("en-US");

export function isUnfurler(ua: string): boolean {
  return /bot|crawler|spider|preview|facebookexternalhit|discord|slack|telegram|whatsapp|twitter|imessage|skype|linkedin|pinterest|embed|fetch|curl|wget|http/i.test(ua);
}

export function cardHtml(c: Challenge, origin: string): string {
  const title = `${c.name} climbed ${fmt(c.cm)} cm`;
  const desc = `${c.mode === "crew" ? "Crew" : "Solo"} climb in Magnet Climbers. Can you get higher? Slingshot rubbery magnet people up an endless fridge.`;
  const img = `${origin.replace(/^http:/, "https:")}/c/${encodeURIComponent(c.code)}.png`;
  const play = `${GAME_URL}?c=${encodeURIComponent(c.code)}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)} · Magnet Climbers</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#1c1f24">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Magnet Climbers">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(play)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(play)}">
<style>body{margin:0;background:#1c1f24;color:#eee;font:16px system-ui;display:grid;place-items:center;min-height:100vh}a{color:#ffb74d}</style>
</head><body><p>${esc(title)}. <a href="${esc(play)}">Accept the challenge</a></p></body></html>`;
}

/** The score card as SVG. Stainless door, red target line, an orange magnet toy and the numbers. */
export function cardSvg(c: Challenge): string {
  const mode = c.mode === "crew" ? "CREW CLIMB" : "SOLO CLIMB";
  const lines = Array.from({ length: 60 }, (_, i) => {
    const x = 18 + i * 19.7 + ((i * 37) % 11);
    const a = 0.05 + ((i * 53) % 7) / 60;
    return `<line x1="${x}" y1="0" x2="${x}" y2="630" stroke="#fff" stroke-opacity="${a.toFixed(2)}" stroke-width="${1 + (i % 3)}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Liberation Sans">
<defs>
  <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#c9ced4"/><stop offset="0.35" stop-color="#e9ecef"/><stop offset="0.6" stop-color="#b9bfc6"/><stop offset="1" stop-color="#d9dde2"/>
  </linearGradient>
  <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2a2f36"/><stop offset="1" stop-color="#16191d"/>
  </linearGradient>
  <linearGradient id="orange" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffb457"/><stop offset="1" stop-color="#f26d1d"/>
  </linearGradient>
  <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#e0455c"/><stop offset="1" stop-color="#8e1f2f"/>
  </linearGradient>
</defs>
<rect width="1200" height="630" fill="url(#steel)"/>
<g>${lines}</g>
<rect x="596" y="0" width="8" height="630" fill="#1a1d21"/>
<rect x="604" y="0" width="3" height="630" fill="#fff" fill-opacity="0.5"/>
<!-- fridge handle -->
<rect x="540" y="160" width="26" height="310" rx="13" fill="#9aa1a8"/>
<rect x="546" y="166" width="8" height="298" rx="4" fill="#fff" fill-opacity="0.55"/>
<!-- red N plate -->
<rect x="90" y="70" width="120" height="120" rx="14" fill="url(#plate)" stroke="#5a1019" stroke-width="4"/>
<text x="150" y="152" text-anchor="middle" font-size="76" font-weight="700" fill="#ffd0d8">N</text>
<g stroke="#ff687d" fill="none" stroke-width="3" stroke-opacity="0.55">
  <path d="M84 70 A66 66 0 0 1 216 70"/><path d="M70 70 A80 80 0 0 1 230 70" stroke-opacity="0.3"/>
  <path d="M84 190 A66 66 0 0 0 216 190"/><path d="M70 190 A80 80 0 0 0 230 190" stroke-opacity="0.3"/>
</g>
<!-- target line -->
<line x1="0" y1="300" x2="596" y2="300" stroke="#e5323e" stroke-width="5" stroke-dasharray="22 14"/>
<rect x="24" y="258" width="${Math.min(430, 60 + c.name.length * 22)}" height="34" rx="8" fill="#e5323e"/>
<text x="40" y="282" font-size="22" font-weight="700" fill="#fff">${esc(c.name.toUpperCase())}'S LINE</text>
<!-- toy climber stuck below the line -->
<g transform="translate(330 420)">
  <ellipse cx="14" cy="26" rx="84" ry="60" fill="#000" fill-opacity="0.16"/>
  <path d="M-60 -20 Q-40 20 -14 30" stroke="url(#orange)" stroke-width="22" stroke-linecap="round" fill="none"/>
  <path d="M60 -20 Q40 20 14 30" stroke="url(#orange)" stroke-width="22" stroke-linecap="round" fill="none"/>
  <path d="M-44 76 Q-30 40 -10 24" stroke="url(#orange)" stroke-width="24" stroke-linecap="round" fill="none"/>
  <path d="M44 76 Q30 40 10 24" stroke="url(#orange)" stroke-width="24" stroke-linecap="round" fill="none"/>
  <rect x="-26" y="-12" width="52" height="70" rx="24" fill="url(#orange)"/>
  <circle cx="0" cy="-34" r="28" fill="url(#orange)"/>
  <circle cx="-9" cy="-38" r="4" fill="#3a1d05"/><circle cx="9" cy="-38" r="4" fill="#3a1d05"/>
  <path d="M-9 -24 Q0 -17 9 -24" stroke="#3a1d05" stroke-width="3" fill="none" stroke-linecap="round"/>
  <g fill="#d8dde2" stroke="#6d757d" stroke-width="3">
    <circle cx="-62" cy="-22" r="11"/><circle cx="62" cy="-22" r="11"/><circle cx="-46" cy="80" r="11"/><circle cx="46" cy="80" r="11"/>
  </g>
</g>
<!-- score panel -->
<rect x="640" y="48" width="512" height="534" rx="28" fill="url(#panel)" stroke="#3b424a" stroke-width="3"/>
<text x="896" y="118" text-anchor="middle" font-size="30" font-weight="700" fill="#ffb74d" letter-spacing="6">MAGNET CLIMBERS</text>
<text x="896" y="196" text-anchor="middle" font-size="50" font-weight="700" fill="#ffffff">${esc(c.name)}</text>
<text x="896" y="226" text-anchor="middle" font-size="24" fill="#aab2bb">climbed</text>
<text x="896" y="330" text-anchor="middle" font-size="${c.cm >= 100_000 ? 92 : 112}" font-weight="700" fill="#ffffff">${fmt(c.cm)}</text>
<text x="896" y="372" text-anchor="middle" font-size="36" font-weight="700" fill="#aab2bb">cm</text>
<rect x="776" y="404" width="240" height="46" rx="23" fill="${c.mode === "crew" ? "#3d7bff" : "#f26d1d"}"/>
<text x="896" y="436" text-anchor="middle" font-size="26" font-weight="700" fill="#fff" letter-spacing="3">${mode}</text>
<text x="896" y="512" text-anchor="middle" font-size="34" font-weight="700" fill="#ffffff">Can you get higher?</text>
<text x="896" y="552" text-anchor="middle" font-size="24" fill="#aab2bb">magnetclimbers.com</text>
</svg>`;
}

let wasmReady: Promise<void> | null = null;
export async function cardPng(c: Challenge): Promise<Uint8Array> {
  if (!wasmReady) wasmReady = initWasm(resvgWasm as unknown as WebAssembly.Module).catch((e) => { wasmReady = null; throw e; });
  await wasmReady;
  const r = new Resvg(cardSvg(c), {
    fitTo: { mode: "width", value: 1200 },
    font: { fontBuffers: [new Uint8Array(cardFont)], loadSystemFonts: false, defaultFontFamily: "Liberation Sans" },
  });
  const img = r.render();
  const png = img.asPng();
  img.free(); r.free();
  return png;
}

/** Handles /c/... routes; returns null for anything else. */
export async function handleShare(req: Request, url: URL, profane: (c: Challenge) => boolean): Promise<Response | null> {
  if (url.pathname === "/" && url.hostname.startsWith("share.")) return Response.redirect(GAME_URL, 302);
  const m = url.pathname.match(/^\/c\/([^/]+?)(\.png)?$/);
  if (!m) return null;
  const c = parseCode(m[1]);
  if (!c) return Response.redirect(GAME_URL, 302);
  if (profane(c)) { c.name = "A climber"; c.code = `${c.mode}.${c.cm}.A climber`; }
  const cache = "public, max-age=86400";
  if (m[2]) {
    const png = await cardPng(c);
    return new Response(png as BodyInit, { headers: { "Content-Type": "image/png", "Cache-Control": cache, "Content-Length": String(png.byteLength) } });
  }
  if (!isUnfurler(req.headers.get("User-Agent") ?? "")) {
    return Response.redirect(`${GAME_URL}?c=${encodeURIComponent(c.code)}`, 302);
  }
  return new Response(cardHtml(c, url.origin), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": cache } });
}
