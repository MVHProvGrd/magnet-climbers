import { CFG, W } from "./config";
import type { Game } from "./game";
import { drawClimber, drawClimberShadow, setArmStretch, getArmStretch } from "./climber-render";
import { drawKidHand } from "./kid-hand";
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
    if (c.state !== "linked") continue;
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
      drawClimber(ctx, { ...sel, x: t.x, y: t.y, angle: 0, squash: 0, grip: undefined }, false, g.time);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "rgba(255,80,80,0.9)";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("nothing to hold there", sel.x, sel.y - 40);
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
    ctx.fillText("LADDER", c.x, c.y - 30);
  }

  // climbers (lost ones are gone)
  for (const c of g.climbers) if (c.state !== "lost") drawClimberShadow(ctx, c);
  for (const c of g.climbers) {
    if (c.state === "lost") continue;
    const flicker = c.iframes > 0 && Math.floor(g.time * 18) % 2 === 0;
    if (flicker) ctx.globalAlpha = 0.45;
    drawClimber(ctx, c, c.id === g.selectedId && g.phase !== "dead", g.time);
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
      ctx.fillText(`${g.target.name} · ${g.target.cm} cm ${g.target.beaten ? "✓" : ""}`, W - 80, ty - 10);
    }
  }

  // floating text
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const f of g.floats) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
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
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, 10, 10, 120, !g.chill && g.phase === "running" ? 48 : 34, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(`${g.heightCm} cm`, 20, 35);
  if (!g.chill && g.phase === "running") {
    const m = g.wallMult();
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = m >= 2.5 ? "#ff6b6b" : m >= 1.6 ? "#ffd23f" : "rgba(255,255,255,0.85)";
    ctx.fillText(`▲ wall ${m.toFixed(1)}x`, 20, 50);
  }

  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, W - 130, 10, 120, 34, 10);
  ctx.fill();
  ctx.fillStyle = "#ffd23f";
  ctx.fillText(`$${g.coins}`, W - 72, 32);
  ctx.fillStyle = "#7ef0ff";
  ctx.fillText(`◆${g.gems}`, W - 20, 32);

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

  if (g.chill) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, W / 2 - 34, 10, 68, 22, 8);
    ctx.fill();
    ctx.fillStyle = "#9be15d";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("😌 CHILL", W / 2, 25);
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
    ctx.fillText(`▼ wall ${dist} cm below`, W / 2, wy + 18);
  }

  // active effects
  let ey = 80;
  const eff: [string, number, string][] = [
    ["SUPER MAGNET", g.effects.superMagnet, "#ff4d4d"],
    ["SLOW-MO", g.effects.slowmo, "#c77dff"],
    ["LONG ARMS", g.effects.reach, "#9be15d"],
  ];
  ctx.font = "bold 12px system-ui, sans-serif";
  for (const [name, left, color] of eff) {
    if (left <= 0) continue;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, 10, ey, 130, 20, 6);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(12, ey + 16, 126 * Math.min(1, left / 8), 2);
    ctx.fillStyle = "#fff";
    ctx.fillText(`${name} ${left.toFixed(0)}s`, 16, ey + 13);
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
    ctx.fillText(g.mode === "fling" ? "FLING" : "CLIMB", b.mode.x + b.mode.w / 2, b.mode.y + 27);
  }
  if (g.rules === "crew") {
    ctx.fillStyle = g.sync ? "#c77dff" : "rgba(0,0,0,0.45)";
    roundRect(ctx, b.sync.x, b.sync.y, b.sync.w, b.sync.h, 12);
    ctx.fill();
    ctx.fillStyle = g.sync ? "#1a1d24" : "#fff";
    ctx.fillText(g.sync ? "SYNC ON" : "SYNC", b.sync.x + b.sync.w / 2, b.sync.y + 27);
  }
  if (g.freeCam) {
    ctx.fillStyle = "#fff";
    roundRect(ctx, b.recenter.x, b.recenter.y, b.recenter.w, b.recenter.h, 12);
    ctx.fill();
    ctx.fillStyle = "#1a1d24";
    ctx.fillText("◎ RECENTER", b.recenter.x + b.recenter.w / 2, b.recenter.y + 27);
  }
  if (g.rules === "crew" && g.reserves > 0) {
    ctx.fillStyle = "#9be15d";
    roundRect(ctx, b.reserve.x, b.reserve.y, b.reserve.w, b.reserve.h, 12);
    ctx.fill();
    ctx.fillStyle = "#1a1d24";
    ctx.fillText(`+1 RESERVE (${g.reserves})`, b.reserve.x + b.reserve.w / 2, b.reserve.y + 27);
  }

  if (g.phase === "idle") {
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    const hb = viewH - 122 - safeBottom; // hint box top
    roundRect(ctx, 20, hb, W - 40, 82, 12);
    ctx.fill();
    ctx.fillStyle = "#fff";
    if (g.rules === "solo") {
      ctx.fillText("Drag back anywhere, release to fling.", W / 2, hb + 37);
      ctx.fillText("Stick to steel. Outrun the red line.", W / 2, hb + 59);
    } else {
      ctx.fillText("Drag back from a climber, release to fling.", W / 2, hb + 26);
      ctx.fillText("SYNC flings the whole crew. CLIMB crawls to a teammate.", W / 2, hb + 48);
      ctx.fillText("Tap dots to switch. Drag empty steel to look around.", W / 2, hb + 70);
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
  ctx.fillStyle = color;
  for (let i = 0; i < 70; i++) {
    vy += CFG.gravity * dt;
    const rz = g.world.repelAt(x, y);
    if (rz) {
      const cx = rz.x + rz.w / 2, cy = rz.y + rz.h / 2;
      const dx = x - cx, dy = y - cy;
      const d = Math.max(20, Math.hypot(dx, dy));
      vx += (dx / d) * 1400 * dt;
      vy += (dy / d) * 1400 * dt;
    }
    x += vx * dt;
    y += vy * dt;
    if (x < CFG.climberRadius) { x = CFG.climberRadius; vx = Math.abs(vx) * 0.5; }
    if (x > W - CFG.climberRadius) { x = W - CFG.climberRadius; vx = -Math.abs(vx) * 0.5; }
    if (i % every === 0) {
      ctx.beginPath();
      ctx.arc(x, y, taper ? 3.5 - i / 30 : 2.5, 0, Math.PI * 2);
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
