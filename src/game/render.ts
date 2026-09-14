import { appearanceFor } from "./creatures";
import { CFG, SHOP_ENABLED, W } from "./config";
import type { Game } from "./game";
import { drawClimber, drawClimberShadow, setArmStretch, getArmStretch } from "./climber-render";
import { t as tr } from "./i18n";
import { drawKidHand } from "./kid-hand";
import { drawGadget } from "./gadget-art";
import { drawSurface, drawPanelJoint, drawZone, drawBumper, drawPower } from "./scenery";


let lastRenderTime = 0;

export function render(ctx: CanvasRenderingContext2D, g: Game, viewH: number, dpr: number) {
  // ease the visual arm stretch toward its target while LONG ARMS is active
  {
    const dt = Math.min(0.05, Math.max(0, g.time - lastRenderTime));
    lastRenderTime = g.time;
    const target = g.effects.reach > 0 ? 1.7 : 1;
    const cur = getArmStretch();
    setArmStretch(cur + (target - cur) * Math.min(1, dt * 6));
  }
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = g.shake > 0 ? (Math.random() - 0.5) * 8 * g.shake : 0;
  const sy = g.shake > 0 ? (Math.random() - 0.5) * 8 * g.shake : 0;
  ctx.translate(sx, sy - g.camY);

  const top = g.camY - 50;
  const bottom = g.camY + viewH + 50;

  drawSurface(ctx, top, bottom);

  for (const s of g.world.segments) {
    if (s.y + s.h < top || s.y > bottom) continue;
    drawPanelJoint(ctx, s.y + s.h);
    for (const z of s.zones) drawZone(ctx, z, g.time, g.world.seed);
    for (const gadget of s.gadgets ?? []) drawGadget(ctx, gadget, g.world.gadgetTime);
    for (const b of s.bumpers) drawBumper(ctx, b);
    for (const p of s.powerUps) if (!p.taken) drawPower(ctx, p, g.time);
  }

  // reach rings on anchored climbers when aiming
  if (g.drag) {
    const reach = g.currentReach();
    for (const c of g.anchored) {
      if (g.chainDepthAbove(c) >= g.stats.maxLinks) continue;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, reach, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // links
  ctx.lineWidth = 3;
  for (const c of g.climbers) {
    if (c.state !== "linked" || c.locked) continue;
    const p = g.byId(c.parent);
    if (!p) continue;
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  // trajectory preview
  const sel = g.byId(g.selectedId);
  const v = g.launchVector();
  const moving = sel && g.drag && g.rules === "crew" && (g.mode === "move" || g.isStranded(sel));
  if (sel && g.drag && moving) {
    const t = g.moveTarget(sel, { x: sel.x + (g.drag.cur.x - g.drag.start.x), y: sel.y + (g.drag.cur.y - g.drag.start.y) });
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sel.x, sel.y, g.pullRange(), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (t) {
      ctx.strokeStyle = t.parent == null ? "rgba(155,225,93,0.9)" : "rgba(79,195,247,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sel.x, sel.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      drawClimber(ctx, { ...sel, x: t.x, y: t.y, angle: 0, squash: 0, grip: undefined }, false, g.time, appearanceFor(sel));
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "rgba(255,80,80,0.9)";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(tr("nothing to hold there"), sel.x, sel.y - 40);
    }
  } else if (sel && g.drag) {
    if (v) {
      const k = CFG.launchScale * g.stats.launchMult;
      ctx.strokeStyle = sel.color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(sel.x, sel.y); ctx.lineTo(sel.x - v.x / k, sel.y - v.y / k); ctx.stroke();
    }
    if (v && g.sync && g.rules === "crew") {
      for (const t of g.syncTargets()) {
        if (t.id === sel.id) continue;
        drawArc(ctx, g, t.x, t.y, v, "rgba(255,255,255,0.5)");
      }
    }
    if (v) drawArc(ctx, g, sel.x, sel.y, v, "rgba(255,255,255,0.85)", 4, true);
  }

  // ladder rungs: someone is hanging on them, they cannot fling
  for (const c of g.anchored) {
    if (!g.isLadder(c)) continue;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    roundRect(ctx, c.x - 22, c.y - 42, 44, 16, 5);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(tr("LADDER"), c.x, c.y - 30);
  }

  // climbers (lost ones are gone; ones far off screen are skipped, the markers show them)
  const visible = g.climbers.filter((c) => c.state !== "lost" && c.y > top - 80 && c.y < bottom + 80);
  for (const c of visible) drawClimberShadow(ctx, c, g.time, appearanceFor(c));
  for (const c of visible) {
    const flicker = c.iframes > 0 && Math.floor(g.time * 18) % 2 === 0;
    // Hit flash: a white halo without a blur pass.
    if (flicker) { ctx.shadowColor = "rgba(255,255,255,0.9)"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 1.5; ctx.shadowOffsetY = 1.5; }
    drawClimber(ctx, c, c.id === g.selectedId && g.phase !== "dead", g.time, appearanceFor(c));
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent"; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 1;
    // hp pips above the head, only once someone has taken a hit
    if (c.hp < CFG.maxHp) {
      for (let i = 0; i < CFG.maxHp; i++) {
        ctx.fillStyle = i < c.hp ? "#ff5c8a" : "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.arc(c.x - 8 + i * 8, c.y - 30, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // particles
  for (const p of g.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  // floor / danger line: the kid's reach, rendered as a rising shadow (absent in chill)
  const fy = g.floorY;
  if (g.chill) { /* no wall */ } else {
  const grad = ctx.createLinearGradient(0, fy - 60, 0, fy + 40);
  grad.addColorStop(0, "rgba(120,20,40,0)");
  grad.addColorStop(1, "rgba(120,20,40,0.85)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, fy - 60, W, bottom - fy + 100);
  ctx.strokeStyle = "rgba(255,80,110,0.9)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -g.time * 40;
  ctx.beginPath();
  ctx.moveTo(0, fy);
  ctx.lineTo(W, fy);
  ctx.stroke();
  ctx.setLineDash([]);
  }

  // the kid's hand
  if (g.hand) drawKidHand(ctx, g.hand);

  // your own best: a quiet line to beat, green once you pass it
  if (g.best && g.best.cm > 0) {
    const by = g.startY - g.best.cm * CFG.pxPerCm;
    if (by > top && by < bottom) {
      ctx.strokeStyle = g.best.beaten ? "rgba(155,225,93,0.9)" : "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(W, by); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = g.best.beaten ? "rgba(155,225,93,0.9)" : "rgba(0,0,0,0.5)";
      roundRect(ctx, 10, by - 22, 118, 18, 6);
      ctx.fill();
      ctx.fillStyle = g.best.beaten ? "#1a1d24" : "#fff";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(tr(g.best.beaten ? `BEST BEATEN ✓` : `YOUR BEST · ${g.best.cm} cm`), 69, by - 9);
    }
  }

  // challenge target line
  if (g.target) {
    const ty = g.startY - g.target.cm * CFG.pxPerCm;
    if (ty > top && ty < bottom) {
      ctx.strokeStyle = g.target.beaten ? "rgba(155,225,93,0.9)" : "rgba(255,210,63,0.95)";
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle;
      roundRect(ctx, W - 150, ty - 24, 140, 20, 6);
      ctx.fill();
      ctx.fillStyle = "#1a1d24";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${tr(g.target.name)} · ${tr(`${g.target.cm} cm`)} ${g.target.beaten ? "✓" : ""}`, W - 80, ty - 10);
    }
  }

  // floating text
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const f of g.floats) {
    // keep the text on the fridge even when the event happened near an edge
    const half = ctx.measureText(f.text).width / 2 + 6;
    const fx = Math.max(half, Math.min(W - half, f.x));
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillText(tr(f.text), fx + 1, f.y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(tr(f.text), fx, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // HUD (screen space)
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawHud(ctx, g, viewH);
  ctx.restore();
}


function drawHud(ctx: CanvasRenderingContext2D, g: Game, viewH: number) {
  if (g.tricks.score > 0) {
    ctx.fillStyle = "rgba(22,34,43,.8)";
    roundRect(ctx, 10, 96, 138, 23, 7); ctx.fill();
    ctx.fillStyle = "#ffe393"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "left";
    const combo = g.time - g.tricks.lastAt <= 4.5 && g.tricks.combo > 1 ? `  ×${g.tricks.combo}` : "";
    ctx.fillText(tr(`STYLE ${g.tricks.score}${combo}`), 19, 112);
  }
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, 10, 10, 120, !g.chill && g.phase === "running" ? 48 : 34, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(tr(`${g.heightCm} cm`), 20, 35);

  if (!g.chill && g.phase === "running") {
    const m = g.wallMult();
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = m >= 2.5 ? "#ff6b6b" : m >= 1.6 ? "#ffd23f" : "rgba(255,255,255,0.85)";
    ctx.fillText(tr(`▲ wall ${m.toFixed(1)}x`), 20, 50);
  }

  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, W - 130, 10, 120, (!g.chill && (g.coins > 0 || g.gems > 0)) ? 46 : 34, 10);
  ctx.fill();
  // wallet + this run's pickups (chill runs bank nothing, so show only the wallet there)
  const runCoins = g.chill ? 0 : g.coins, runGems = g.chill ? 0 : g.gems;
  ctx.fillStyle = "#ffd23f";
  ctx.fillText(`$${g.walletCoins + runCoins}`, W - 72, 32);
  ctx.fillStyle = "#7ef0ff";
  ctx.fillText(`◆${g.walletGems + runGems}`, W - 20, 32);
  if (runCoins > 0 || runGems > 0) {
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(tr(`+${runCoins}${runGems ? ` ◆+${runGems}` : ""} this run`), W - 20, 46);
    ctx.font = "bold 15px system-ui, sans-serif";
  }

  // team dots double as the active-climber selector
  for (const d of teamDots(g)) {
    const c = g.byId(d.id)!;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.arc(d.x, d.y, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.color;
    ctx.beginPath(); ctx.arc(d.x, d.y, 10, 0, Math.PI * 2); ctx.fill();
    if (c.id === g.selectedId) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke(); }
    if (c.state === "flying") { ctx.fillStyle = "#fff"; ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("↑", d.x, d.y + 4); }
    if (g.isLadder(c)) { ctx.fillStyle = "#1a1d24"; ctx.fillRect(d.x - 5, d.y - 1, 10, 2); ctx.fillRect(d.x - 5, d.y + 3, 10, 2); ctx.fillRect(d.x - 5, d.y - 5, 10, 2); }
    // hp pips under the dot
    for (let i = 0; i < CFG.maxHp; i++) {
      ctx.fillStyle = i < c.hp ? "#ff5c8a" : "rgba(0,0,0,0.5)";
      ctx.fillRect(d.x - 7 + i * 5, d.y + 18, 4, 3);
    }
  }

  if (g.level) {
    // expedition: level name in the middle, flings below it
    const name = tr(g.level.name).toUpperCase();
    ctx.font = "bold 11px system-ui, sans-serif"; ctx.textAlign = "center";
    const w = Math.max(90, ctx.measureText(name).width + 24);
    ctx.fillStyle = "rgba(0,0,0,0.45)"; roundRect(ctx, W / 2 - w / 2, 10, w, 22, 8); ctx.fill();
    ctx.fillStyle = "#ffd23f"; ctx.fillText(name, W / 2, 25);
    const left = g.level.flings - g.flings;
    ctx.fillStyle = "rgba(0,0,0,0.45)"; roundRect(ctx, W / 2 - 52, 36, 104, 22, 8); ctx.fill();
    ctx.fillStyle = left <= 2 ? "#ff8a8a" : "#fff"; ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(tr(`FLINGS ${left} / ${g.level.flings}`), W / 2, 51);
  } else if (g.chill) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, W / 2 - 34, 10, 68, 22, 8);
    ctx.fill();
    ctx.fillStyle = "#9be15d";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(tr("😌 CHILL"), W / 2, 25);
  }

  // off-screen climbers: coloured arrows at the edge, tappable
  for (const m of offscreenMarkers(g, viewH)) {
    const c = g.byId(m.id)!;
    const dist = Math.round(Math.abs(c.y - g.camY - viewH / 2) / CFG.pxPerCm);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    roundRect(ctx, m.x - 26, m.y - 16, 52, 32, 10);
    ctx.fill();
    ctx.fillStyle = c.color;
    ctx.beginPath();
    if (m.dir === "down") { ctx.moveTo(m.x - 8, m.y - 8); ctx.lineTo(m.x + 8, m.y - 8); ctx.lineTo(m.x, m.y + 2); }
    else { ctx.moveTo(m.x - 8, m.y + 2); ctx.lineTo(m.x + 8, m.y + 2); ctx.lineTo(m.x, m.y - 8); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(tr(`${dist} cm`), m.x, m.y + 13);
  }

  // wall indicator when the danger line is off the bottom of the screen
  const wallScreen = g.floorY - g.camY;
  if (!g.chill && wallScreen > viewH) {
    const dist = Math.round((g.floorY - Math.max(...g.alive.map((c) => c.y), g.camY)) / CFG.pxPerCm);
    ctx.fillStyle = "rgba(255,80,110,0.9)";
    const wy = g.phase === "idle" ? viewH - 150 - safeBottom : viewH - 72 - safeBottom;
    roundRect(ctx, W / 2 - 70, wy, 140, 26, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(tr(`▼ wall ${dist} cm below`), W / 2, wy + 18);
  }

  // active effects
  // below the height box, team dots and the STYLE readout
  let ey = 126;
  const eff: [string, number, string][] = [
    ["SUPER MAGNET", g.effects.superMagnet, "#ff4d4d"],
    ["SLOW-MO", g.effects.slowmo, "#c77dff"],
    ["LONG ARMS", g.effects.reach, "#9be15d"],
  ];
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "left";
  for (const [name, left, color] of eff) {
    if (left <= 0) continue;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, 10, ey, 130, 20, 6);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(12, ey + 16, 126 * Math.min(1, left / 8), 2);
    ctx.fillStyle = "#fff";
    ctx.fillText(tr(`${name} ${left.toFixed(0)}s`), 16, ey + 13);
    ey += 26;
  }

  // bottom buttons
  const b = hudButtons(viewH);
  ctx.textAlign = "center";
  ctx.font = "bold 14px system-ui, sans-serif";
  if (g.rules === "crew") {
    ctx.fillStyle = g.mode === "fling" ? "#ff8a3d" : "#4fc3f7";
    roundRect(ctx, b.mode.x, b.mode.y, b.mode.w, b.mode.h, 12);
    ctx.fill();
    ctx.fillStyle = "#1a1d24";
    ctx.fillText(tr(g.mode === "fling" ? "FLING" : "CLIMB"), b.mode.x + b.mode.w / 2, b.mode.y + 27);
  }
  if (g.rules === "crew" && !g.level) {
    ctx.fillStyle = g.sync ? "#c77dff" : "rgba(0,0,0,0.45)";
    roundRect(ctx, b.sync.x, b.sync.y, b.sync.w, b.sync.h, 12);
    ctx.fill();
    ctx.fillStyle = g.sync ? "#1a1d24" : "#fff";
    ctx.fillText(tr(g.sync ? "SYNC ON" : "SYNC"), b.sync.x + b.sync.w / 2, b.sync.y + 27);
  }
  if (g.freeCam) {
    ctx.fillStyle = "#fff";
    roundRect(ctx, b.recenter.x, b.recenter.y, b.recenter.w, b.recenter.h, 12);
    ctx.fill();
    ctx.fillStyle = "#1a1d24";
    ctx.fillText(tr("◎ RECENTER"), b.recenter.x + b.recenter.w / 2, b.recenter.y + 27);
  }
  if (SHOP_ENABLED && g.rules === "crew" && g.reserves > 0) {
    ctx.fillStyle = "#9be15d";
    roundRect(ctx, b.reserve.x, b.reserve.y, b.reserve.w, b.reserve.h, 12);
    ctx.fill();
    ctx.fillStyle = "#1a1d24";
    ctx.fillText(tr(`+1 RESERVE (${g.reserves})`), b.reserve.x + b.reserve.w / 2, b.reserve.y + 27);
  }

  if (g.phase === "idle") {
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    const hb = viewH - 122 - safeBottom; // hint box top
    roundRect(ctx, 20, hb, W - 40, 82, 12);
    ctx.fill();
    ctx.fillStyle = "#fff";
    if (g.rules === "solo") {
      ctx.fillText(tr("Drag back anywhere, release to fling."), W / 2, hb + 37);
      ctx.fillText(tr("Stick to steel. Outrun the red line."), W / 2, hb + 59);
    } else {
      ctx.fillText(tr("Drag back from a climber, release to fling."), W / 2, hb + 26);
      ctx.fillText(tr("SYNC flings the whole crew. CLIMB crawls to a teammate."), W / 2, hb + 48);
      ctx.fillText(tr("Tap dots to switch. Drag empty steel to look around."), W / 2, hb + 70);
    }
  }
}

/** Logical-px clearance above the bottom edge (gesture bar / home indicator). Set from main. */
let safeBottom = 28;
export function setSafeBottom(px: number) {
  safeBottom = Math.max(28, px);
}

/** Screen-space rects for the canvas buttons; shared with the input code. */
export function hudButtons(viewH: number) {
  const by = viewH - 42 - safeBottom;
  return {
    mode: { x: 12, y: by, w: 84, h: 42 },
    sync: { x: 104, y: by, w: 90, h: 42 },
    recenter: { x: W - 132, y: 100, w: 120, h: 42 },
    reserve: { x: W - 152, y: by, w: 140, h: 42 },
  };
}

/** Edge markers for living climbers that are off screen; tap to select and recenter. */
export function offscreenMarkers(g: Game, viewH: number): { id: number; x: number; y: number; dir: "up" | "down" }[] {
  const out: { id: number; x: number; y: number; dir: "up" | "down" }[] = [];
  for (const c of g.climbers) {
    if (c.state === "lost") continue;
    const sy = c.y - g.camY;
    if (sy > -40 && sy < viewH + 40) continue;
    const x = Math.max(28, Math.min(W - 28, c.x));
    out.push({ id: c.id, x, y: sy < 0 ? 118 : viewH - 128, dir: sy < 0 ? "up" : "down" });
  }
  return out;
}

/** Screen-space positions of the HUD team dots (tap to select). */
export function teamDots(g: Game): { id: number; x: number; y: number }[] {
  const out: { id: number; x: number; y: number }[] = [];
  let x = 26;
  for (const c of g.climbers) {
    if (c.state === "lost") continue;
    out.push({ id: c.id, x, y: 66 });
    x += 32;
  }
  return out;
}

/**
 * Aim preview. Integrates the same forces the flyer feels (gravity, repel plates,
 * wall bounce) at 1/60 s so the dotted path bends where the real path bends.
 * Preview only: it never touches the simulation.
 */
function drawArc(ctx: CanvasRenderingContext2D, g: Game, x: number, y: number, v: { x: number; y: number }, color: string, every = 5, taper = false) {
  let vx = v.x, vy = v.y;
  const dt = 1 / 60;
  // same hop model as the sim: pop off the door with the pull, get pulled back by magnetism
  const full = CFG.maxDrag * CFG.launchScale * g.stats.launchMult;
  const pull = Math.max(0, Math.min(1, Math.hypot(v.x, v.y) / full));
  let z = 0, vz = CFG.hop.liftMin + (CFG.hop.liftFull - CFG.hop.liftMin) * pull;
  const magnet = 1 + g.levels.magnet * CFG.hop.magnetPerLevel;
  ctx.fillStyle = color;
  for (let i = 0; i < 110; i++) {
    vy += CFG.gravity * dt;
    const rz = g.world.repelAt(x, y);
    if (rz) {
      const cx = rz.x + rz.w / 2, cy = rz.y + rz.h / 2;
      const dx = x - cx, dy = y - cy;
      const d = Math.max(20, Math.hypot(dx, dy));
      vx += (dx / d) * 1400 * dt;
      vy += (dy / d) * 1400 * dt;
    }
    const az = g.world.attractAt(x, y);
    if (az) {
      const cx = az.x + az.w / 2, cy = az.y + az.h / 2;
      const dx = cx - x, dy = cy - y;
      const d = Math.max(20, Math.hypot(dx, dy));
      vx += (dx / d) * 1500 * dt;
      vy += (dy / d) * 1500 * dt;
    }
    let gz = CFG.hop.zGravity * magnet;
    if (!g.world.isMetal(x, y, 6)) gz *= CFG.hop.offMetal;
    if (az) gz += CFG.hop.attractPull;
    if (g.effects.superMagnet > 0) gz *= CFG.hop.superMagnet;
    vz -= gz * dt; z = Math.max(0, z + vz * dt);
    x += vx * dt;
    y += vy * dt;
    if (x < CFG.climberRadius) { x = CFG.climberRadius; vx = Math.abs(vx) * 0.5; }
    if (x > W - CFG.climberRadius) { x = W - CFG.climberRadius; vx = -Math.abs(vx) * 0.5; }
    // landed on steel: this is where the magnet catches. A bigger dot marks it.
    if (i > 5 && z === 0 && g.world.isMetal(x, y, CFG.magnetism.snapDistance + g.stats.magnetRadius)) {
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); break;
    }
    if (i % every === 0) {
      // dots shrink as the toy comes back toward the door
      const r = (taper ? 3.5 - i / 40 : 2.5) + z * 0.03;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}


function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
