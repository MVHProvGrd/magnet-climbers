/**
 * Environment materials: brushed steel, door seam, glass, plastic trim, gaps,
 * stickers/souvenir magnets, repel plates, bumpers and steel handles.
 *
 * Rules: every collider keeps its exact rect (art may only add shadow/bevel
 * *outside* a non-stick zone, never suggest steel inside one). Static textures
 * are cached once; per-frame work is gradients and a few primitives.
 * Nothing here touches simulation state.
 */
import { W } from "./config";
import type { Bumper, NoStickZone } from "./types";
import { themeFor } from "./fridge-theme";
import { DOOR_SEAM } from "./world";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Deterministic 0..1 from a few numbers, so decoration never flickers. */
function hash(...n: number[]): number {
  let h = 2166136261;
  for (const v of n) {
    h ^= Math.floor(v * 1000) & 0xffffffff;
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Soft contact shadow cast down/right, matching the character shadows. */
function castShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, lift = 1) {
  ctx.save();
  ctx.fillStyle = `rgba(20,26,34,${0.16 + lift * 0.06})`;
  roundRectPath(ctx, x + 2.5 * lift, y + 3.5 * lift, w, h, r);
  ctx.fill();
  ctx.fillStyle = "rgba(20,26,34,0.08)";
  roundRectPath(ctx, x + 5 * lift, y + 7 * lift, w, h, r);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// brushed steel
// ---------------------------------------------------------------------------

const TILE = 512;
let grainTile: HTMLCanvasElement | null = null;
let grainPattern: CanvasPattern | null = null;

/** Fine vertical grain, low contrast, built once from a fixed seed. */
function grain(ctx: CanvasRenderingContext2D): CanvasPattern {
  if (grainPattern) return grainPattern;
  const c = document.createElement("canvas");
  c.width = TILE;
  c.height = TILE;
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080"; // neutral under "overlay": contributes grain only, no lift
  g.fillRect(0, 0, TILE, TILE);
  // thousands of faint hairlines, varying length, both lighter and darker
  for (let i = 0; i < 6000; i++) {
    const x = hash(i, 1) * TILE;
    const y = hash(i, 2) * TILE;
    const len = 14 + hash(i, 3) * 120;
    const light = hash(i, 4) < 0.5;
    const a = 0.03 + hash(i, 5) * 0.07;
    g.strokeStyle = light ? `rgba(255,255,255,${a * 1.6})` : `rgba(20,26,34,${a * 1.6})`;
    g.lineWidth = hash(i, 6) < 0.85 ? 1 : 1.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y + len);
    g.stroke();
    // wrap so the tile seams vertically
    if (y + len > TILE) {
      g.beginPath();
      g.moveTo(x, y - TILE);
      g.lineTo(x, y - TILE + len);
      g.stroke();
    }
  }
  // a few slightly broader, softer streaks for that swirl-free brushed look
  for (let i = 0; i < 90; i++) {
    const x = hash(i, 7) * TILE;
    const w = 3 + hash(i, 8) * 9;
    const a = 0.025 + hash(i, 9) * 0.03;
    g.fillStyle = hash(i, 10) < 0.5 ? `rgba(255,255,255,${a})` : `rgba(30,38,50,${a})`;
    g.fillRect(x, 0, w, TILE);
  }
  grainTile = c;
  grainPattern = ctx.createPattern(c, "repeat")!;
  return grainPattern;
}

/**
 * Stainless door surface. Grain is a cached tile; lighting is a few gradients:
 * broad window light from upper-left, a cooler right door, and a faint warm
 * kitchen bounce low-left. Lighting is fixed in screen space so it reads as a
 * window in the room, not something painted on the door.
 */
/** Base tone + grain baked into one world-locked tile, so a frame is a few blits instead of an overlay blend. */
let steelTile: { key: string; canvas: HTMLCanvasElement } | null = null;
function steel(ctx: CanvasRenderingContext2D, scale: number): HTMLCanvasElement {
  // the door is repainted on the first of the month, so the theme is part of the tile's identity
  const theme = themeFor();
  const key = `${scale}@${theme.id}`;
  if (steelTile?.key === key) return steelTile.canvas;
  const c = document.createElement("canvas");
  c.width = Math.ceil(W * scale); c.height = Math.ceil(TILE * scale);
  const g = c.getContext("2d")!; g.scale(scale, scale);
  const base = g.createLinearGradient(0, 0, W, 0);
  const stops = [0, 0.18, 0.47, 0.53, 0.8, 1] as const;
  stops.forEach((at, i) => base.addColorStop(at, theme.steel[i]));
  g.fillStyle = base; g.fillRect(0, 0, W, TILE);
  g.fillStyle = grain(ctx); g.globalCompositeOperation = "overlay"; g.fillRect(0, 0, W, TILE);
  steelTile = { key, canvas: c };
  return c;
}

/** Screen-space lighting (window light, reflection band, warm and cool bounce) baked once per view height. */
let lightLayer: { key: string; canvas: HTMLCanvasElement } | null = null;
function lighting(viewH: number, scale: number): HTMLCanvasElement {
  const key = `${viewH}@${scale}`;
  if (lightLayer?.key === key) return lightLayer.canvas;
  const h = viewH + 120;
  const c = document.createElement("canvas");
  c.width = Math.ceil(W * scale); c.height = Math.ceil(h * scale);
  const g = c.getContext("2d")!; g.scale(scale, scale); g.translate(0, 60); // y = 0 is camY
  const wl = g.createLinearGradient(0, 0, W, viewH);
  wl.addColorStop(0, "rgba(255,248,235,0.22)");
  wl.addColorStop(0.35, "rgba(255,248,235,0.07)");
  wl.addColorStop(0.7, "rgba(90,110,140,0.06)");
  wl.addColorStop(1, "rgba(60,80,110,0.16)");
  g.fillStyle = wl; g.fillRect(0, -60, W, h);
  const band = g.createLinearGradient(0, viewH * 0.1, 0, viewH * 0.55);
  band.addColorStop(0, "rgba(255,255,255,0)");
  band.addColorStop(0.5, "rgba(255,255,255,0.10)");
  band.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = band; g.fillRect(0, -60, W, h);
  const warm = g.createRadialGradient(0, viewH, 0, 0, viewH, W * 0.9);
  warm.addColorStop(0, "rgba(255,170,90,0.10)");
  warm.addColorStop(1, "rgba(255,170,90,0)");
  g.fillStyle = warm; g.fillRect(0, -60, W, h);
  const cool = g.createRadialGradient(W, 0, 0, W, 0, W * 0.8);
  cool.addColorStop(0, "rgba(120,170,230,0.10)");
  cool.addColorStop(1, "rgba(120,170,230,0)");
  g.fillStyle = cool; g.fillRect(0, -60, W, h);
  lightLayer = { key, canvas: c };
  return c;
}

export function drawSteel(ctx: CanvasRenderingContext2D, camY: number, viewH: number) {
  const top = camY - 60;
  const h = viewH + 120;
  const scale = Math.min(2, Math.max(1, ctx.getTransform().a || 1));
  // world-locked steel tiles
  const tile = steel(ctx, scale);
  const first = Math.floor(top / TILE) * TILE;
  for (let y = first; y < top + h; y += TILE) ctx.drawImage(tile, 0, y, W, TILE);
  // screen-locked lighting
  ctx.drawImage(lighting(viewH, scale), 0, top, W, h);
}

/** The groove between the two doors: a real recess with a lit right lip. */
export function drawSeam(ctx: CanvasRenderingContext2D, top: number, bottom: number) {
  const { x, w } = DOOR_SEAM;
  // shadow the left door edge casts into the groove
  const g = ctx.createLinearGradient(x - 6, 0, x + w + 4, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.35, "rgba(0,0,0,0.28)");
  g.addColorStop(0.6, "rgba(14,17,22,1)");
  g.addColorStop(0.9, "rgba(40,46,54,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 6, top, w + 10, bottom - top);
  // bright rolled edge on the right door
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillRect(x + w, top, 1.5, bottom - top);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x + w + 1.5, top, 2, bottom - top);
}

/** Faint horizontal panel joint between generated segments. */
// A door is one sheet of steel. The old panel joint drew a line across it at every segment
// boundary, which put a 34cm grid on the art to mark an implementation detail.

// ---------------------------------------------------------------------------
// zones
// ---------------------------------------------------------------------------

// Every zone's bezel, base fill, ribs and sticker art are the same pixels every frame; only
// the glass drift and the plate glow actually read `t`. So each zone bakes its unchanging
// parts into a small offscreen canvas once and a frame just blits it back with drawImage,
// the same trick `steel()` above uses for the door tile. The bake is split into an `under`
// layer (drawn first) and an optional `over` layer (drawn after the live animated bit), so
// a zone whose static art sits both beneath and on top of its `t`-driven overlay (glass's
// edge highlight over the drifting reflection; a plate's gloss streak over its glow and
// letter) still composites in the exact same order the frame-by-frame version painted it.
// PAD gives the bake room for castShadow's blur, which lands a few px outside the zone's
// own rect; the live version painted that overflow directly onto the frame, so leaving it
// out here would visibly crop the shadow.
//
// Cached by the zone object itself: zones are created once per generated segment (world.ts)
// and never resized after, and segments fall off `World.segments` (a `shift()`) as the door
// scrolls past them. A WeakMap keyed on the zone means a zone's bake is collected the moment
// nothing but this cache still references it, so the cache can never outgrow what is still
// reachable from the live world — no separate eviction pass needed, unlike a Map that would
// otherwise grow for as long as the run does.
const PAD = 16;
const ZONE_SCALE = 2;
// A baked canvas's pixel size is `Math.ceil((w + PAD*2) * ZONE_SCALE)`, which can round up to
// a hair more than `(w + PAD*2) * ZONE_SCALE` device pixels. Compositing it back with drawImage
// at the *nominal* `w + PAD*2` size (rather than that actual, slightly larger canvas size)
// stretches those extra rounding pixels across the whole image, softening it by a fraction of
// a pixel everywhere -- worse the further a pixel sits from the top-left corner, which is why
// it shows up as concentric ghosting around curved edges rather than a flat blur. Composited
// at its own true size instead, the extra sliver is just inert transparent margin.
interface ZoneLayer { canvas: HTMLCanvasElement; w: number; h: number }
interface ZoneLayers { key: string; under: ZoneLayer; over: ZoneLayer | null }
const zoneLayers = new WeakMap<NoStickZone, ZoneLayers>();

function bakeZoneLayer(z: NoStickZone, paint: (g: CanvasRenderingContext2D) => void): ZoneLayer {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil((z.w + PAD * 2) * ZONE_SCALE));
  c.height = Math.max(1, Math.ceil((z.h + PAD * 2) * ZONE_SCALE));
  const g = c.getContext("2d")!;
  g.scale(ZONE_SCALE, ZONE_SCALE);
  g.translate(-(z.x - PAD), -(z.y - PAD)); // paint() keeps using the zone's own x/y, as the live code always did
  paint(g);
  return { canvas: c, w: c.width / ZONE_SCALE, h: c.height / ZONE_SCALE };
}

/** Builds (or reuses) a zone's static bake. `paintOver` is only needed by zones with an
 *  animated bit sandwiched between two static passes; most zones pass nothing. */
function zoneLayersFor(z: NoStickZone, paintUnder: (g: CanvasRenderingContext2D) => void, paintOver?: (g: CanvasRenderingContext2D) => void): ZoneLayers {
  const key = `${z.w}x${z.h}`;
  const cached = zoneLayers.get(z);
  if (cached && cached.key === key) return cached;
  const layers: ZoneLayers = { key, under: bakeZoneLayer(z, paintUnder), over: paintOver ? bakeZoneLayer(z, paintOver) : null };
  zoneLayers.set(z, layers);
  return layers;
}

function drawZoneLayer(ctx: CanvasRenderingContext2D, z: NoStickZone, layer: ZoneLayer | null) {
  if (layer) ctx.drawImage(layer.canvas, z.x - PAD, z.y - PAD, layer.w, layer.h);
}

export function drawZone(ctx: CanvasRenderingContext2D, z: NoStickZone, t: number) {
  if (z.hue === -1) return drawHandle(ctx, z);
  switch (z.kind) {
    case "glass": return drawGlass(ctx, z, t);
    case "trim": return drawTrim(ctx, z);
    case "void": return drawGap(ctx, z);
    case "sticker": return drawSticker(ctx, z);
    case "repel": return drawRepel(ctx, z, t);
    case "attract": return drawAttract(ctx, z, t);
  }
}

/** Steel island: a pull handle standing off the door. Fully inside the collider. Nothing about
 *  it depends on `t`, so the whole thing is one static bake. */
function drawHandle(ctx: CanvasRenderingContext2D, z: NoStickZone) {
  drawZoneLayer(ctx, z, zoneLayersFor(z, (g) => paintHandle(g, z)).under);
}

function paintHandle(ctx: CanvasRenderingContext2D, z: NoStickZone) {
  const r = z.h / 2;
  castShadow(ctx, z.x, z.y, z.w, z.h, r, 1.6);
  const g = ctx.createLinearGradient(0, z.y, 0, z.y + z.h);
  g.addColorStop(0, "#f2f5f8");
  g.addColorStop(0.35, "#c9d0d8");
  g.addColorStop(0.65, "#aeb7c1");
  g.addColorStop(1, "#7c8592");
  ctx.fillStyle = g;
  roundRectPath(ctx, z.x, z.y, z.w, z.h, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,48,60,0.45)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // end caps + top highlight
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(z.x + r, z.y + 3, z.w - 2 * r, 2);
  ctx.fillStyle = "rgba(40,48,60,0.35)";
  ctx.fillRect(z.x + r * 0.9, z.y + 2, 1.5, z.h - 4);
  ctx.fillRect(z.x + z.w - r * 0.9 - 1.5, z.y + 2, 1.5, z.h - 4);
}

/** The bezel, recess and frosted glass fill plus its leaf/sky reflection blobs: everything in
 *  the display glass that never reads `t`. */
function paintGlassUnder(ctx: CanvasRenderingContext2D, z: NoStickZone) {
  const bez = Math.min(7, z.w * 0.06, z.h * 0.06);
  // bezel (part of the non-stick rect)
  const bg = ctx.createLinearGradient(z.x, z.y, z.x + z.w, z.y + z.h);
  bg.addColorStop(0, "#e9eef2");
  bg.addColorStop(0.5, "#b7c0c9");
  bg.addColorStop(1, "#8a939d");
  ctx.fillStyle = bg;
  roundRectPath(ctx, z.x, z.y, z.w, z.h, 6);
  ctx.fill();
  // recess shadow inside bezel
  ctx.fillStyle = "rgba(20,30,40,0.35)";
  roundRectPath(ctx, z.x + bez, z.y + bez, z.w - 2 * bez, z.h - 2 * bez, 4);
  ctx.fill();
  // glass body: teal frosted with depth
  const ix = z.x + bez + 1.5, iy = z.y + bez + 1.5, iw = z.w - 2 * bez - 3, ih = z.h - 2 * bez - 3;
  const gg = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
  gg.addColorStop(0, "#bfe7ee");
  gg.addColorStop(0.45, "#7fbfd0");
  gg.addColorStop(1, "#3d6f8a");
  ctx.fillStyle = gg;
  ctx.fillRect(ix, iy, iw, ih);
  // soft blobs: leaves / sky reflected from the window
  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    const bx = ix + hash(z.x, z.y, i, 1) * iw;
    const by = iy + hash(z.x, z.y, i, 2) * ih;
    const br = 10 + hash(z.x, z.y, i, 3) * Math.min(iw, ih) * 0.35;
    const rg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    const leafy = hash(z.x, z.y, i, 4) < 0.5;
    rg.addColorStop(0, leafy ? "rgba(120,190,120,0.35)" : "rgba(255,255,255,0.30)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  ctx.restore();
}

/** Top-left inner edge light and bottom-right inner shade: also static, but painted over the
 *  live drift streaks in the original ordering, so it bakes into a separate "over" layer. */
function paintGlassOver(ctx: CanvasRenderingContext2D, z: NoStickZone) {
  const bez = Math.min(7, z.w * 0.06, z.h * 0.06);
  const ix = z.x + bez + 1.5, iy = z.y + bez + 1.5, iw = z.w - 2 * bez - 3, ih = z.h - 2 * bez - 3;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(ix, iy, iw, 1.5);
  ctx.fillRect(ix, iy, 1.5, ih);
  ctx.fillStyle = "rgba(0,20,40,0.25)";
  ctx.fillRect(ix, iy + ih - 2, iw, 2);
  ctx.fillRect(ix + iw - 2, iy, 2, ih);
  ctx.restore();
}

/** Frosted display glass in a light bezel. Tree/sky reflection reads as glass, not steel.
 *  Only the two drift streaks depend on `t`; they're sandwiched live between the two bakes. */
function drawGlass(ctx: CanvasRenderingContext2D, z: NoStickZone, t: number) {
  const layers = zoneLayersFor(z, (g) => paintGlassUnder(g, z), (g) => paintGlassOver(g, z));
  drawZoneLayer(ctx, z, layers.under);
  const bez = Math.min(7, z.w * 0.06, z.h * 0.06);
  const ix = z.x + bez + 1.5, iy = z.y + bez + 1.5, iw = z.w - 2 * bez - 3, ih = z.h - 2 * bez - 3;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();
  // two diagonal reflection streaks that drift very slowly
  const drift = Math.sin(t * 0.25 + z.x * 0.01) * 6;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ix + 6 + drift, iy + ih - 6);
  ctx.lineTo(ix + iw - 6 + drift, iy + 6);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(ix + 18 + drift, iy + ih - 6);
  ctx.lineTo(ix + iw + 6 + drift, iy + 6);
  ctx.stroke();
  ctx.restore();
  drawZoneLayer(ctx, z, layers.over);
}

/** Molded black plastic trim: matte, horizontal ribs, a soft top sheen. */
function drawTrim(ctx: CanvasRenderingContext2D, z: NoStickZone) {
  const g = ctx.createLinearGradient(z.x, 0, z.x + z.w, 0);
  g.addColorStop(0, "#2a2e34");
  g.addColorStop(0.5, "#1f2328");
  g.addColorStop(1, "#262a30");
  ctx.fillStyle = g;
  ctx.fillRect(z.x, z.y, z.w, z.h);
  // ribs
  for (let y = z.y + 7; y < z.y + z.h - 3; y += 11) {
    ctx.fillStyle = "rgba(255,255,255,0.055)";
    ctx.fillRect(z.x, y, z.w, 1.5);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(z.x, y + 1.5, z.w, 1.5);
  }
  // window sheen upper-left
  const sheen = ctx.createLinearGradient(z.x, z.y, z.x + z.w * 0.6, z.y + z.h);
  sheen.addColorStop(0, "rgba(255,255,255,0.10)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(z.x, z.y, z.w, z.h);
  // edges: top lit, bottom dark
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(z.x, z.y, z.w, 1.5);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(z.x, z.y + z.h - 2, z.w, 2);
}

/** Open gap between panels: a dark recess with depth at the top lip. */
function drawGap(ctx: CanvasRenderingContext2D, z: NoStickZone) {
  ctx.fillStyle = "#0f1216";
  ctx.fillRect(z.x, z.y, z.w, z.h);
  // depth: the upper panel throws a shadow down into the gap
  const top = ctx.createLinearGradient(0, z.y, 0, z.y + Math.min(40, z.h * 0.4));
  top.addColorStop(0, "rgba(0,0,0,0.9)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(z.x, z.y, z.w, Math.min(40, z.h * 0.4));
  // faint cold light catching the far inner wall near the bottom lip
  const bot = ctx.createLinearGradient(0, z.y + z.h - Math.min(28, z.h * 0.3), 0, z.y + z.h);
  bot.addColorStop(0, "rgba(90,110,130,0)");
  bot.addColorStop(1, "rgba(90,110,130,0.25)");
  ctx.fillStyle = bot;
  ctx.fillRect(z.x, z.y + z.h - Math.min(28, z.h * 0.3), z.w, Math.min(28, z.h * 0.3));
  // a couple of screws/vents so it is a real fridge gap, not a void
  const n = Math.max(1, Math.floor(z.w / 130));
  for (let i = 0; i < n; i++) {
    const vx = z.x + ((i + 0.5) * z.w) / n;
    const vy = z.y + z.h * 0.5;
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let k = -2; k <= 2; k++) ctx.fillRect(vx - 14, vy + k * 5, 28, 1.5);
  }
}

/**
 * Stickers and souvenir magnets. Style chosen deterministically from the hue so a
 * given sticker never changes. All drawing stays inside the collider rect
 * (rotation is applied around the center with a slight inset so the corners
 * of a tilted card do not poke outside it).
 */
function drawSticker(ctx: CanvasRenderingContext2D, z: NoStickZone) {
  drawZoneLayer(ctx, z, zoneLayersFor(z, (g) => paintSticker(g, z)).under);
}

/** No `t` in the original signature at all: the whole sticker is static. */
function paintSticker(ctx: CanvasRenderingContext2D, z: NoStickZone) {
  const hue = z.hue ?? 0;
  const kind = Math.floor(hash(hue, z.x, z.y) * 4); // 0 polaroid, 1 souvenir plate, 2 sticky note, 3 kid's drawing
  const tilt = ((hue % 10) - 5) * 0.018;
  const inset = 4;
  const w = z.w - inset * 2, h = z.h - inset * 2;
  ctx.save();
  ctx.translate(z.x + z.w / 2, z.y + z.h / 2);
  castShadow(ctx, -w / 2, -h / 2, w, h, 3, 1);
  ctx.rotate(tilt);
  const x = -w / 2, y = -h / 2;
  switch (kind) {
    case 0: { // polaroid
      ctx.fillStyle = "#fbfbf7";
      roundRectPath(ctx, x, y, w, h, 2);
      ctx.fill();
      const px = x + 5, py = y + 5, pw = w - 10, ph = h - 20;
      const sky = ctx.createLinearGradient(0, py, 0, py + ph);
      sky.addColorStop(0, `hsl(${(hue + 190) % 360} 60% 72%)`);
      sky.addColorStop(1, `hsl(${(hue + 190) % 360} 55% 88%)`);
      ctx.fillStyle = sky;
      ctx.fillRect(px, py, pw, ph);
      // ground + sun + a tiny house, a snapshot from a trip
      ctx.fillStyle = `hsl(${(hue + 90) % 360} 45% 55%)`;
      ctx.fillRect(px, py + ph * 0.68, pw, ph * 0.32);
      ctx.fillStyle = "#ffd85a";
      ctx.beginPath(); ctx.arc(px + pw * 0.78, py + ph * 0.28, Math.min(pw, ph) * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `hsl(${hue} 60% 55%)`;
      ctx.fillRect(px + pw * 0.2, py + ph * 0.45, pw * 0.28, ph * 0.28);
      ctx.fillStyle = "#7a3b2e";
      ctx.beginPath(); ctx.moveTo(px + pw * 0.16, py + ph * 0.46); ctx.lineTo(px + pw * 0.34, py + ph * 0.25); ctx.lineTo(px + pw * 0.52, py + ph * 0.46); ctx.closePath(); ctx.fill();
      // handwritten caption line
      ctx.strokeStyle = "rgba(60,60,80,0.55)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + h - 7);
      ctx.bezierCurveTo(x + w * 0.3, y + h - 11, x + w * 0.5, y + h - 4, x + w * 0.7, y + h - 8);
      ctx.stroke();
      // a heart-shaped magnet pinning the corner
      ctx.fillStyle = "#ff5c8a";
      const hx = x + w - 7, hy = y + 7;
      ctx.beginPath();
      ctx.arc(hx - 2.2, hy - 1, 2.6, 0, Math.PI * 2);
      ctx.arc(hx + 2.2, hy - 1, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx - 4.6, hy); ctx.lineTo(hx, hy + 5.5); ctx.lineTo(hx + 4.6, hy); ctx.closePath(); ctx.fill();
      break;
    }
    case 1: { // souvenir plate magnet
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, `hsl(${hue} 70% 62%)`);
      g.addColorStop(1, `hsl(${hue} 70% 45%)`);
      ctx.fillStyle = g;
      roundRectPath(ctx, x, y, w, h, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2.5;
      roundRectPath(ctx, x + 3, y + 3, w - 6, h - 6, 5);
      ctx.stroke();
      // gloss
      const gl = ctx.createLinearGradient(x, y, x + w * 0.5, y + h);
      gl.addColorStop(0, "rgba(255,255,255,0.35)");
      gl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gl;
      roundRectPath(ctx, x, y, w, h, 7);
      ctx.fill();
      // a little landmark: mountain + wave banner
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath(); ctx.moveTo(x + w * 0.25, y + h * 0.62); ctx.lineTo(x + w * 0.45, y + h * 0.3); ctx.lineTo(x + w * 0.62, y + h * 0.62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      roundRectPath(ctx, x + w * 0.15, y + h * 0.68, w * 0.7, Math.max(8, h * 0.16), 3);
      ctx.fill();
      ctx.fillStyle = `hsl(${hue} 70% 35%)`;
      ctx.font = `bold ${Math.max(7, Math.min(10, h * 0.14))}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(["LAKE", "BEACH", "CAMP", "HOME", "ZOO", "SKI"][Math.floor(hash(hue, 9) * 6)], x + w / 2, y + h * 0.68 + Math.max(8, h * 0.16) * 0.78);
      break;
    }
    case 2: { // sticky note with a to-do doodle
      ctx.fillStyle = `hsl(${(hue + 40) % 360} 85% 78%)`;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(x, y, w, 6);
      ctx.strokeStyle = "rgba(40,40,60,0.6)";
      ctx.lineWidth = 1.3;
      const lines = Math.max(2, Math.floor((h - 16) / 13));
      for (let i = 0; i < lines; i++) {
        const ly = y + 14 + i * 13;
        // checkbox
        ctx.strokeRect(x + 7, ly - 6, 7, 7);
        if (hash(hue, i, 3) < 0.5) { ctx.beginPath(); ctx.moveTo(x + 8, ly - 3); ctx.lineTo(x + 11, ly); ctx.lineTo(x + 14, ly - 6); ctx.stroke(); }
        // scribble text
        ctx.beginPath();
        const len = w - 24 - hash(hue, i, 4) * (w * 0.4);
        ctx.moveTo(x + 18, ly - 2);
        for (let k = 1; k <= 6; k++) ctx.lineTo(x + 18 + (len * k) / 6, ly - 2 + (hash(hue, i, k) - 0.5) * 3);
        ctx.stroke();
      }
      break;
    }
    default: { // kid's drawing on paper, pinned with a round magnet
      ctx.fillStyle = "#f7f6f0";
      ctx.fillRect(x, y, w, h);
      ctx.lineCap = "round";
      ctx.lineWidth = 2.2;
      // sun
      ctx.strokeStyle = "#f4b400";
      ctx.beginPath(); ctx.arc(x + w * 0.22, y + h * 0.24, Math.min(w, h) * 0.1, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const r0 = Math.min(w, h) * 0.13, r1 = Math.min(w, h) * 0.2;
        ctx.beginPath(); ctx.moveTo(x + w * 0.22 + Math.cos(a) * r0, y + h * 0.24 + Math.sin(a) * r0); ctx.lineTo(x + w * 0.22 + Math.cos(a) * r1, y + h * 0.24 + Math.sin(a) * r1); ctx.stroke();
      }
      // a stick person (the kid drew us!) and grass
      ctx.strokeStyle = `hsl(${hue} 70% 45%)`;
      const cx = x + w * 0.62, cy = y + h * 0.42, s = Math.min(w, h) * 0.11;
      ctx.beginPath(); ctx.arc(cx, cy - s * 1.2, s * 0.55, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.65); ctx.lineTo(cx, cy + s); ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy);
      ctx.moveTo(cx, cy + s); ctx.lineTo(cx - s * 0.8, cy + s * 2.1); ctx.moveTo(cx, cy + s); ctx.lineTo(cx + s * 0.8, cy + s * 2.1); ctx.stroke();
      ctx.strokeStyle = "#5fb04a";
      ctx.beginPath();
      for (let gx = x + 6; gx < x + w - 6; gx += 6) { ctx.moveTo(gx, y + h - 6); ctx.lineTo(gx + 2, y + h - 12); }
      ctx.stroke();
      // round magnet pin
      const pg = ctx.createRadialGradient(x + w / 2 - 2, y + 6, 1, x + w / 2, y + 8, 7);
      pg.addColorStop(0, "#ffffff");
      pg.addColorStop(0.4, `hsl(${(hue + 180) % 360} 80% 60%)`);
      pg.addColorStop(1, `hsl(${(hue + 180) % 360} 80% 35%)`);
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(x + w / 2, y + 8, 6, 0, Math.PI * 2); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

/** Shared shape for the field plates: only the accent colours (enamel body, bevel, glow,
 *  glowing letter, gloss and its glass-window tint) differ between attract and repel. */
interface PlateColors { body: [string, string, string]; bevel: string; window: string; glow: string; letter: (pulse: number) => string; glowShadow: string; caption: string; label: string }

function paintPlateUnder(ctx: CanvasRenderingContext2D, z: NoStickZone, p: PlateColors) {
  castShadow(ctx, z.x, z.y, z.w, z.h, 8, 1.4);
  const g = ctx.createLinearGradient(z.x, z.y, z.x + z.w, z.y + z.h);
  g.addColorStop(0, p.body[0]);
  g.addColorStop(0.5, p.body[1]);
  g.addColorStop(1, p.body[2]);
  ctx.fillStyle = g;
  roundRectPath(ctx, z.x, z.y, z.w, z.h, 8);
  ctx.fill();
  ctx.strokeStyle = p.bevel;
  ctx.lineWidth = 2;
  roundRectPath(ctx, z.x + 2, z.y + 2, z.w - 4, z.h - 4, 6);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1.2;
  roundRectPath(ctx, z.x + 0.5, z.y + 0.5, z.w - 1, z.h - 1, 8);
  ctx.stroke();
  const ix = z.x + 8, iy = z.y + 8, iw = z.w - 16, ih = z.h - 24;
  ctx.fillStyle = p.window;
  roundRectPath(ctx, ix, iy, iw, ih, 5);
  ctx.fill();
}

/** The gloss streak and bottom caption paint over the live glow and letter in the original
 *  order, so (like glass's edge highlight) they bake into a separate "over" layer. */
function paintPlateOver(ctx: CanvasRenderingContext2D, z: NoStickZone, p: PlateColors) {
  const gl = ctx.createLinearGradient(z.x, z.y, z.x + z.w * 0.6, z.y + z.h * 0.5);
  gl.addColorStop(0, "rgba(255,255,255,0.28)");
  gl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  roundRectPath(ctx, z.x, z.y, z.w, z.h, 8);
  ctx.fill();
  ctx.fillStyle = p.caption;
  ctx.font = "bold 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(p.label, z.x + z.w / 2, z.y + z.h - 6);
}

/** The pulsing glow and glowing letter: the only part of a field plate that reads `t`. */
function drawPlateLive(ctx: CanvasRenderingContext2D, z: NoStickZone, p: PlateColors, pulse: number, letter: string) {
  const ix = z.x + 8, iy = z.y + 8, iw = z.w - 16, ih = z.h - 24;
  const glow = ctx.createRadialGradient(z.x + z.w / 2, iy + ih / 2, 2, z.x + z.w / 2, iy + ih / 2, Math.max(iw, ih) * 0.6);
  glow.addColorStop(0, p.glow.replace("{a}", String(0.45 + pulse * 0.35)));
  glow.addColorStop(1, p.glow.replace("{a}", "0"));
  ctx.fillStyle = glow;
  roundRectPath(ctx, ix, iy, iw, ih, 5);
  ctx.fill();
  ctx.font = `900 ${Math.min(30, ih * 0.8)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = p.letter(pulse);
  ctx.shadowColor = p.glowShadow;
  ctx.shadowBlur = 8 + pulse * 8;
  ctx.fillText(letter, z.x + z.w / 2, iy + ih / 2 + Math.min(30, ih * 0.8) * 0.36);
  ctx.shadowBlur = 0;
}

/** Right-polarity plate: glossy blue enamel with a glowing S. It pulls, and it is steel. */
const ATTRACT_COLORS: PlateColors = {
  body: ["#2f6fd6", "#1c4aa0", "#102c66"], bevel: "rgba(140,190,255,0.85)", window: "rgba(0,8,30,0.75)",
  glow: "rgba(90,160,255,{a})", glowShadow: "rgba(90,160,255,0.9)",
  letter: (pulse) => `rgba(${150 + pulse * 60},${200 + pulse * 40},255,1)`,
  caption: "rgba(200,225,255,0.9)", label: "ATTRACTS",
};
function drawAttract(ctx: CanvasRenderingContext2D, z: NoStickZone, t: number) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  const layers = zoneLayersFor(z, (g) => paintPlateUnder(g, z, ATTRACT_COLORS), (g) => paintPlateOver(g, z, ATTRACT_COLORS));
  drawZoneLayer(ctx, z, layers.under);
  drawPlateLive(ctx, z, ATTRACT_COLORS, pulse, "S");
  drawZoneLayer(ctx, z, layers.over);
}

/** Reversed-polarity plate: a glossy red enamel tile with a glowing N, matching the title art. */
const REPEL_COLORS: PlateColors = {
  body: ["#c8232f", "#8f1620", "#5c0d15"], bevel: "rgba(255,120,120,0.8)", window: "rgba(30,0,4,0.75)",
  glow: "rgba(255,80,80,{a})", glowShadow: "rgba(255,60,60,0.9)",
  letter: (pulse) => `rgba(255,${150 + pulse * 60},${150 + pulse * 60},1)`,
  caption: "rgba(255,200,200,0.85)", label: "REPELS",
};
function drawRepel(ctx: CanvasRenderingContext2D, z: NoStickZone, t: number) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  const layers = zoneLayersFor(z, (g) => paintPlateUnder(g, z, REPEL_COLORS), (g) => paintPlateOver(g, z, REPEL_COLORS));
  drawZoneLayer(ctx, z, layers.under);
  drawPlateLive(ctx, z, REPEL_COLORS, pulse, "N");
  drawZoneLayer(ctx, z, layers.over);
}

// ---------------------------------------------------------------------------
// bumpers: souvenir / letter magnets sliding across the door
// ---------------------------------------------------------------------------

export function drawBumper(ctx: CanvasRenderingContext2D, b: Bumper) {
  castShadow(ctx, b.x, b.y, b.w, b.h, 7, 1.3);
  const single = b.label.length <= 1;
  if (single) {
    // chunky alphabet-fridge-magnet letter on a white tile
    ctx.fillStyle = "#fdfdfb";
    roundRectPath(ctx, b.x, b.y, b.w, b.h, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `900 ${b.h * 0.8}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = `hsl(${b.hue} 80% 40%)`;
    ctx.fillText(b.label, b.x + b.w / 2 + 1.5, b.y + b.h * 0.78 + 1.5);
    ctx.fillStyle = `hsl(${b.hue} 85% 58%)`;
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h * 0.78);
    return;
  }
  const theme = b.label === "PIZZA" ? { a: "#e8402c", b: "#ffc940", t: "#fff" }
    : b.label === "VEG" ? { a: "#2e9e57", b: "#8be07e", t: "#fff" }
    : b.label === "24/7" ? { a: "#2758c9", b: "#7fb1ff", t: "#fff" }
    : { a: `hsl(${b.hue} 75% 45%)`, b: `hsl(${b.hue} 80% 65%)`, t: "#fff" };
  const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  g.addColorStop(0, theme.b);
  g.addColorStop(1, theme.a);
  ctx.fillStyle = g;
  roundRectPath(ctx, b.x, b.y, b.w, b.h, 7);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;
  roundRectPath(ctx, b.x + 2.5, b.y + 2.5, b.w - 5, b.h - 5, 5);
  ctx.stroke();
  const gl = ctx.createLinearGradient(b.x, b.y, b.x + b.w * 0.5, b.y + b.h);
  gl.addColorStop(0, "rgba(255,255,255,0.35)");
  gl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  roundRectPath(ctx, b.x, b.y, b.w, b.h, 7);
  ctx.fill();
  if (b.label === "PIZZA") {
    // a slice icon before the word
    ctx.fillStyle = "#ffd36b";
    ctx.beginPath(); ctx.moveTo(b.x + 8, b.y + 8); ctx.lineTo(b.x + 20, b.y + 8); ctx.lineTo(b.x + 14, b.y + b.h - 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c8262a";
    ctx.beginPath(); ctx.arc(b.x + 12, b.y + 13, 1.8, 0, Math.PI * 2); ctx.arc(b.x + 16, b.y + 12, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.font = `900 ${Math.min(12, b.h * 0.36)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  const tx = b.x + b.w / 2 + (b.label === "PIZZA" ? 6 : 0);
  ctx.fillText(b.label, tx + 1, b.y + b.h / 2 + 5);
  ctx.fillStyle = theme.t;
  ctx.fillText(b.label, tx, b.y + b.h / 2 + 4);
}

/** For tests/previews: whether the cached grain has been built. */
export function sceneryCacheReady(): boolean {
  return grainTile !== null;
}
