import { CFG, W } from "./config";
import type { Game } from "./game";
import type { Bumper, Climber, NoStickZone, PowerUp } from "./types";
import { DOOR_SEAM } from "./world";

/** Cached brushed-steel pattern so the background is cheap to draw each frame. */
let steelPattern: CanvasPattern | null = null;

function steel(ctx: CanvasRenderingContext2D): CanvasPattern {
  if (steelPattern) return steelPattern;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, "#b9c0c8");
  grad.addColorStop(0.35, "#dfe4e9");
  grad.addColorStop(0.55, "#c4cbd3");
  grad.addColorStop(0.8, "#e4e8ec");
  grad.addColorStop(1, "#b5bcc4");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  // vertical brush streaks
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const l = 6 + Math.random() * 40;
    g.strokeStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.18)" : "rgba(40,50,60,0.10)";
    g.lineWidth = Math.random() < 0.8 ? 1 : 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y + l);
    g.stroke();
  }
  steelPattern = ctx.createPattern(c, "repeat")!;
  return steelPattern;
}

export function render(ctx: CanvasRenderingContext2D, g: Game, viewH: number, dpr: number) {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = g.shake > 0 ? (Math.random() - 0.5) * 8 * g.shake : 0;
  const sy = g.shake > 0 ? (Math.random() - 0.5) * 8 * g.shake : 0;
  ctx.translate(sx, sy - g.camY);

  const top = g.camY - 50;
  const bottom = g.camY + viewH + 50;

  // stainless surface
  ctx.fillStyle = steel(ctx);
  ctx.save();
  ctx.translate(0, Math.floor(g.camY / 256) * 256);
  ctx.fillRect(0, top - Math.floor(g.camY / 256) * 256 - 256, W, viewH + 700);
  ctx.restore();

  // door seam
  ctx.fillStyle = "#2a2e33";
  ctx.fillRect(DOOR_SEAM.x, top, DOOR_SEAM.w, bottom - top);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(DOOR_SEAM.x + DOOR_SEAM.w, top, 1.5, bottom - top);

  for (const s of g.world.segments) {
    if (s.y + s.h < top || s.y > bottom) continue;
    // faint panel line between segments
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.fillRect(0, s.y + s.h - 1, W, 2);
    for (const z of s.zones) drawZone(ctx, z, g.time);
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
      drawClimber(ctx, { ...sel, x: t.x, y: t.y, angle: 0, squash: 0 }, false, g.time);
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
        drawArc(ctx, t.x, t.y, v, "rgba(255,255,255,0.5)");
      }
    }
    if (v) {
      let x = sel.x, y = sel.y, vx = v.x, vy = v.y;
      const dt = 1 / 60;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 70; i++) {
        vy += CFG.gravity * dt;
        x += vx * dt;
        y += vy * dt;
        if (x < CFG.climberRadius || x > W - CFG.climberRadius) vx = -vx * 0.5;
        if (i % 4 === 0) {
          ctx.beginPath();
          ctx.arc(x, y, 3.5 - i / 30, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
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
  for (const c of g.climbers) if (c.state !== "lost") drawClimber(ctx, c, c.id === g.selectedId && g.phase !== "dead", g.time);

  // particles
  for (const p of g.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  // floor / danger line: the kid's reach, rendered as a rising shadow
  const fy = g.floorY;
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

function drawZone(ctx: CanvasRenderingContext2D, z: NoStickZone, t: number) {
  if (z.hue === -1) {
    // metal island: a stainless handle
    ctx.fillStyle = "#cfd6dd";
    roundRect(ctx, z.x, z.y, z.w, z.h, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(z.x + 6, z.y + 4, z.w - 12, 3);
    return;
  }
  switch (z.kind) {
    case "glass": {
      const gr = ctx.createLinearGradient(z.x, z.y, z.x + z.w, z.y + z.h);
      gr.addColorStop(0, "rgba(170,215,235,0.95)");
      gr.addColorStop(0.5, "rgba(120,170,200,0.95)");
      gr.addColorStop(1, "rgba(60,90,120,0.95)");
      ctx.fillStyle = gr;
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = "#5b6470";
      ctx.lineWidth = 6;
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(z.x + 10, z.y + z.h - 10);
      ctx.lineTo(z.x + z.w - 10, z.y + 10);
      ctx.stroke();
      label(ctx, "glass", z);
      break;
    }
    case "trim": {
      ctx.fillStyle = "#23262b";
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let y = z.y + 6; y < z.y + z.h; y += 12) ctx.fillRect(z.x, y, z.w, 2);
      label(ctx, "plastic", z);
      break;
    }
    case "void": {
      ctx.fillStyle = "#101216";
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(z.x, z.y, z.w, 3);
      label(ctx, "gap", z);
      break;
    }
    case "sticker": {
      ctx.save();
      ctx.translate(z.x + z.w / 2, z.y + z.h / 2);
      ctx.rotate(((z.hue ?? 0) % 10 - 5) * 0.02);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-z.w / 2, -z.h / 2, z.w, z.h);
      ctx.fillStyle = `hsl(${z.hue ?? 0} 70% 60%)`;
      ctx.fillRect(-z.w / 2 + 6, -z.h / 2 + 6, z.w - 12, z.h - 22);
      ctx.fillStyle = `hsl(${(z.hue ?? 0) + 40} 60% 40%)`;
      ctx.beginPath();
      ctx.arc(-z.w / 6, -z.h / 8, Math.min(z.w, z.h) / 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#333";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("photo", 0, z.h / 2 - 6);
      ctx.restore();
      break;
    }
    case "repel": {
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.fillStyle = `rgba(255,60,60,${0.35 + pulse * 0.25})`;
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = "#ff3b3b";
      ctx.lineWidth = 3;
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 26px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("N", z.x + z.w / 2, z.y + z.h / 2 + 9);
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.fillText("REPELS", z.x + z.w / 2, z.y + z.h - 6);
      break;
    }
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, z: NoStickZone) {
  if (z.w < 50 || z.h < 30) return;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text.toUpperCase(), z.x + z.w / 2, z.y + z.h / 2 + 4);
}

function drawBumper(ctx: CanvasRenderingContext2D, b: Bumper) {
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  roundRect(ctx, b.x + 3, b.y + 4, b.w, b.h, 6);
  ctx.fill();
  ctx.fillStyle = `hsl(${b.hue} 80% 55%)`;
  roundRect(ctx, b.x, b.y, b.w, b.h, 6);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 4);
}

const POWER_STYLE: Record<PowerUp["kind"], { color: string; glyph: string }> = {
  coin: { color: "#ffd23f", glyph: "$" },
  gem: { color: "#7ef0ff", glyph: "◆" },
  magnet: { color: "#ff4d4d", glyph: "U" },
  extra: { color: "#9be15d", glyph: "+1" },
  slowmo: { color: "#c77dff", glyph: "⏱" },
  reach: { color: "#4fc3f7", glyph: "↔" },
};

function drawPower(ctx: CanvasRenderingContext2D, p: PowerUp, t: number) {
  const st = POWER_STYLE[p.kind];
  const y = p.y + Math.sin(t * 3 + p.bob) * 4;
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.arc(p.x + 2, y + 3, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = st.color;
  ctx.beginPath();
  ctx.arc(p.x, y, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#1a1d24";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(st.glyph, p.x, y + 5);
}

/** The rubbery magnet man: ball head, tube body, four limbs with silver magnet caps. */
function drawClimber(ctx: CanvasRenderingContext2D, c: Climber, selected: boolean, t: number) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  const sq = c.squash;
  ctx.scale(1 + sq * 0.15, 1 - sq * 0.15);

  if (selected) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 4]);
    ctx.lineDashOffset = -t * 30;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // shadow on the surface
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(3, 4, 16, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  const flying = c.state === "flying";
  const spread = flying ? 0.55 : 1;
  const limbs: [number, number][] = [
    [-0.75 * spread - 0.2, -1], // left arm
    [0.75 * spread + 0.2, -1], // right arm
    [-0.5 * spread - 0.15, 1], // left leg
    [0.5 * spread + 0.15, 1], // right leg
  ];
  ctx.lineCap = "round";
  for (const [dx, dy] of limbs) {
    const ex = dx * 22;
    const ey = dy * 20;
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, dy * 4);
    ctx.quadraticCurveTo(ex * 0.5, ey * 0.2, ex, ey);
    ctx.stroke();
    // silver magnet cap
    ctx.fillStyle = "#cfd4da";
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(ex - 1, ey - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // body
  ctx.strokeStyle = c.color;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 8);
  ctx.stroke();
  // head
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.arc(0, -13, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(-3, -16, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, g: Game, viewH: number) {
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, 10, 10, 120, 34, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(`${g.heightCm} cm`, 20, 35);

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
  }

  // wall indicator when the danger line is off the bottom of the screen
  const wallScreen = g.floorY - g.camY;
  if (wallScreen > viewH) {
    const dist = Math.round((g.floorY - Math.max(...g.alive.map((c) => c.y), g.camY)) / CFG.pxPerCm);
    ctx.fillStyle = "rgba(255,80,110,0.9)";
    const wy = g.phase === "idle" ? viewH - 178 : viewH - 100;
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
    roundRect(ctx, 20, viewH - 150, W - 40, 82, 12);
    ctx.fill();
    ctx.fillStyle = "#fff";
    if (g.rules === "solo") {
      ctx.fillText("Drag back anywhere, release to fling.", W / 2, viewH - 113);
      ctx.fillText("Stick to steel. Outrun the red line.", W / 2, viewH - 91);
    } else {
      ctx.fillText("Drag back from a climber, release to fling.", W / 2, viewH - 124);
      ctx.fillText("SYNC flings the whole crew. CLIMB crawls onto a teammate.", W / 2, viewH - 102);
      ctx.fillText("Tap dots to switch. Drag empty steel to look around.", W / 2, viewH - 80);
    }
  }
}

/** Screen-space rects for the canvas buttons; shared with the input code. */
export function hudButtons(viewH: number) {
  return {
    mode: { x: 12, y: viewH - 56, w: 84, h: 42 },
    sync: { x: 104, y: viewH - 56, w: 90, h: 42 },
    recenter: { x: W - 132, y: 100, w: 120, h: 42 },
    reserve: { x: W - 152, y: viewH - 56, w: 140, h: 42 },
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

function drawArc(ctx: CanvasRenderingContext2D, x: number, y: number, v: { x: number; y: number }, color: string) {
  let vx = v.x, vy = v.y;
  const dt = 1 / 60;
  ctx.fillStyle = color;
  for (let i = 0; i < 70; i++) {
    vy += CFG.gravity * dt;
    x += vx * dt;
    y += vy * dt;
    if (x < CFG.climberRadius || x > W - CFG.climberRadius) vx = -vx * 0.5;
    if (i % 5 === 0) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
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
