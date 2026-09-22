import { appearanceFor } from "./creatures";
import { CFG, W } from "./config";
import { SIM_VIEW_H, type Game } from "./game";
import { drawClimber, drawClimberShadow, drawClimberFaded, setArmStretch, getArmStretch } from "./climber-render";
import { t as tr } from "./i18n";
import { drawKidHand } from "./kid-hand";
import { drawCatPaw, drawScratches } from "./cat-paw";
import { drawPickupImage } from "./pickup-art";
import { drawGadget } from "./gadget-art";
import { drawSurface, drawZone, drawBumper, drawPower } from "./scenery";
import { drawDock, dockRect, font, roundRect as slabRect, setHudSafeBottom, prefersReducedMotion, redLineCm } from "./hud";


let lastRenderTime = 0;

/** true on a mouse-and-keyboard device: the idle hint explains Space and WASD instead of dragging */
let keyboardHints = false;
export function setKeyboardHints(on: boolean) { keyboardHints = on; }
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
  // the screen's camera: the sim's, shifted for this screen's height
  const cam = g.viewCamY(viewH);
  ctx.translate(sx, sy - cam);

  // wider than the tallest overdraw beyond a segment: a keychain's hook sits 45 px above its zone
  const top = cam - 80;
  const bottom = cam + viewH + 80;

  drawSurface(ctx, top, bottom);

  for (const s of g.world.segments) {
    if (s.y + s.h < top || s.y > bottom) continue;
    // a throw from one zone's art must not end the frame, and with it the animation loop
    for (const z of s.zones) { try { drawZone(ctx, z, g.time, g.world.seed); } catch (e) { console.error("drawZone", z.itemId, e); } }
    for (const gadget of s.gadgets ?? []) drawGadget(ctx, gadget, g.world.gadgetTime);
    for (const b of s.bumpers) drawBumper(ctx, b, g.time);
    for (const p of s.powerUps) if (!p.taken) drawPower(ctx, p, g.time);
  }

  // CLIMB mode: who the selected climber can climb onto. The range ring that used
  // to sit around the climber is gone with the other rings; the ▲ markers name
  // the actual targets, which the ring never did.
  const climber = g.byId(g.selectedId);
  if (g.rules === "crew" && g.mode === "move" && climber && (climber.state === "stuck" || climber.state === "linked") && g.phase !== "dead") {
    const pulse = 0.5 + Math.sin(g.time * 5) * 0.5;
    for (const o of g.climbTargets(climber)) {
      ctx.strokeStyle = `rgba(155,225,93,${0.5 + pulse * 0.5})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(o.x, o.y - 6, 26 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(155,225,93,0.95)"; ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("▲", o.x, o.y - CFG.stackHeight - 4);
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
    // the line to the target and the ghost already say where you land; a range
    // ring drawn on top of them said nothing extra
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

  // The ghost draws under the live climbers: it is the run you are chasing, not the one you
  // are steering, so it must never be the thing your eye lands on. Pale, no shadow, no hit
  // pips, no selection ring -- a photograph of a climber rather than a climber.
  for (const gg of [g.ghost, g.ghost2]) {
    const gh = gg?.climber;
    if (gh && gh.state !== "lost" && gh.y > top - 80 && gh.y < bottom + 80) {
      // a watcher has no toy of their own, so the ghosts are the whole picture and draw near solid
      drawClimberFaded(ctx, gh, g.time, appearanceFor(gh), g.spectator ? 0.9 : 0.34);
    }
  }

  // climbers (lost ones are gone; ones far off screen are skipped, the markers show them)
  // a watcher's own toy only carries the camera; the two ghosts are the whole picture
  const visible = g.spectator ? [] : g.climbers.filter((c) => c.state !== "lost" && c.y > top - 80 && c.y < bottom + 80);
  // one resolve per climber, shared by the shadow pass and the body pass
  const looks = visible.map((c) => appearanceFor(c));
  for (let i = 0; i < visible.length; i++) drawClimberShadow(ctx, visible[i], g.time, looks[i]);
  for (const [i, c] of visible.entries()) {
    const flicker = c.iframes > 0 && Math.floor(g.time * 18) % 2 === 0;
    // Hit flash: a white halo without a blur pass.
    if (flicker) { ctx.shadowColor = "rgba(255,255,255,0.9)"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 1.5; ctx.shadowOffsetY = 1.5; }
    drawClimber(ctx, c, c.id === g.selectedId && g.phase !== "dead", g.time, looks[i]);
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
  for (const d of g.drops) { ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.spin); if (!drawPickupImage(ctx, "candy", 40)) { ctx.fillStyle = "#e5484d"; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
  for (const p of g.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  // floor / danger line: Cooper's reach, rendered as a rising shadow (absent in chill)
  const fy = g.floorY;
  if (g.chill) { /* no wall */ } else {
  // The telegraph: as the line closes, the bottom of the screen reddens and a hatched band
  // climbs ahead of it, so the threat is seen arriving rather than read off a number.
  const gap = redLineCm(g), near = Math.max(0, Math.min(1, 1 - gap / (CFG.dangerCm * 1.6)));
  if (near > 0 && g.phase === "running") {
    const throb = prefersReducedMotion() ? 1 : 0.85 + 0.15 * Math.sin(g.time * (6 + near * 6));
    const band = 90 + near * 110;
    const gl = ctx.createLinearGradient(0, fy - band, 0, fy);
    gl.addColorStop(0, "rgba(255,60,90,0)"); gl.addColorStop(1, `rgba(255,60,90,${0.28 * near * throb})`);
    ctx.fillStyle = gl; ctx.fillRect(0, fy - band, W, band);
    ctx.save(); ctx.strokeStyle = `rgba(255,90,120,${0.35 * near * throb})`; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -band; x < W; x += 18) { ctx.moveTo(x, fy); ctx.lineTo(x + band * 0.6, fy - band * 0.6); }
    ctx.stroke(); ctx.restore();
  }
  const grad = ctx.createLinearGradient(0, fy - 60, 0, fy + 40);
  grad.addColorStop(0, "rgba(120,20,40,0)");
  grad.addColorStop(1, "rgba(120,20,40,0.85)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, fy - 60, W, bottom - fy + 100);
  ctx.strokeStyle = "rgba(255,80,110,0.9)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  // marching dashes are motion; reduced-motion keeps the red line, drops the march
  ctx.lineDashOffset = prefersReducedMotion() ? 0 : -g.time * 40;
  ctx.beginPath();
  ctx.moveTo(0, fy);
  ctx.lineTo(W, fy);
  ctx.stroke();
  ctx.setLineDash([]);
  }

  // the kid's hand
  if (g.scratches.length) drawScratches(ctx, g.scratches, g.time);
  if (g.hand) drawKidHand(ctx, g.hand, cam, viewH);
  // the paw is drawn where the sim has it, from the sim's camera, so what is shaded is what hurts
  if (g.paw) drawCatPaw(ctx, g.paw, g.camY, SIM_VIEW_H);

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
  drawRail(ctx, g, viewH);
  drawHud(ctx, g, viewH);
  ctx.restore();
}


export { statRowY, hudButtons, teamDots, teamTapRects, dockRect, redLineCm, inDanger, clearAvatars, setChatStrip } from "./hud";

/** The whole in-run HUD is the dock (see hud.ts); this only adds the idle hint above it. */
function drawHud(ctx: CanvasRenderingContext2D, g: Game, viewH: number) {
  drawDock(ctx, g, viewH, g.time);

  // off-screen climbers: coloured arrows at the edge, tappable
  for (const m of offscreenMarkers(g, viewH)) {
    const c = g.byId(m.id)!;
    const dist = Math.round(Math.abs(c.y - g.viewCamY(viewH) - viewH / 2) / CFG.pxPerCm);
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

  drawHint(ctx, g, viewH);
}

/** Logical-px clearance above the bottom edge (gesture bar / home indicator). Set from main. */
export function setSafeBottom(px: number) {
  setHudSafeBottom(px);
}

/** Idle hint: seconds left on the 10 s timer, or null when it should not show (set by main.ts). */
let hintLeft: number | null = null;
export function setHintLeft(v: number | null) { hintLeft = v; }

/**
 * The race rail. A thin scale down the right edge with everyone on it: you, the ghost you are
 * racing, the height to beat and the red line. Off-screen rivals are still on the rail, so a
 * race reads at a glance even when the other climber is a door above or below. Only drawn
 * when there is something to race.
 */
function drawRail(ctx: CanvasRenderingContext2D, g: Game, viewH: number) {
  const ghosts = [g.ghost, g.ghost2].filter((x): x is NonNullable<typeof x> => !!x);
  const best = g.best && g.best.cm > 0 ? g.best.cm : 0;
  // nothing to measure against on a first run with nobody to race: no rail
  if (!ghosts.length && !g.target && !best) return;
  if (g.phase !== "running" && !g.spectator) return;
  const me = g.spectator ? null : g.alive[0] ?? null;
  const cmOf = (y: number) => (g.startY - y) / CFG.pxPerCm;
  const lineCm = g.chill ? 0 : cmOf(g.floorY);
  const marks: { cm: number; kind: "me" | "ghost" | "ghost2" | "target" | "line" | "best" }[] = [];
  if (me) marks.push({ cm: cmOf(me.y), kind: "me" });
  ghosts.forEach((gh, i) => { if (gh.climber) marks.push({ cm: gh.heightCm, kind: i ? "ghost2" : "ghost" }); });
  if (g.target) marks.push({ cm: g.target.cm, kind: "target" });
  if (best) marks.push({ cm: best, kind: "best" });
  if (!g.chill) marks.push({ cm: lineCm, kind: "line" });
  const lo = Math.min(...marks.map((m) => m.cm)), hi = Math.max(...marks.map((m) => m.cm));
  const span = Math.max(300, hi - lo);
  const x = W - 10, y0 = 130, y1 = viewH - 150;
  const yOf = (cm: number) => y1 - ((cm - lo) / span) * (y1 - y0);
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
  // a tick every metre, so the gaps read as distances rather than as a bar
  ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1;
  const step = span > 3000 ? 500 : span > 1200 ? 200 : 100;
  for (let cm = Math.ceil(lo / step) * step; cm <= lo + span; cm += step) { const y = yOf(cm); ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.stroke(); }
  ctx.font = font(800, 10); ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (const m of marks) {
    const y = yOf(m.cm);
    if (m.kind === "line") {
      ctx.strokeStyle = "rgba(255,80,110,.95)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.stroke();
      continue;
    }
    if (m.kind === "target" || m.kind === "best") {
      const beaten = m.kind === "target" ? g.target?.beaten : g.best?.beaten;
      ctx.strokeStyle = beaten ? "rgba(155,225,93,.95)" : m.kind === "best" ? "rgba(255,255,255,.8)" : "rgba(255,210,63,.95)";
      ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.stroke(); ctx.setLineDash([]);
      continue;
    }
    const mine = m.kind === "me";
    ctx.fillStyle = mine ? "#fff" : m.kind === "ghost" ? "rgba(200,210,230,.85)" : "rgba(255,200,120,.85)";
    ctx.beginPath(); ctx.arc(x, y, mine ? 5 : 4, 0, Math.PI * 2); ctx.fill();
    if (mine) { ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  // how far ahead or behind: one number by your own mark, signed, against the nearest rival
  if (me && (ghosts.length || best)) {
    const myCm = cmOf(me.y), rival = ghosts.length ? ghosts[0].heightCm : best, d = Math.round(myCm - rival);
    ctx.fillStyle = d >= 0 ? "rgba(155,225,93,.95)" : "rgba(255,120,140,.95)";
    ctx.fillText(`${d >= 0 ? "+" : ""}${d} cm`, x - 10, yOf(myCm));
  }
  ctx.restore();
}

/** One slab above the dock's shoulder, two lines max, with a draining progress bar (handoff 1g). */
function drawHint(ctx: CanvasRenderingContext2D, g: Game, viewH: number) {
  if (hintLeft === null || g.phase !== "idle") return;
  const lines = keyboardHints
    ? [tr("Hold SPACE to charge, WASD to aim, release to fling.")]
    : g.rules === "solo"
      ? [tr("Put a finger down, pull DOWN, let go to fling up."), tr("Stick to steel. Outrun the red line.")]
      : [tr("Drag back from a climber, release to fling."), tr("SYNC flings the whole crew. CLIMB crawls to a teammate.")];
  const d = dockRect(viewH);
  const h = 10 + lines.length * 19 + 10;
  // above the chip row, which itself sits 12 px over the dock
  const y = d.y - 12 - 28 - 12 - h;
  // the last 3 s fade out rather than vanishing
  const alpha = Math.max(0, Math.min(1, hintLeft / 3));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(20,22,28,.88)";
  slabRect(ctx, 12, y, W - 24, h, 12); ctx.fill();
  ctx.font = font(700, 14); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  lines.forEach((line, i) => ctx.fillText(line, W / 2, y + 26 + i * 19));
  ctx.fillStyle = "#9be15d";
  ctx.fillRect(12, y + h - 2, (W - 24) * Math.max(0, Math.min(1, hintLeft / 10)), 2);
  ctx.restore();
}

/** Edge markers for living climbers that are off screen; tap to select, and the camera follows. */
export function offscreenMarkers(g: Game, viewH: number): { id: number; x: number; y: number; dir: "up" | "down" }[] {
  const out: { id: number; x: number; y: number; dir: "up" | "down" }[] = [];
  for (const c of g.climbers) {
    if (c.state === "lost") continue;
    const sy = c.y - g.viewCamY(viewH);
    if (sy > -40 && sy < viewH + 40) continue;
    const x = Math.max(28, Math.min(W - 28, c.x));
    out.push({ id: c.id, x, y: sy < 0 ? 118 : viewH - 128, dir: sy < 0 ? "up" : "down" });
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
    const field = g.world.fieldAt(x, y);
    const az = field.attract;
    vx += field.ax * dt; vy += field.ay * dt;
    // dots take the colour of the field bending them: red push, blue pull
    ctx.fillStyle = field.repel ? "#ff687d" : az ? "#6fb6ff" : color;
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
    // touched down on glass, plastic or paper: that is where the toy arrives, and nothing there
    // holds it. A hollow ring and a short tail say "you land here, then you slide".
    if (i > 5 && z === 0 && !g.world.isMetal(x, y, CFG.magnetism.panelInset)) {
      ctx.strokeStyle = ctx.fillStyle as string; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke();
      for (let k = 1; k <= 3; k++) {
        ctx.globalAlpha = 0.45 - k * 0.1;
        ctx.beginPath(); ctx.arc(x, y + 6 + k * 7, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
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
