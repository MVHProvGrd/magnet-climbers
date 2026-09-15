import { bodyLift, limbTip, rotate } from "./magnetism";
import type { Climber, Vec } from "./types";
import { flightLimb, LIMB_ROOTS, plantedJoint } from "./ragdoll";
import { creatureStyle, drawCreatureBody, drawCreatureCap, drawCreatureDecorations, type CreatureAppearance } from "./creature-render";
export type { CreatureAppearance } from "./creature-render";

interface Point extends Vec { z: number }

/** Visual arm stretch (1 = normal). Set by the renderer while LONG ARMS is active; eased there. */
let armStretch = 1;
export function setArmStretch(v: number) {
  armStretch = v;
}
export function getArmStretch(): number {
  return armStretch;
}

function geometry(c: Climber, appearance: CreatureAppearance = {}) {
  const style = creatureStyle(c, appearance);
  const lift = bodyLift(c);
  const bodyPoint = (x: number, y: number, z = lift): Point => {
    const p = rotate({ x, y }, c.angle);
    return { x: c.x + p.x, y: c.y + p.y, z };
  };
  const shoulder = bodyPoint(0, -5), hip = bodyPoint(0, 7), head = bodyPoint(0, -14, lift + 2);
  const limbs = [0, 1, 2, 3].map((limb) => {
    const tip = limbTip(c, limb);
    const attached = c.state === "stuck" && c.grip?.contacts.some((p) => p.limb === limb);
    const side = limb % 2 ? 1 : -1;
    const root = style.id === "octopus" ? { x: side * (limb < 2 ? 8 : 4), y: -2 }
      : style.id === "crab" ? { x: side * 11, y: limb < 2 ? -4 : 4 }
      : style.id === "frog" ? { x: side * (limb < 2 ? 7 : 10), y: limb < 2 ? -7 : 6 }
      : LIMB_ROOTS[limb];
    const start = bodyPoint(root.x, root.y);
    const stretch = limb < 2 ? armStretch : 1;
    const end: Point = attached || stretch === 1
      ? { ...tip, z: attached ? 0 : lift + 3 }
      : { x: start.x + (tip.x - start.x) * stretch, y: start.y + (tip.y - start.y) * stretch, z: lift + 3 };
    const flight = flightLimb(c, limb);
    const localTip = rotate({ x: end.x - c.x, y: end.y - c.y }, -c.angle);
    const joint = flight && stretch === 1 ? flight.joint : plantedJoint(root, localTip, limb);
    const spread = style.id === "frog" && limb >= 2 ? 7 : style.id === "octopus" ? 5 : 0;
    const middle = bodyPoint(joint.x + side * spread, joint.y, (start.z + end.z) / 2 + 3 + (attached ? (stretch - 1) * 10 : 0));
    return { start, middle, end, attached };
  });
  return { shoulder, hip, head, limbs, lift };
}

function project(p: Point, shadow: boolean): Vec {
  // Camera stays frontal. Light travels from the upper-left window down/right.
  return shadow ? { x: p.x + 2 + p.z * 0.85, y: p.y + 3 + p.z * 0.65 }
    : { x: p.x - p.z * 0.12, y: p.y - p.z * 0.38 };
}

function tube(ctx: CanvasRenderingContext2D, start: Vec, middle: Vec, end: Vec) {
  ctx.beginPath(); ctx.moveTo(start.x, start.y);
  ctx.lineTo((start.x + middle.x) / 2, (start.y + middle.y) / 2);
  ctx.quadraticCurveTo(middle.x, middle.y, (middle.x + end.x) / 2, (middle.y + end.y) / 2);
  ctx.lineTo(end.x, end.y); ctx.stroke();
}

export function drawClimberShadow(ctx: CanvasRenderingContext2D, c: Climber, t = 0, appearance: CreatureAppearance = {}) {
  const shape = geometry(c, appearance);
  const style = creatureStyle(c, appearance);
  ctx.save();
  // No canvas shadowBlur here: a blur pass per climber per frame was the main cost with a full crew.
  // A wider, fainter stroke reads the same at game scale; higher toys get a softer, wider shadow.
  const opacity = Math.max(0.05, 0.2 - shape.lift * 0.0035);
  ctx.strokeStyle = ctx.fillStyle = `rgba(31,37,48,${opacity})`;
  ctx.lineCap = "round"; ctx.lineWidth = style.limb + 1 + shape.lift * 0.12;
  if (style.id !== "human") {
    const origin = project({ x: c.x, y: c.y, z: shape.lift }, true);
    ctx.save(); ctx.translate(origin.x, origin.y); ctx.rotate(c.angle);
    drawCreatureDecorations(ctx, c, style, t, true);
    drawCreatureBody(ctx, style, "", true); ctx.restore();
    for (const limb of shape.limbs) tube(ctx, project(limb.start, true), project(limb.middle, true), project(limb.end, true));
    ctx.restore(); return;
  }
  for (const limb of shape.limbs) tube(ctx, project(limb.start, true), project(limb.middle, true), project(limb.end, true));
  ctx.lineWidth = 9;
  tube(ctx, project(shape.shoulder, true), project(shape.hip, true), project(shape.hip, true));
  const head = project(shape.head, true);
  ctx.beginPath(); ctx.arc(head.x, head.y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Blend a hex colour toward another (0 = colour, 1 = target). Non-hex input passes through. */
function mix(hex: string, target: string, amount: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const a = parseInt(hex.slice(1), 16), b = parseInt(target.slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * amount).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}
/** Creature body in body-local space; the gloss gradient is built there too so it lines up after the rotate. */
function drawBodyLocal(ctx: CanvasRenderingContext2D, origin: Vec, angle: number, style: ReturnType<typeof creatureStyle>, part: "all" | "torso" | "head" = "all") {
  ctx.save(); ctx.translate(origin.x, origin.y); ctx.rotate(angle);
  const gloss = ctx.createLinearGradient(-20, -26, 20, 16);
  gloss.addColorStop(0, mix(style.color, "#ffffff", 0.7)); gloss.addColorStop(0.18, style.color);
  gloss.addColorStop(0.85, style.color); gloss.addColorStop(1, mix(style.color, "#2a3038", 0.55));
  drawCreatureBody(ctx, style, gloss, false, part);
  ctx.restore();
}

/** Flexible toy geometry, metallic tips, and a common window light in world coordinates. */
export function drawClimber(ctx: CanvasRenderingContext2D, c: Climber, selected: boolean, t: number, appearance: CreatureAppearance = {}) {
  const shape = geometry(c, appearance);
  const style = creatureStyle(c, appearance);
  ctx.save();
  if (selected) {
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]); ctx.lineDashOffset = -t * 24;
    ctx.beginPath(); ctx.arc(c.x, c.y, 33, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  // limbs can reach well past the body; the ends are tints of the toy's own colour so a far limb never clamps to white or grey
  const material = ctx.createLinearGradient(c.x - 40, c.y - 40, c.x + 40, c.y + 40);
  material.addColorStop(0, mix(style.color, "#ffffff", 0.75)); material.addColorStop(0.3, style.color);
  material.addColorStop(0.78, style.color); material.addColorStop(1, mix(style.color, "#2a3038", 0.55));
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const origin = project({ x: c.x, y: c.y, z: shape.lift }, false);
  if (style.id !== "human") {
    ctx.save(); ctx.translate(origin.x, origin.y); ctx.rotate(c.angle);
    drawCreatureDecorations(ctx, c, style, t, false); ctx.restore();
  }
  for (const [index, limb] of shape.limbs.entries()) {
    const start = project(limb.start, false), middle = project(limb.middle, false), end = project(limb.end, false);
    ctx.strokeStyle = "rgba(45,37,42,0.32)"; ctx.lineWidth = style.limb + 1.5;
    tube(ctx, start, middle, end);
    ctx.strokeStyle = material; ctx.lineWidth = style.limb;
    tube(ctx, start, middle, end);
    ctx.strokeStyle = "rgba(255,255,255,0.32)"; ctx.lineWidth = 1.4;
    tube(ctx, { x: start.x - 1, y: start.y - 1 }, { x: middle.x - 1, y: middle.y - 1 }, { x: end.x - 1, y: end.y - 1 });
    drawCreatureCap(ctx, style, end.x, end.y, c.angle, index);
    const metal = ctx.createLinearGradient(end.x - 4, end.y - 4, end.x + 4, end.y + 4);
    metal.addColorStop(0, "#ffffff"); metal.addColorStop(0.4, "#dce4eb"); metal.addColorStop(1, "#657181");
    ctx.fillStyle = metal; ctx.strokeStyle = "rgba(45,54,64,0.65)"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(end.x, end.y, 3.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (limb.attached) {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath(); ctx.arc(end.x - 1, end.y - 1, 1.2, 0, Math.PI * 2); ctx.fill();
      const age = c.grip?.age ?? 1;
      if (age < 0.3) {
        ctx.strokeStyle = `rgba(225,250,255,${(1 - age / 0.3) * 0.8})`; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(end.x, end.y, 4 + age * 28, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }
  if (style.id !== "human") {
    // Opaque body occludes limb roots. Magnetic centers are repainted above it
    // so tucked catches stay legible even with the larger silhouettes.
    drawBodyLocal(ctx, origin, c.angle, style);
    for (const [index, limb] of shape.limbs.entries()) {
      const end = project(limb.end, false);
      drawCreatureCap(ctx, style, end.x, end.y, c.angle, index);
      ctx.fillStyle = "#c6d5df"; ctx.strokeStyle = "#536778"; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.arc(end.x, end.y, 3.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(end.x - 1, end.y - 1, 1.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore(); return;
  }
  const shoulder = project(shape.shoulder, false), hip = project(shape.hip, false);
  ctx.strokeStyle = material; ctx.lineWidth = 8;
  tube(ctx, shoulder, hip, hip);
  const head = project(shape.head, false);
  const plastic = ctx.createRadialGradient(head.x - 3, head.y - 4, 0.5, head.x, head.y, 8);
  plastic.addColorStop(0, "#ffffff"); plastic.addColorStop(0.25, style.color); plastic.addColorStop(1, style.color);
  ctx.fillStyle = plastic;
  ctx.beginPath(); ctx.arc(head.x, head.y, 7.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
