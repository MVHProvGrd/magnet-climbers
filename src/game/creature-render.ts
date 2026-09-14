import type { Climber } from "./types";

/** Rendering contract only; ownership, unlocks and pattern IDs belong to the save/UI layer. */
export interface CreatureAppearance {
  creatureId?: string;
  color?: string;
  accent?: string;
  marking?: "plain" | "spots" | "stripes";
}
export const CREATURE_FORMS = {
  human: { width: 8, limb: 6, headX: 7.5, headY: 7.5, color: "#ff8a3d", accent: "#fff0ba" },
  gecko: { width: 10, limb: 5, headX: 10, headY: 6, color: "#76cb73", accent: "#e7f5a7" },
  frog: { width: 16, limb: 6, headX: 11, headY: 7, color: "#64bca4", accent: "#e4ef9a" },
  crab: { width: 21, limb: 5, headX: 8, headY: 4, color: "#f17e67", accent: "#ffe0a2" },
  octopus: { width: 15, limb: 6, headX: 11, headY: 12, color: "#b18cde", accent: "#f4c6df" },
  robot: { width: 14, limb: 5, headX: 10, headY: 8, color: "#7ab7d4", accent: "#b9ffe2" },
  dino: { width: 13, limb: 6, headX: 11, headY: 7, color: "#e4b359", accent: "#77a894" },
} as const;
export function creatureStyle(c: Climber, appearance: CreatureAppearance = {}) {
  const id = appearance.creatureId && Object.prototype.hasOwnProperty.call(CREATURE_FORMS, appearance.creatureId)
    ? appearance.creatureId as keyof typeof CREATURE_FORMS : "human";
  const form = CREATURE_FORMS[id];
  return { ...form, id, color: appearance.color ?? (id === "human" ? c.color : form.color),
    accent: appearance.accent ?? form.accent, marking: appearance.marking ?? "plain" };
}
export type CreatureStyle = ReturnType<typeof creatureStyle>;

function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
/** Body-local decorations. Pure functions of motion/time; never add physics contacts. */
export function drawCreatureDecorations(ctx: CanvasRenderingContext2D, c: Climber, s: CreatureStyle, t: number, shadow: boolean) {
  const motion = Math.max(-1, Math.min(1, c.spin / 8 + c.vx / 700));
  const wave = Math.sin(t * 4 + c.id * 1.7) * (c.state === "flying" ? 3 : 1);
  if (!shadow) { ctx.strokeStyle = ctx.fillStyle = s.color; }
  ctx.lineCap = "round";
  if (s.id === "gecko" || s.id === "dino") {
    ctx.lineWidth = s.id === "dino" ? 8 : 5;
    ctx.beginPath(); ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-motion * 10, 19, 16 + wave, 31, 22 + wave - motion * 8, 19); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(22 + wave - motion * 8, 19); ctx.lineTo(25 + wave - motion * 8, 14); ctx.stroke();
    if (s.id === "dino") {
      if (!shadow) ctx.fillStyle = s.accent;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(-5, -7 + i * 5); ctx.lineTo(-12 + i, -5 + i * 5); ctx.lineTo(-5, -2 + i * 5); ctx.fill();
      }
    }
  }
  if (s.id === "octopus") {
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? -1 : 1, n = i % 2;
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(side * 4, 2 + n * 4);
      ctx.bezierCurveTo(side * (13 + n * 3), 12, side * (18 + wave), 24 + n * 4,
        side * (9 + n * 4) + motion * 5, 20 + n * 3 + wave); ctx.stroke();
    }
  }
  if (s.id === "robot") {
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -21); ctx.lineTo(motion * 3 + wave, -29); ctx.stroke();
    if (!shadow) ctx.fillStyle = s.accent;
    oval(ctx, motion * 3 + wave, -29, 2.5, 2.5);
  }
  if (s.id === "crab") {
    ctx.lineWidth = 2.5;
    for (const side of [-1, 1]) for (let n = 0; n < 2; n++) {
      ctx.beginPath(); ctx.moveTo(side * 8, n * 5);
      ctx.lineTo(side * 16, 4 + n * 6 + wave); ctx.lineTo(side * 19, 10 + n * 6); ctx.stroke();
    }
  }
}

/** Head and torso silhouette uses the same origin/angle as the shared skeleton. */
export function drawCreatureBody(ctx: CanvasRenderingContext2D, s: CreatureStyle, material: CanvasGradient | string, shadow: boolean, part: "all" | "torso" | "head" = "all") {
  const torso = part !== "head", head = part !== "torso";
  if (!shadow) ctx.fillStyle = material;
  if (s.id === "robot") {
    if (torso) { ctx.beginPath(); ctx.roundRect(-7, -8, 14, 19, 3); ctx.fill(); }
    if (head) { ctx.beginPath(); ctx.roundRect(-10, -22, 20, 16, 4); ctx.fill(); }
  } else {
    if (torso) oval(ctx, 0, 1, s.width / 2, s.id === "crab" ? 7 : 11);
    if (head) oval(ctx, 0, -14, s.headX, s.headY);
  }
  if (head && (s.id === "frog" || s.id === "crab" || s.id === "gecko")) {
    for (const side of [-1, 1]) oval(ctx, side * 7, s.id === "crab" ? -19 : -20, 3.5, 4);
  }
  if (shadow) return;
  ctx.fillStyle = s.accent;
  if (s.id === "robot") {
    if (head) { ctx.beginPath(); ctx.roundRect(-8, -19, 16, 9, 2); ctx.fill(); }
    if (torso) oval(ctx, 0, 1, 3, 3);
    ctx.fillStyle = "#315462";
    if (head) for (const x of [-4, 4]) ctx.fillRect(x - 1, -17, 2, 4);
  } else {
    if (torso) oval(ctx, 0, 3, Math.max(3, s.width / 2 - 2), 5);
    if (!head) return;
    ctx.fillStyle = "#f7fff3";
    const eyeY = ["frog", "gecko", "crab"].includes(s.id) ? -20 : -15;
    const gap = s.id === "crab" || s.id === "frog" ? 7 : 5;
    for (const side of [-1, 1]) {
      oval(ctx, side * gap, eyeY, 2.5, 3);
      ctx.fillStyle = "#253748"; oval(ctx, side * gap + .5, eyeY, 1.2, 1.8); ctx.fillStyle = "#f7fff3";
    }
    ctx.strokeStyle = "#34464e"; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(-3, -10); ctx.quadraticCurveTo(0, -8, 3, -10); ctx.stroke();
  }
  ctx.fillStyle = s.accent;
  if (torso && (s.marking === "spots" || s.id === "gecko")) {
    for (const [x, y] of [[-3, -4], [3, 0], [-2, 6]]) oval(ctx, x, y, 1.4, 1.8);
  } else if (torso && s.marking === "stripes") {
    for (const y of [-4, 0, 4]) ctx.fillRect(-s.width / 2 + 2, y, s.width - 4, 1.5);
  }
  if (head) { ctx.fillStyle = "rgba(255,255,255,.35)"; oval(ctx, -3, -17, 2, 1); }
}

/** Decorative cap surrounds a shared tip, never displacing its metallic center. */
export function drawCreatureCap(ctx: CanvasRenderingContext2D, s: CreatureStyle, x: number, y: number, angle: number, limb: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = s.color;
  if (s.id === "frog" || s.id === "gecko") {
    for (const dx of [-4, 0, 4]) oval(ctx, dx, -3, 2, 2.5);
  } else if (s.id === "crab" && limb < 2) {
    oval(ctx, 0, 0, 6, 6);
    ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(-5, -10); ctx.lineTo(-1, -5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(5, -10); ctx.lineTo(1, -5); ctx.fill();
  } else if (s.id === "robot") {
    ctx.beginPath(); ctx.roundRect(-5, -4, 10, 8, 2); ctx.fill();
  } else if (s.id === "octopus") {
    ctx.fillStyle = s.accent; oval(ctx, 0, 0, 5.5, 5.5);
  }
  ctx.restore();
}
