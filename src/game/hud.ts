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

const DOCK_H = 84, DOCK_X = 12, DOCK_W = W - 24;
/** Cells are grid 1.2fr 1fr 1fr across the dock's inner width. */
const CELLS = [1.2, 1, 1];

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
let chatStrip = false;
export function setChatStrip(on: boolean) { chatStrip = on; }
export const dockLift = () => (chatStrip ? 74 : 34);

export function dockRect(viewH: number) {
  const h = DOCK_H;
  return { x: DOCK_X, y: viewH - safeBottom - dockLift() - h, w: DOCK_W, h };
}
/** Legacy name kept for callers that only want "where does the bottom furniture start". */
export function statRowY(_g: Game, viewH: number) { return dockRect(viewH).y; }

function cellRects(viewH: number) {
  const d = dockRect(viewH), total = CELLS.reduce((a, b) => a + b, 0);
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
export const inDanger = (g: Game) => !g.chill && !g.level && g.phase === "running" && redLineCm(g) <= CFG.dangerCm;

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
  const d = dockRect(viewH);
  const out: { id: number; x: number; y: number }[] = [];
  let x = d.x;
  for (const c of g.climbers) {
    if (c.state === "lost") continue;
    const sel = c.id === g.selectedId;
    const w = sel ? TILE.sel.w : TILE.w, h = sel ? TILE.sel.h : TILE.h;
    // centre of a >=44 px tap target, even for the smaller unselected tile
    out.push({ id: c.id, x: x + w / 2, y: d.y - 8 - h / 2 });
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
  const d = dockRect(viewH);
  for (const dot of teamDots(g, viewH)) {
    const c = g.byId(dot.id); if (!c) continue;
    const sel = c.id === g.selectedId;
    const w = sel ? TILE.sel.w : TILE.w, h = sel ? TILE.sel.h : TILE.h;
    const x = dot.x - w / 2, y = d.y - 8 - h - (sel ? TILE.lift : 0);
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
function chip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, extra?: { text: string; color: string }) {
  ctx.save();
  ctx.font = font(800, 12); ctx.letterSpacing = "1.4px";
  const main = tr(text).toUpperCase();
  const tail = extra ? ` ${tr(extra.text)}` : "";
  const w = ctx.measureText(main + tail).width + 22;
  ctx.fillStyle = SLAB; roundRect(ctx, x, y, w, CHIP_H, 8); ctx.fill();
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = color; ctx.fillText(main, x + 11, y + CHIP_H / 2 + 1);
  if (extra) { ctx.fillStyle = extra.color; ctx.fillText(tail, x + 11 + ctx.measureText(main).width, y + CHIP_H / 2 + 1); }
  ctx.restore();
  return w;
}

/* ------------------------------------------------------------------ the dock */

/** The slab and its drop shadow never change within a state; bake them once and blit. */
let slabCache: { key: string; canvas: HTMLCanvasElement; pad: number } | null = null;
function slabFor(w: number, h: number, danger: boolean): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const dpr = Math.min(3, (typeof devicePixelRatio === "number" ? devicePixelRatio : 1) || 1);
  const key = `${w}x${h}|${danger}|${dpr}`;
  if (slabCache?.key === key) return slabCache.canvas;
  const pad = 40;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((w + pad * 2) * dpr); canvas.height = Math.ceil((h + pad * 2) * dpr);
  const c = canvas.getContext("2d");
  if (!c) return null;
  c.scale(dpr, dpr);
  c.shadowColor = danger ? "rgba(255,80,110,.6)" : "rgba(0,0,0,.35)";
  c.shadowBlur = danger ? 24 : 30; c.shadowOffsetY = danger ? 0 : 10;
  c.fillStyle = SLAB; roundRect(c, pad, pad, w, h, 18); c.fill();
  c.shadowColor = "transparent"; c.shadowBlur = 0; c.shadowOffsetY = 0;
  c.fillStyle = "rgba(255,255,255,.12)"; c.fillRect(pad, pad, w, 1);
  slabCache = { key, canvas, pad };
  return canvas;
}

/** Run clock, small and centred at the top: the only thing up there, so it stays out of the way. */
export function drawRunClock(ctx: CanvasRenderingContext2D, g: Game) {
  const total = Math.max(0, Math.floor(g.time));
  const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  ctx.save();
  ctx.font = font(800, 13); ctx.letterSpacing = "1px";
  const w = ctx.measureText(text).width + 20;
  ctx.fillStyle = "rgba(20,22,28,.55)";
  roundRect(ctx, W / 2 - w / 2, 8, w, 24, 8); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, 21);
  ctx.restore();
}

export function drawDock(ctx: CanvasRenderingContext2D, g: Game, viewH: number, time: number) {
  const d = dockRect(viewH), cells = cellRects(viewH);
  const danger = inDanger(g);
  const reduced = reducedMotion;

  ctx.save();
  ctx.textBaseline = "alphabetic";
  // danger throb: scale about the dock's centre, 1 -> 1.06 over 0.6 s
  if (danger && !reduced) {
    const k = 1 + 0.06 * (0.5 - 0.5 * Math.cos((time % 0.6) / 0.6 * Math.PI * 2));
    ctx.translate(d.x + d.w / 2, d.y + d.h / 2); ctx.scale(k, k); ctx.translate(-(d.x + d.w / 2), -(d.y + d.h / 2));
  }

  // slab: one blit of a pre-rendered shadow instead of a blur pass every frame
  const slab = slabFor(d.w, d.h, danger);
  if (slab) {
    const pad = slabCache!.pad;
    ctx.drawImage(slab, d.x - pad, d.y - pad, d.w + pad * 2, d.h + pad * 2);
  } else {
    ctx.fillStyle = SLAB; roundRect(ctx, d.x, d.y, d.w, d.h, 18); ctx.fill();
  }

  /* cell 1 — height, or the charge meter while a drag is held */
  const c1 = cells[0];
  const pull = g.drag ? Math.min(1, Math.hypot(g.drag.cur.x - g.drag.start.x, g.drag.cur.y - g.drag.start.y) / CFG.maxDrag) : 0;
  if (pull > 0) {
    ctx.save(); roundRect(ctx, d.x, d.y, d.w, d.h, 18); ctx.clip();
    const grad = ctx.createLinearGradient(c1.x, 0, c1.x + c1.w * pull, 0);
    grad.addColorStop(0, "rgba(199,125,255,.15)"); grad.addColorStop(1, "rgba(199,125,255,.5)");
    ctx.fillStyle = grad; ctx.fillRect(c1.x, c1.y, c1.w * pull, c1.h);
    ctx.fillStyle = SYNC; ctx.fillRect(c1.x + c1.w * pull - 2, c1.y, 2, c1.h);
    ctx.restore();
  }
  label(ctx, pull > 0 ? `CHARGE ${Math.round(pull * 100)}%` : "HEIGHT", c1.x + 16, c1.y + 24, pull > 0 ? "#e2c8ff" : "rgba(255,255,255,.5)");
  ctx.textAlign = "left";
  ctx.font = font(900, 46); ctx.fillStyle = "#fff"; ctx.letterSpacing = "-0.5px";
  const hStr = groupNum(g.heightCm);
  ctx.fillText(hStr, c1.x + 16, c1.y + 68);
  const hw = ctx.measureText(hStr).width;
  ctx.letterSpacing = "0px";
  ctx.font = font(700, 16); ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.fillText(tr("cm"), c1.x + 16 + hw + 4, c1.y + 68);

  /* cell 2 — red line distance, or the chill/expedition readout */
  const c2 = cells[1];
  ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(c2.x, c2.y + 12, 1, c2.h - 24);
  if (g.chill) {
    label(ctx, "MODE", c2.x + 14, c2.y + 24);
    ctx.font = font(900, 26); ctx.fillStyle = CHILL; ctx.textAlign = "left";
    ctx.fillText(tr("CHILL"), c2.x + 14, c2.y + 56);
    ctx.font = font(700, 11); ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.fillText(tr("NO RED LINE · NOTHING BANKS"), c2.x + 14, c2.y + 72);
  } else if (g.level) {
    const left = g.level.flings - g.flings;
    label(ctx, "FLINGS", c2.x + 14, c2.y + 24);
    ctx.font = font(900, 30); ctx.fillStyle = left <= 2 ? DANGER : "#fff"; ctx.textAlign = "left";
    ctx.fillText(`${left}`, c2.x + 14, c2.y + 60);
    const lw = ctx.measureText(`${left}`).width;
    ctx.font = font(700, 13); ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.fillText(`/ ${g.level.flings}`, c2.x + 14 + lw + 5, c2.y + 60);
  } else {
    const dist = redLineCm(g);
    if (danger) {
      ctx.save(); roundRect(ctx, d.x, d.y, d.w, d.h, 18); ctx.clip();
      ctx.fillStyle = "rgba(255,80,110,.18)"; ctx.fillRect(c2.x, c2.y, c2.w, c2.h); ctx.restore();
    }
    // the arrow flips and the label blinks once the wall is close
    const blink = danger && !reduced ? (Math.floor(time / 0.6) % 2 === 0) : true;
    label(ctx, danger ? "RED LINE ▲" : "RED LINE ▼", c2.x + 14, c2.y + 24,
      danger ? (blink ? DANGER_LIGHT : "rgba(255,138,163,.35)") : "rgba(255,255,255,.5)");
    ctx.textAlign = "left";
    ctx.font = font(900, 30); ctx.fillStyle = danger ? DANGER : "#fff";
    const dStr = groupNum(dist);
    ctx.fillText(dStr, c2.x + 14, c2.y + 60);
    const dw = ctx.measureText(dStr).width;
    ctx.font = font(700, 13); ctx.fillStyle = danger ? DANGER : "rgba(255,255,255,.7)";
    ctx.fillText(tr("cm"), c2.x + 14 + dw + 4, c2.y + 60);
    // 4 px gauge: full when the wall is on your heels
    const gx = c2.x + 14, gw = c2.w - 28, gy = c2.y + c2.h - 16;
    ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(gx, gy, gw, 4);
    const frac = Math.max(0, Math.min(1, 1 - dist / 100));
    if (frac > 0) {
      if (danger) ctx.fillStyle = DANGER;
      else { const gr = ctx.createLinearGradient(gx, 0, gx + gw, 0); gr.addColorStop(0, DANGER); gr.addColorStop(1, COIN); ctx.fillStyle = gr; }
      ctx.fillRect(gx, gy, gw * frac, 4);
    }
  }

  /* cell 3 — wallet */
  const c3 = cells[2];
  ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(c3.x, c3.y + 12, 1, c3.h - 24);
  ctx.save();
  if (danger) ctx.globalAlpha = 0.55;
  const runCoins = g.chill ? 0 : g.coins, runGems = g.chill ? 0 : g.gems;
  const icon = (kind: "coin" | "gem", x: number, y: number) => {
    ctx.save(); ctx.translate(x + 10, y);
    if (!drawPickupImage(ctx, kind, 20)) { ctx.fillStyle = kind === "coin" ? COIN : GEM; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  ctx.font = font(800, 17); ctx.textAlign = "left";
  icon("coin", c3.x + 14, c3.y + 30);
  ctx.fillStyle = COIN; ctx.fillText(groupNum(g.walletCoins + runCoins), c3.x + 38, c3.y + 36);
  icon("gem", c3.x + 14, c3.y + 58);
  ctx.fillStyle = GEM; ctx.fillText(groupNum(g.walletGems + runGems), c3.x + 38, c3.y + 64);
  if (!g.chill && (runCoins > 0 || runGems > 0)) {
    ctx.font = font(700, 11); ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.textAlign = "right";
    ctx.fillText(tr(`+${runCoins} run`), c3.x + c3.w - 14, c3.y + 72);
  }
  ctx.restore();

  // danger outline last, over the cell tints
  if (danger) {
    ctx.strokeStyle = DANGER; ctx.lineWidth = 2;
    roundRect(ctx, d.x + 1, d.y + 1, d.w - 2, d.h - 2, 17); ctx.stroke();
  }
  ctx.restore();

  /* chips above the dock */
  const chipY = d.y - 12 - CHIP_H;
  let cx = d.x;
  const modeName = g.level ? tr(g.level.name).toUpperCase() : g.chill ? "CHILL" : g.rules === "crew" ? "CREW" : "SOLO";
  cx += chip(ctx, cx, chipY, modeName, g.chill ? CHILL : "#fff") + 8;
  if (g.tricks.score > 0) {
    const combo = g.time - g.tricks.lastAt <= 4.5 && g.tricks.combo > 1 ? { text: `×${g.tricks.combo}`, color: "#fff" } : undefined;
    chip(ctx, cx, chipY, `STYLE ${groupNum(g.tricks.score)}`, COIN, combo);
  }

  /* effects stack above the chips */
  let ey = chipY - 8 - CHIP_H;
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
    ctx.fillStyle = SLAB; roundRect(ctx, d.x, ey, w, CHIP_H, 8); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(text, d.x + 11, ey + CHIP_H / 2);
    ctx.fillStyle = color; ctx.fillRect(d.x + 11, ey + CHIP_H - 6, (w - 22) * Math.min(1, left / 8), 2);
    ctx.restore();
    ey -= CHIP_H + 6;
  }

  /* crew tiles + mode buttons */
  if (g.rules === "crew") drawCrew(ctx, g, viewH);
  const b = hudButtons(viewH, g);
  if (g.rules === "crew") {
    const climbing = g.mode === "move";
    button(ctx, b.mode, climbing ? "CLIMB" : "FLING", climbing ? SLAB : ACCENT, climbing ? CLIMB : INK);
    button(ctx, b.sync, "SYNC", g.sync ? SYNC : SLAB, g.sync ? INK : "#fff");
  }
}
