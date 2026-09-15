import { CFG, W } from "./config";
import { objectArtById } from "./gadget-art";
import type { Vec } from "./types";

export interface KidHand {
  side: -1 | 1;
  /** Fixed aim height: never tracks a climber after the warning starts. */
  y: number;
  x: number;
  phase: "warn" | "sweep" | "retract";
  t: number;
  hit: Set<number>;
  near?: number[];
  /** "bottom": rises from below the door, sweeps across, drops out (Codex motion study). Default: side entry. */
  entry?: "bottom";
}
export const SWIPE_DURATION = 0.82;
export const RECOIL_DURATION = 0.46;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => x * x * (3 - 2 * x);
function bezier(a: Vec, b: Vec, c: Vec, d: Vec, t: number): Vec {
  const u = 1 - t;
  return { x: u*u*u*a.x + 3*u*u*t*b.x + 3*u*t*t*c.x + t*t*t*d.x,
    y: u*u*u*a.y + 3*u*u*t*b.y + 3*u*t*t*c.y + t*t*t*d.y };
}
export function swipePoint(y: number, t: number): Vec {
  return bezier({ x: -115, y: y + 160 }, { x: 55, y: y - 165 }, { x: 320, y: y - 105 }, { x: 325, y: y + 105 }, clamp(t));
}
/** Bottom entry: up the near edge, across just above the focus height, out the far edge. Mirrored by side like the rest. */
export function riseSweepPoint(y: number, t: number): Vec {
  return bezier({ x: 70, y: y + 380 }, { x: 40, y: y - 70 }, { x: 360, y: y - 60 }, { x: 345, y: y + 40 }, clamp(t));
}
/** The sweep path for a hand, whichever way it comes in. */
export const pathPoint = (h: KidHand, t: number): Vec => h.entry === "bottom" ? riseSweepPoint(h.y, t) : swipePoint(h.y, t);
export function handPose(h: KidHand) {
  const sweep = clamp(h.t / SWIPE_DURATION);
  let point: Vec;
  const bottom = h.entry === "bottom";
  if (h.phase === "warn") point = bottom
    ? { x: 70, y: h.y + 330 - Math.sin(clamp(h.t / CFG.handWarn) * Math.PI) * 10 }
    : { x: -77 + Math.sin(clamp(h.t / CFG.handWarn) * Math.PI) * 8, y: h.y + 105 };
  else if (h.phase === "sweep") point = pathPoint(h, ease(sweep));
  else point = bottom
    ? bezier({ x: 345, y: h.y + 40 }, { x: 360, y: h.y + 200 }, { x: 370, y: h.y + 330 }, { x: 380, y: h.y + 560 }, ease(clamp(h.t / RECOIL_DURATION)))
    : bezier({ x: 325, y: h.y + 105 }, { x: 220, y: h.y + 230 }, { x: -35, y: h.y + 230 }, { x: -155, y: h.y + 160 }, ease(clamp(h.t / RECOIL_DURATION)));
  // the arm pivots about an offscreen shoulder: left of the door for side entry, below it for bottom entry
  const anchor = bottom ? { x: 150, y: h.y + 520 } : { x: -110, y: h.y + 245 };
  const angle = Math.atan2(point.y - anchor.y, point.x - anchor.x) + (h.phase === "sweep" ? Math.sin(sweep * Math.PI) * 0.25 : 0);
  const curl = h.phase === "warn" ? 1.1 * (1 - ease(clamp(h.t / CFG.handWarn)))
    : h.phase === "retract" ? 1.35 - ease(clamp(h.t / RECOIL_DURATION)) * 0.45
    : ease(clamp((sweep - 0.35) / 0.65)) * 1.35;
  return { point, anchor, angle, mirror: -h.side, curl };
}

// Four short, rounded fingers with distinct lengths; the thumb is separate.
const FINGERS = [{ y: -23, length: 34 }, { y: -8, length: 44 }, { y: 8, length: 39 }, { y: 23, length: 29 }];
/** Shared three-bone fingers and two-bone thumb, with staggered knuckle flexion. */
export function fingerJoints(h: KidHand): { points: Vec[]; radius: number; thumb: boolean }[] {
  const { curl } = handPose(h);
  const fingers = FINGERS.map((finger, index) => {
    const flex = Math.max(0, curl - (3 - index) * 0.09);
    let angle = (index - 1.5) * 0.08 - flex * 0.18;
    const points = [{ x: 18, y: finger.y }];
    for (const [joint, fraction] of [0.44, 0.32, 0.24].entries()) {
      angle += joint === 0 ? 0 : flex * (joint === 1 ? 0.85 : 1.05);
      const prev = points[points.length - 1];
      points.push({ x: prev.x + Math.cos(angle) * finger.length * fraction, y: prev.y + Math.sin(angle) * finger.length * fraction });
    }
    return { points, radius: 7.2, thumb: false };
  });
  const root = { x: -22, y: 17 }, a = 0.95 - curl * 0.15;
  const joint = { x: root.x + Math.cos(a) * 21, y: root.y + Math.sin(a) * 21 };
  fingers.push({ points: [root, joint, { x: joint.x + Math.cos(a + curl * 0.75) * 16, y: joint.y + Math.sin(a + curl * 0.75) * 16 }], radius: 9, thumb: true });
  return fingers;
}
export function handWorldPoint(h: KidHand, local: Vec): Vec {
  const pose = handPose(h), cos = Math.cos(pose.angle), sin = Math.sin(pose.angle);
  const x = pose.point.x + local.x * cos - local.y * sin;
  return { x: h.side < 0 ? x : W - x, y: pose.point.y + local.x * sin + local.y * cos };
}
/** Palm and finger capsules follow exactly the same wrist rotation as the art.
 * Forearm is above the door, not a second invisible hitbox. Only the swat hits.
 */
export function handTouches(h: KidHand, p: Vec, pad = 8): boolean {
  if (h.phase !== "sweep") return false;
  const pose = handPose(h), cos = Math.cos(pose.angle), sin = Math.sin(pose.angle);
  const dx = (h.side < 0 ? p.x : W - p.x) - pose.point.x, dy = p.y - pose.point.y;
  const q = { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
  if ((q.x / (33 + pad)) ** 2 + (q.y / (32 + pad)) ** 2 <= 1) return true;
  const capsule = (a: Vec, b: Vec, radius: number) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx*dx + dy*dy));
    return Math.hypot(q.x - a.x - dx*t, q.y - a.y - dy*t) <= radius + pad;
  };
  for (const finger of fingerJoints(h)) for (let i = 1; i < finger.points.length; i++) {
    if (capsule(finger.points[i - 1], finger.points[i], finger.radius)) return true;
  }
  return false;
}

/** Codex's photographed arm (pack 12), rigid like its motion study: fingers up, wrist at 39% of the height, cuff from 79%.
 * Hand, forearm and cuff are one piece at natural proportions along the swipe angle; only the plain sweater fabric
 * past the cuff is extended so the sleeve always runs offscreen. Fractions of the image, so any export size works. */
const ARM = { tipRow: 0.04, wristRow: 0.395, centreCol: 0.50 };
const ARM_SCALE = 1.6;
function drawPhotoArm(ctx: CanvasRenderingContext2D, pose: ReturnType<typeof handPose>, arm: CanvasImageSource) {
  const iw = (arm as HTMLImageElement).naturalWidth || (arm as HTMLCanvasElement).width || 1;
  const ih = (arm as HTMLImageElement).naturalHeight || (arm as HTMLCanvasElement).height || 1;
  const tip = ARM.tipRow * ih, wristRow = ARM.wristRow * ih, c0 = ARM.centreCol * iw;
  // local hand frame: +x along the fingers, palm heel at x = -34, fingertips at x = 62 (the hit-test's geometry).
  // The photo is drawn ARM_SCALE bigger than that, about the palm centre (x = 14): the hitbox stays inside the palm.
  const s = ARM_SCALE * 96 / (wristRow - tip), tipX = 14 + 48 * ARM_SCALE;
  // the sleeve must still run offscreen when the camera drops below the arm (a bottom-entry hand seen from above), so
  // extend well past the anchor: tiles are cheap
  const reach = Math.hypot(pose.anchor.x - pose.point.x, pose.anchor.y - pose.point.y) + 1000;
  ctx.save(); ctx.translate(pose.point.x, pose.point.y); ctx.rotate(pose.angle);
  ctx.shadowColor = "rgba(30,28,35,0.30)"; ctx.shadowBlur = 15; ctx.shadowOffsetX = 14; ctx.shadowOffsetY = 17;
  // image (col,row) -> local (62 + (tip - row) * s, (c0 - col) * s): thumb lands on the drawn hand's side
  ctx.transform(0, -s, -s, 0, tipX + tip * s, c0 * s);
  ctx.drawImage(arm, 0, 0, iw, ih, 0, 0, iw, ih);
  // sweater past the image's end: repeat the plain sleeve band at natural scale (mirrored every other tile, so no seam)
  const bandRow = Math.round(ih * 0.88), band = ih - bandRow;
  const want = tip + reach / s; // image row the anchor maps to
  for (let y = ih, flip = false; y < want; y += band, flip = !flip) {
    if (!flip) ctx.drawImage(arm, 0, bandRow, iw, band, 0, y, iw, band);
    else { ctx.save(); ctx.translate(0, y + band); ctx.scale(1, -1); ctx.drawImage(arm, 0, bandRow, iw, band, 0, 0, iw, band); ctx.restore(); }
  }
  ctx.restore();
}
export function drawKidHand(ctx: CanvasRenderingContext2D, h: KidHand) {
  const pose = handPose(h);
  ctx.save();
  if (h.side > 0) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  if (h.phase === "warn") {
    // Show the real curved danger route, not a misleading horizontal stripe.
    const pulse = 0.6 + Math.sin(h.t * 14) * 0.15;
    ctx.strokeStyle = `rgba(255,189,90,${pulse * 0.32})`; ctx.lineWidth = 56; ctx.lineCap = "round";
    ctx.beginPath(); const start = pathPoint(h, 0); ctx.moveTo(start.x, start.y);
    for (let i = 1; i <= 30; i++) { const p = pathPoint(h, i / 30); ctx.lineTo(p.x, p.y); } ctx.stroke();
    ctx.strokeStyle = `rgba(255,236,167,${pulse})`; ctx.lineWidth = 2; ctx.setLineDash([6, 9]); ctx.stroke(); ctx.setLineDash([]);
    const ly = h.entry === "bottom" ? h.y + 250 : h.y - 70;
    ctx.fillStyle = "#302b30"; ctx.beginPath(); ctx.roundRect(8, ly, 121, 26, 9); ctx.fill();
    ctx.save(); if (h.side > 0) { ctx.translate(137, 0); ctx.scale(-1, 1); }
    ctx.fillStyle = "#ffe0a1"; ctx.font = "800 11px system-ui"; ctx.textAlign = "center"; ctx.fillText("LOOK OUT!  SWIPE", 68, ly + 17); ctx.restore();
  }
  if (h.phase === "sweep") {
    ctx.lineCap = "round";
    for (let trail = 0; trail < 3; trail++) {
      ctx.strokeStyle = `rgba(255,244,213,${0.24 - trail * 0.05})`; ctx.lineWidth = 3 - trail * 0.6;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const t = ease(clamp(h.t / SWIPE_DURATION - 0.20 + i / 12 * 0.13));
        const p = pathPoint(h, t); if (i === 0) ctx.moveTo(p.x, p.y - 36 - trail * 9); else ctx.lineTo(p.x, p.y - 36 - trail * 9);
      } ctx.stroke();
    }
  }
  const arm = objectArtById("kid-arm");
  if (arm) { drawPhotoArm(ctx, pose, arm); ctx.restore(); return; }
  const wrist = { x: pose.point.x - Math.cos(pose.angle) * 28, y: pose.point.y - Math.sin(pose.angle) * 28 };
  // A continuous tapered forearm connects the wrist to an offscreen sleeve.
  ctx.save(); ctx.shadowColor = "rgba(30,28,35,0.30)"; ctx.shadowBlur = 15; ctx.shadowOffsetX = 14; ctx.shadowOffsetY = 17;
  const skin = ctx.createLinearGradient(pose.point.x - 30, pose.point.y - 45, pose.point.x + 30, pose.point.y + 55);
  skin.addColorStop(0, "#ffe1be"); skin.addColorStop(0.5, "#efb58f"); skin.addColorStop(1, "#cf8e70");
  ctx.fillStyle = skin; ctx.strokeStyle = "#b77961"; ctx.lineWidth = 1.5;
  const control = { x: (pose.anchor.x + wrist.x) / 2 - 15, y: (pose.anchor.y + wrist.y) / 2 - 16 };
  const normal = (a: Vec, b: Vec) => { const d = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: -(b.y - a.y) / d, y: (b.x - a.x) / d }; };
  const n0 = normal(pose.anchor, control), n1 = normal(control, wrist), nm = normal(pose.anchor, wrist);
  ctx.beginPath(); ctx.moveTo(pose.anchor.x - n0.x * 42, pose.anchor.y - n0.y * 42);
  ctx.quadraticCurveTo(control.x - nm.x * 32, control.y - nm.y * 32, wrist.x - n1.x * 20, wrist.y - n1.y * 20);
  ctx.lineTo(wrist.x + n1.x * 20, wrist.y + n1.y * 20);
  ctx.quadraticCurveTo(control.x + nm.x * 32, control.y + nm.y * 32, pose.anchor.x + n0.x * 42, pose.anchor.y + n0.y * 42);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.shadowColor = "transparent"; ctx.strokeStyle = "rgba(255,230,201,0.35)"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(pose.anchor.x - n0.x * 23, pose.anchor.y - n0.y * 23);
  ctx.quadraticCurveTo(control.x - nm.x * 17, control.y - nm.y * 17, wrist.x - n1.x * 9, wrist.y - n1.y * 9); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.translate(pose.anchor.x + 35, pose.anchor.y - 14); ctx.rotate(-0.45);
  ctx.fillStyle = "#508f9f"; ctx.beginPath(); ctx.roundRect(-90, -44, 105, 88, 16); ctx.fill();
  ctx.fillStyle = "#a3d0cc"; ctx.fillRect(-3, -41, 15, 82); ctx.strokeStyle = "#6ba6af"; ctx.lineWidth = 1;
  for (let i = -34; i <= 35; i += 7) { ctx.beginPath(); ctx.moveTo(-2, i); ctx.lineTo(10, i); ctx.stroke(); } ctx.restore();
  ctx.translate(pose.point.x, pose.point.y); ctx.rotate(pose.angle);
  const palm = ctx.createLinearGradient(-15, -35, 30, 44);
  palm.addColorStop(0, "#ffe3c4"); palm.addColorStop(0.52, "#f3bb98"); palm.addColorStop(1, "#d79276");
  ctx.strokeStyle = "#b77961"; ctx.lineJoin = "round"; ctx.lineCap = "round";
  // Rounded, jointed chains: identical bones drive the hit-test.
  const drawFinger = (finger: ReturnType<typeof fingerJoints>[number]) => {
    const points = finger.points, end = points[points.length - 1], prev = points[points.length - 2];
    const path = () => { ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (const p of points.slice(1)) ctx.lineTo(p.x, p.y); };
    ctx.strokeStyle = "#b77961"; ctx.lineWidth = finger.radius * 2 + 2; path(); ctx.stroke();
    ctx.strokeStyle = palm; ctx.lineWidth = finger.radius * 2; path(); ctx.stroke();
    ctx.fillStyle = "#ffe7d4"; ctx.beginPath(); ctx.ellipse(end.x, end.y, 4.7, 3.7, Math.atan2(end.y - prev.y, end.x - prev.x), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(167,96,75,0.34)"; ctx.lineWidth = 0.9;
    for (const p of points.slice(1, -1)) { ctx.beginPath(); ctx.moveTo(p.x, p.y - 3); ctx.quadraticCurveTo(p.x - 2, p.y, p.x, p.y + 3); ctx.stroke(); }
  };
  const fingers = fingerJoints(h);
  for (const finger of fingers.filter((f) => !f.thumb)) drawFinger(finger);
  ctx.fillStyle = palm; ctx.strokeStyle = "#b77961"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-34, -18); ctx.bezierCurveTo(-22, -30, 2, -36, 22, -30);
  ctx.bezierCurveTo(31, -14, 31, 15, 22, 30); ctx.bezierCurveTo(10, 36, -14, 34, -33, 20); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-34, -18); ctx.bezierCurveTo(-22, -30, 2, -36, 22, -30); ctx.stroke();
  drawFinger(fingers[4]);
  ctx.strokeStyle = "rgba(171,100,77,0.26)"; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-19, -10); ctx.quadraticCurveTo(-9, 2, -16, 16); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-29, -12); ctx.quadraticCurveTo(-24, 2, -29, 13); ctx.stroke();
  ctx.fillStyle = "rgba(255,242,221,0.34)"; ctx.beginPath(); ctx.ellipse(0, -14, 17, 7, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
