/**
 * The in-run HUD dock (design_handoff_hud_menus/README.md, screens 1a/1e/1f/1g).
 *
 * One slab along the bottom, three cells: HEIGHT leads, the red-line distance is a gauge
 * inside the dock rather than a floating pill, and the wallet steps back. Everything the
 * player reads lives in the bottom third — the top stays clear for Cooper's hand and the cat.
 *
 * Geometry is in logical px on the 400-wide game column, matching the handoff exactly.
 * `dockRect`, `hudButtons` and `teamDots` are the single source of truth for hit testing,
 * so input rects can never drift from what is painted.
 */
import type { Game } from "./game";
import type { Climber } from "./types";
import { CFG, W } from "./config";
import { appearanceFor } from "./creatures";
import { drawClimber } from "./climber-render";
import { resetRagdoll } from "./ragdoll";
import { drawPickupImage } from "./pickup-art";
import { t as tr } from "./i18n";

export const DISPLAY = '"Barlow Condensed", system-ui, sans-serif';
export const font = (weight: number, size: number) => `${weight} ${size}px ${DISPLAY}`;

/** Thin space between thousands, per the handoff type spec: 11 759 not 11,759. */
export const groupNum = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const SLAB = "rgba(20,22,28,.88)";
const DANGER = "#ff506e", DANGER_LIGHT = "#ff8aa3", COIN = "#ffd23f", GEM = "#7ef0ff";
const CHILL = "#9be15d", CLIMB = "#4fc3f7", SYNC = "#c77dff", ACCENT = "#ff8a3d", INK = "#1a1d24";

/**
 * Top bar: height, run time, and what THIS run has earned -- not the account totals.
 * Thin, and it stops short of the right edge to leave room for the sound and menu
 * buttons, which are DOM and positioned to match in style.css.
 */
const TOP_Y = 10, TOP_H = 46, TOP_X = 12;
const BTN = 44, BTN_GAP = 8;
const TOP_W = W - TOP_X - 12 - BTN * 2 - BTN_GAP * 2;
/** Cells across the bar: height leads, then the clock, then the run's earnings. */
const CELLS = [1.15, 0.85, 1];
/** The red line is the one thing worth glancing at mid-climb, so it gets the bottom edge. */
const LINE_H = 34;

/** Queried once and kept fresh by the listener; matchMedia per frame is a style read per frame. */
let reducedMotion = false;
if (typeof matchMedia === "function") {
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotion = mq.matches;
  mq.addEventListener?.("change", (e) => { reducedMotion = e.matches; });
}
/** Throb, blink and dash marching are off under reduced motion; colour changes stay. */
export const prefersReducedMotion = () => reducedMotion;

let safeBottom = 28;
export function setHudSafeBottom(px: number) { safeBottom = Math.max(28, px); }
/** Raised when the chat strip is showing, so the dock clears it (handoff 1a). */
/** Chat is menu-only now; kept as a no-op so callers need not care. */
export function setChatStrip(_on: boolean) { /* no in-run chat */ }

export const topBarRect = () => ({ x: TOP_X, y: TOP_Y, w: TOP_W, h: TOP_H });
export const lineRect = (viewH: number) => ({ x: 12, y: viewH - safeBottom - LINE_H, w: W - 24, h: LINE_H });
/** Crew tiles and mode buttons sit just above the red line, in thumb reach. */
const controlsBottom = (viewH: number) => lineRect(viewH).y - 8;
/** Where the bottom furniture starts; the aim preview uses it to stay clear. */
export function statRowY(_g: Game, viewH: number) { return controlsBottom(viewH) - 52; }
export const dockRect = (viewH: number) => ({ x: 12, y: statRowY(null as unknown as Game, viewH), w: W - 24, h: 52 });

function cellRects() {
  const d = topBarRect(), total = CELLS.reduce((a, b) => a + b, 0);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  let x = d.x;
  for (const f of CELLS) { const w = (d.w * f) / total; out.push({ x, y: d.y, w, h: d.h }); x += w; }
  return out;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Uppercase 10/800/1.6px cell label. */
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = "rgba(255,255,255,.5)") {
  ctx.save();
  ctx.font = font(800, 10); ctx.fillStyle = color; ctx.textAlign = "left";
  ctx.letterSpacing = "1.6px";
  ctx.fillText(tr(text).toUpperCase(), x, y);
  ctx.restore();
}

/** Red-line distance in cm: how far the lowest living climber is above the wall. */
export function redLineCm(g: Game) {
  if (!g.alive.length) return 0;
  const lowest = Math.max(...g.alive.map((c) => c.y));
  return Math.max(0, Math.round((g.floorY - lowest) / CFG.pxPerCm));
}
export const inDanger = (g: Game) => !g.chill && g.phase === "running" && redLineCm(g) <= CFG.dangerCm;

/* ------------------------------------------------------------------ crew tiles */

/**
 * One cached offscreen tile per climber id: the slab, the rounded crop and the avatar are
 * all baked in, so a frame costs one drawImage per tile instead of a fill, a clip and a
 * stroke per tile. Clipping per climber per frame is exactly the cost the crew complains
 * about, and it scales with how many toys are out.
 */
const avatars = new Map<number, { key: string; canvas: HTMLCanvasElement }>();
function avatarFor(c: Climber, w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = `${c.creature ?? "human"}|${c.pattern ?? ""}|${c.color}|${w}x${h}`;
  const hit = avatars.get(c.id);
  if (hit && hit.key === key) return hit.canvas;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(3, (typeof devicePixelRatio === "number" ? devicePixelRatio : 1) || 1);
  canvas.width = Math.ceil(w * dpr); canvas.height = Math.ceil(h * dpr);
  const g2 = canvas.getContext("2d");
  if (!g2) return null;
  g2.scale(dpr, dpr);
  // the slab and its rounded crop are baked here, once, rather than clipped every frame
  roundRect(g2, 0, 0, w, h, 12);
  g2.fillStyle = "rgba(20,22,28,.7)";
  g2.fill();
  g2.clip();
  // a still, upright copy of this climber: the tile is an identity badge, not an animation
  const pose: Climber = {
    ...c, id: -1 - c.id, x: w / 2, y: h * 0.62, vx: 0, vy: 0, angle: 0, spin: 0,
    state: "stuck", parent: null, launcherId: null, leftLauncher: true, airTime: 0, squash: 0, iframes: 0, grip: undefined,
  };
  resetRagdoll(pose);
  g2.save();
  // cropped to the top: the head and shoulders read at 40 px, the legs do not
  g2.translate(0, -h * 0.06);
  g2.scale(0.52, 0.52);
  g2.translate(w * 0.48, h * 0.5);
  try { drawClimber(g2, pose, false, 0, appearanceFor(pose)); } catch { /* preview only; never break the run */ }
  g2.restore();
  avatars.set(c.id, { key, canvas });
  return canvas;
}
/** Dropped when a run ends so a new crew does not inherit stale tiles. */
export function clearAvatars() { avatars.clear(); }

const TILE = { w: 40, h: 46, sel: { w: 44, h: 50 }, gap: 6, lift: 6 };
/** Crew tiles sit 8 px above the dock; the row is also the selector (handoff 1f). */
export function teamDots(g: Game, viewH: number): { id: number; x: number; y: number }[] {
  const bottom = controlsBottom(viewH);
  const out: { id: number; x: number; y: number }[] = [];
  let x = 12;
  for (const c of g.climbers) {
    if (c.state === "lost") continue;
    const sel = c.id === g.selectedId;
    const w = sel ? TILE.sel.w : TILE.w, h = sel ? TILE.sel.h : TILE.h;
    // centre of a >=44 px tap target, even for the smaller unselected tile
    out.push({ id: c.id, x: x + w / 2, y: bottom - h / 2 });
    x += w + TILE.gap;
  }
  return out;
}

/** Tap targets for the crew tiles, padded out to the 44 px minimum around each tile. */
export function teamTapRects(g: Game, viewH: number) {
  return teamDots(g, viewH).map((d) => {
    const sel = d.id === g.selectedId;
    const w = Math.max(44, sel ? TILE.sel.w : TILE.w), h = Math.max(44, sel ? TILE.sel.h : TILE.h);
    return { id: d.id, x: d.x - w / 2, y: d.y - h / 2, w, h };
  });
}

function drawCrew(ctx: CanvasRenderingContext2D, g: Game, viewH: number) {
  const bottom = controlsBottom(viewH);
  for (const dot of teamDots(g, viewH)) {
    const c = g.byId(dot.id); if (!c) continue;
    const sel = c.id === g.selectedId;
    const w = sel ? TILE.sel.w : TILE.w, h = sel ? TILE.sel.h : TILE.h;
    const x = dot.x - w / 2, y = bottom - h - (sel ? TILE.lift : 0);
    // one blit: slab, rounded crop and avatar are already baked into the tile
    const av = avatarFor(c, w, h);
    if (av) ctx.drawImage(av, x, y, w, h);
    else {
      ctx.save(); ctx.fillStyle = "rgba(20,22,28,.7)"; roundRect(ctx, x, y, w, h, 12); ctx.fill();
      ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.45, w * 0.26, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // live state on top, as flat rects and text: no clip, no rounded path per frame
    const bar = 3;
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(x + 2, y + h - bar, w - 4, bar);
    ctx.fillStyle = "#ff5c8a"; ctx.fillRect(x + 2, y + h - bar, (w - 4) * Math.max(0, Math.min(1, c.hp / CFG.maxHp)), bar);
    if (g.isLadder(c)) {
      ctx.fillStyle = "rgba(20,22,28,.85)"; ctx.fillRect(x + 2, y + 2, w - 4, 12);
      ctx.font = font(800, 9); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.letterSpacing = "0.4px";
      ctx.fillText(tr("LADDER"), x + w / 2, y + 11);
      ctx.letterSpacing = "0px";
    }
    if (sel) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 11); ctx.stroke(); }
    if (c.state === "flying") {
      ctx.font = font(900, 14); ctx.fillStyle = "#fff"; ctx.textAlign = "right";
      ctx.fillText("↑", x + w - 4, y + 15);
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ buttons */

/** Mode buttons sit to the right of the crew tiles, on the same 44 px row. */
export function hudButtons(viewH: number, g: Game) {
  const d = dockRect(viewH);
  const h = 44, y = d.y - 8 - h;
  let x = d.x;
  for (const c of g.climbers) if (c.state !== "lost") x += (c.id === g.selectedId ? TILE.sel.w : TILE.w) + TILE.gap;
  x = Math.max(x, d.x + 4);
  const mode = { x, y, w: 72, h };
  const sync = { x: x + 78, y, w: 72, h };
  return {
    mode, sync,
    reserve: { x: d.x + d.w - 96, y, w: 96, h },
  };
}

function button(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, text: string, fill: string, ink: string) {
  ctx.save();
  ctx.fillStyle = fill; roundRect(ctx, r.x, r.y, r.w, r.h, 12); ctx.fill();
  ctx.font = font(900, 13); ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.letterSpacing = "1.2px";
  ctx.fillText(tr(text), r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}

/* ------------------------------------------------------------------ chips */

const CHIP_H = 28;

/* ------------------------------------------------------------------ the dock */



export function drawDock(ctx: CanvasRenderingContext2D, g: Game, viewH: number, time: number) {
  drawTopBar(ctx, g);
  drawRedLine(ctx, g, viewH, time);
  drawEffects(ctx, g, viewH);
  if (g.rules === "crew") drawCrew(ctx, g, viewH);
  const b = hudButtons(viewH, g);
  if (g.rules === "crew") {
    const climbing = g.mode === "move";
    button(ctx, b.mode, climbing ? "CLIMB" : "FLING", climbing ? SLAB : ACCENT, climbing ? CLIMB : INK);
    button(ctx, b.sync, "SYNC", g.sync ? SYNC : SLAB, g.sync ? INK : "#fff");
  }
}

/** Height, run time, and what this run has earned. Account totals live on the menu. */
function drawTopBar(ctx: CanvasRenderingContext2D, g: Game) {
  const d = topBarRect(), cells = cellRects();
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = SLAB; roundRect(ctx, d.x, d.y, d.w, d.h, 14); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(d.x, d.y, d.w, 1);

  // height
  const c1 = cells[0];
  label(ctx, "HEIGHT", c1.x + 12, d.y + 16);
  ctx.textAlign = "left";
  ctx.font = font(900, 24); ctx.fillStyle = "#fff";
  const hStr = groupNum(g.heightCm);
  ctx.fillText(hStr, c1.x + 12, d.y + 38);
  ctx.font = font(700, 11); ctx.fillStyle = "rgba(255,255,255,.65)";
  ctx.fillText(tr("cm"), c1.x + 12 + ctx.measureText(hStr).width * 0 + measure(ctx, hStr, 900, 24) + 3, d.y + 38);

  // run clock
  const c2 = cells[1];
  ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(c2.x, d.y + 9, 1, d.h - 18);
  label(ctx, "TIME", c2.x + 12, d.y + 16);
  const total = Math.max(0, Math.floor(g.time));
  ctx.font = font(800, 20); ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.textAlign = "left";
  ctx.fillText(`${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`, c2.x + 12, d.y + 37);

  // this run's earnings, not the wallet
  const c3 = cells[2];
  ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(c3.x, d.y + 9, 1, d.h - 18);
  const runCoins = g.chill ? 0 : g.coins, runGems = g.chill ? 0 : g.gems;
  const icon = (kind: "coin" | "gem", x: number, y: number) => {
    ctx.save(); ctx.translate(x + 7, y);
    if (!drawPickupImage(ctx, kind, 14)) { ctx.fillStyle = kind === "coin" ? COIN : GEM; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  ctx.font = font(800, 14); ctx.textAlign = "left";
  icon("coin", c3.x + 10, d.y + 17);
  ctx.fillStyle = COIN; ctx.fillText(`+${groupNum(runCoins)}`, c3.x + 26, d.y + 21);
  icon("gem", c3.x + 10, d.y + 34);
  ctx.fillStyle = GEM; ctx.fillText(`+${groupNum(runGems)}`, c3.x + 26, d.y + 38);
  ctx.restore();
}

/** Width of a string at a given weight/size without disturbing the caller's font. */
function measure(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number) {
  const prev = ctx.font; ctx.font = font(weight, size);
  const w = ctx.measureText(text).width; ctx.font = prev; return w;
}

/** The red line, back on the bottom edge where it can be glanced at. */
function drawRedLine(ctx: CanvasRenderingContext2D, g: Game, viewH: number, time: number) {
  const d = lineRect(viewH), danger = inDanger(g);
  const reduced = prefersReducedMotion();
  ctx.save();
  ctx.textBaseline = "middle";
  if (danger && !reduced) {
    const k = 1 + 0.04 * (0.5 - 0.5 * Math.cos((time % 0.6) / 0.6 * Math.PI * 2));
    ctx.translate(W / 2, d.y + d.h / 2); ctx.scale(k, k); ctx.translate(-W / 2, -(d.y + d.h / 2));
  }
  ctx.fillStyle = danger ? "rgba(70,20,30,.92)" : SLAB;
  roundRect(ctx, d.x, d.y, d.w, d.h, 12); ctx.fill();
  if (danger) { ctx.strokeStyle = DANGER; ctx.lineWidth = 2; roundRect(ctx, d.x + 1, d.y + 1, d.w - 2, d.h - 2, 11); ctx.stroke(); }

  const mid = d.y + d.h / 2;
  if (g.chill) {
    ctx.font = font(800, 12); ctx.fillStyle = CHILL; ctx.textAlign = "left"; ctx.letterSpacing = "1.4px";
    ctx.fillText(tr("CHILL · NO RED LINE · NOTHING BANKS"), d.x + 14, mid);
    ctx.letterSpacing = "0px";
  } else {
    const dist = redLineCm(g);
    const blink = danger && !reduced ? Math.floor(time / 0.6) % 2 === 0 : true;
    ctx.font = font(800, 11); ctx.textAlign = "left"; ctx.letterSpacing = "1.4px";
    ctx.fillStyle = danger ? (blink ? DANGER_LIGHT : "rgba(255,138,163,.4)") : "rgba(255,255,255,.5)";
    ctx.fillText(tr(danger ? "RED LINE ▲" : "RED LINE ▼"), d.x + 14, mid);
    ctx.letterSpacing = "0px";
    ctx.font = font(900, 19); ctx.fillStyle = danger ? DANGER : "#fff";
    const dStr = groupNum(dist);
    ctx.fillText(dStr, d.x + 92, mid);
    ctx.font = font(700, 11); ctx.fillStyle = danger ? DANGER : "rgba(255,255,255,.65)";
    const cmX = d.x + 92 + measure(ctx, dStr, 900, 19) + 3;
    ctx.fillText(tr("cm"), cmX, mid);
    // How fast the line is climbing right now, as a multiple of its starting pace: it
    // steps up with height and run time, doubles when it is catching you up, and a candy
    // drops it below 1. Without it the wall speeds up with nothing on screen saying so.
    const speed = g.wallSpeed() / CFG.floorBase;
    const sStr = `${speed < 10 ? speed.toFixed(1) : Math.round(speed)}x`;
    const sx = cmX + measure(ctx, tr("cm"), 700, 11) + 11;
    ctx.font = font(900, 14);
    ctx.fillStyle = speed >= 3 ? DANGER : speed < 1 ? CHILL : COIN;
    ctx.fillText(sStr, sx, mid);
    // the gauge fills the rest of the strip: full when the wall is on your heels
    const gx = sx + measure(ctx, sStr, 900, 14) + 12, gw = d.x + d.w - 14 - gx, gy = mid - 2;
    ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(gx, gy, gw, 4);
    const frac = Math.max(0, Math.min(1, 1 - dist / 100));
    if (frac > 0) {
      if (danger) ctx.fillStyle = DANGER;
      else { const gr = ctx.createLinearGradient(gx, 0, gx + gw, 0); gr.addColorStop(0, DANGER); gr.addColorStop(1, COIN); ctx.fillStyle = gr; }
      ctx.fillRect(gx, gy, gw * frac, 4);
    }
  }
  ctx.restore();
}

/** Active effects stack upward from the controls row. */
function drawEffects(ctx: CanvasRenderingContext2D, g: Game, viewH: number) {
  let ey = controlsBottom(viewH) - (g.rules === "crew" ? TILE.sel.h + TILE.lift : 44) - 8 - CHIP_H;
  const eff: [string, number, string][] = [
    ["SUPER MAGNET", g.effects.superMagnet, "#ff4d4d"],
    ["SLOW-MO", g.effects.slowmo, SYNC],
    ["LONG ARMS", g.effects.reach, CHILL],
    ["CANDY", g.effects.candy, "#ff8fb0"],
  ];
  for (const [name, left, color] of eff) {
    if (left <= 0) continue;
    ctx.save();
    ctx.font = font(800, 12); ctx.letterSpacing = "1.4px";
    const text = tr(`${name} ${left.toFixed(0)}S`);
    const w = ctx.measureText(text).width + 22;
    ctx.fillStyle = SLAB; roundRect(ctx, 12, ey, w, CHIP_H, 8); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(text, 23, ey + CHIP_H / 2);
    ctx.fillStyle = color; ctx.fillRect(23, ey + CHIP_H - 6, (w - 22) * Math.min(1, left / 8), 2);
    ctx.restore();
    ey -= CHIP_H + 6;
  }
}

