/**
 * Challenge share cards: /c/<mode>.<cm>.<name> serves Open Graph HTML for link
 * unfurlers (Discord, iMessage, Slack...) and redirects people to the game;
 * /c/<code>.png is the 1200x630 score card, rendered from SVG with resvg.
 */
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import cardFont from "../assets/card-font.ttf";
import cardBase from "../assets/card-base.jpg";

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

function b64(buf: ArrayBuffer): string {
  let out = ""; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}
let baseUri: string | null = null;

/** The score card: cover photo + logo (pre-composed in assets/card-base.jpg) with the numbers on top. */
export function cardSvg(c: Challenge): string {
  if (!baseUri) baseUri = "data:image/jpeg;base64," + b64(cardBase);
  const mode = c.mode === "crew" ? "CREW CLIMB" : "SOLO CLIMB";
  const cx = 852;
  const big = c.cm >= 100_000 ? 118 : 140;
  const glow = 'stroke="#000" stroke-opacity="0.55" stroke-width="10" stroke-linejoin="round" paint-order="stroke"';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Liberation Sans" font-weight="700">
<image href="${baseUri}" x="0" y="0" width="1200" height="630"/>
<text x="${cx}" y="330" text-anchor="middle" font-size="46" fill="#ffffff" ${glow}>${esc(c.name)} climbed</text>
<text x="${cx}" y="460" text-anchor="middle" font-size="${big}" fill="#ffd54a" ${glow}>${fmt(c.cm)}<tspan font-size="56" fill="#ffffff" dx="10">cm</tspan></text>
<rect x="${cx - 118}" y="492" width="236" height="46" rx="23" fill="${c.mode === "crew" ? "#3d7bff" : "#f26d1d"}"/>
<text x="${cx}" y="524" text-anchor="middle" font-size="25" fill="#fff" letter-spacing="3">${mode}</text>
<text x="${cx}" y="590" text-anchor="middle" font-size="34" fill="#ffffff" ${glow}>Can you get higher?</text>
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
