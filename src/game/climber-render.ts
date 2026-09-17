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

// The shadow is one flat shape. Painted limb by limb at a fifth of full opacity, every
// place two strokes crossed (each joint, the body under the arms) came out twice as dark,
// and the shadow grew joints of its own. So it is drawn solid onto a scratch canvas and laid
// down once, at the shadow's opacity, and the overlaps vanish into it. Only the toy's own
// patch of the scratch is cleared and copied, so a full crew costs no more than before.
let scratch: HTMLCanvasElement | null = null;
export function drawClimberShadow(ctx: CanvasRenderingContext2D, c: Climber, t = 0, appearance: CreatureAppearance = {}) {
  const shape = geometry(c, appearance);
  const style = creatureStyle(c, appearance);
  // higher toys get a softer, wider shadow
  const opacity = Math.max(0.05, 0.2 - shape.lift * 0.0035);
  const m = ctx.getTransform();
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  if (!scratch) scratch = document.createElement("canvas");
  if (scratch.width !== cw || scratch.height !== ch) { scratch.width = cw; scratch.height = ch; }
  const sc = scratch.getContext("2d")!;
  // the patch of screen this shadow can reach: the origin and every limb, with room for the body and the stroke
  const pts = [project({ x: c.x, y: c.y, z: shape.lift }, true)];
  for (const limb of shape.limbs) pts.push(project(limb.start, true), project(limb.middle, true), project(limb.end, true));
  if (style.id === "human") pts.push(project(shape.head, true), project(shape.shoulder, true), project(shape.hip, true));
  const scale = Math.hypot(m.a, m.b), pad = 44 * scale + 4;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    const d = m.transformPoint(p);
    x0 = Math.min(x0, d.x); y0 = Math.min(y0, d.y); x1 = Math.max(x1, d.x); y1 = Math.max(y1, d.y);
  }
  const bx = Math.max(0, Math.floor(x0 - pad)), by = Math.max(0, Math.floor(y0 - pad));
  const bw = Math.min(cw, Math.ceil(x1 + pad)) - bx, bh = Math.min(ch, Math.ceil(y1 + pad)) - by;
  if (bw <= 0 || bh <= 0) return;
  sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(bx, by, bw, bh);
  sc.setTransform(m);
  // No canvas shadowBlur here: a blur pass per climber per frame was the main cost with a full crew.
  // A wider stroke reads the same at game scale.
  sc.strokeStyle = sc.fillStyle = "#1f2530";
  sc.lineCap = "round"; sc.lineWidth = style.limb + 1 + shape.lift * 0.12;
  if (style.id !== "human") {
    const origin = project({ x: c.x, y: c.y, z: shape.lift }, true);
    sc.save(); sc.translate(origin.x, origin.y); sc.rotate(c.angle);
    drawCreatureDecorations(sc, c, style, t, true);
    drawCreatureBody(sc, style, "", true); sc.restore();
    for (const limb of shape.limbs) tube(sc, project(limb.start, true), project(limb.middle, true), project(limb.end, true));
  } else {
    for (const limb of shape.limbs) tube(sc, project(limb.start, true), project(limb.middle, true), project(limb.end, true));
    sc.lineWidth = 9;
    tube(sc, project(shape.shoulder, true), project(shape.hip, true), project(shape.hip, true));
    const head = project(shape.head, true);
    sc.beginPath(); sc.arc(head.x, head.y, 7, 0, Math.PI * 2); sc.fill();
  }
  sc.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = opacity;
  ctx.drawImage(scratch, bx, by, bw, bh, bx, by, bw, bh);
  ctx.restore();
}

/** Blend a hex colour toward another (0 = colour, 1 = target). Non-hex input passes through. */
function mix(hex: string, target: string, amount: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const a = parseInt(hex.slice(1), 16), b = parseInt(target.slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * amount).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

// Toy material gradients are cheap to cache: every one of them is built from a colour
// (the climber's or creature's skin tone) mixed toward fixed tints at fixed stops, so the
// same colour always produces the same gradient. The skin catalog (config.ts SKINS, plus
// the handful of built-in creature colours) is a small fixed list shipped with the game,
// never grown at runtime, so keying these caches by colour string stays bounded for the
// life of the process instead of growing with how long a run lasts.
// The position-dependent ones (limb material, metal tips, the human head gloss) are built
// once in a small local coordinate space around the origin they light, the same trick
// drawBodyLocal already used for its gloss gradient; callers translate the canvas to that
// origin before painting so the cached gradient still lines up exactly, frame to frame.
const materialCache = new Map<string, CanvasGradient>();
const glossCache = new Map<string, CanvasGradient>();
const plasticCache = new Map<string, CanvasGradient>();
let metalTipGradient: CanvasGradient | null = null;

/** Limb/torso tint, local to the climber's own origin (translate there before stroking with it). */
function materialGradient(ctx: CanvasRenderingContext2D, color: string): CanvasGradient {
  let g = materialCache.get(color);
  if (g) return g;
  g = ctx.createLinearGradient(-40, -40, 40, 40);
  g.addColorStop(0, mix(color, "#ffffff", 0.75)); g.addColorStop(0.3, color);
  g.addColorStop(0.78, color); g.addColorStop(1, mix(color, "#2a3038", 0.55));
  materialCache.set(color, g);
  return g;
}

/** Body gloss, local to the creature's rotated origin (see drawBodyLocal). */
function glossGradient(ctx: CanvasRenderingContext2D, color: string): CanvasGradient {
  let g = glossCache.get(color);
  if (g) return g;
  g = ctx.createLinearGradient(-20, -26, 20, 16);
  g.addColorStop(0, mix(color, "#ffffff", 0.7)); g.addColorStop(0.18, color);
  g.addColorStop(0.85, color); g.addColorStop(1, mix(color, "#2a3038", 0.55));
  glossCache.set(color, g);
  return g;
}

/** Human head plastic, local to the head (translate there, no rotate: the highlight stays screen-fixed). */
function plasticGradient(ctx: CanvasRenderingContext2D, color: string): CanvasGradient {
  let g = plasticCache.get(color);
  if (g) return g;
  g = ctx.createRadialGradient(-3, -4, 0.5, 0, 0, 8);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.25, color); g.addColorStop(1, color);
  plasticCache.set(color, g);
  return g;
}

/** Limb-tip ball socket: same silvery metal for every climber, so one gradient ever exists. */
function metalGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (metalTipGradient) return metalTipGradient;
  const g = ctx.createLinearGradient(-4, -4, 4, 4);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, "#dce4eb"); g.addColorStop(1, "#657181");
  metalTipGradient = g;
  return g;
}

/** Creature body in body-local space; the gloss gradient is cached there too so it lines up after the rotate. */
function drawBodyLocal(ctx: CanvasRenderingContext2D, origin: Vec, angle: number, style: ReturnType<typeof creatureStyle>, part: "all" | "torso" | "head" = "all") {
  ctx.save(); ctx.translate(origin.x, origin.y); ctx.rotate(angle);
  drawCreatureBody(ctx, style, glossGradient(ctx, style.color), false, part);
  ctx.restore();
}

/** Flexible toy geometry, metallic tips, and a common window light in world coordinates. */
/** `selected` is kept in the signature for callers; selection is shown by the HUD
 *  team dots and the aim line, not by a ring drawn around the climber. */
export function drawClimber(ctx: CanvasRenderingContext2D, c: Climber, _selected: boolean, t: number, appearance: CreatureAppearance = {}) {
  const shape = geometry(c, appearance);
  const style = creatureStyle(c, appearance);
  ctx.save();
  // limbs can reach well past the body; the ends are tints of the toy's own colour so a far limb never clamps to white or grey
  const material = materialGradient(ctx, style.color);
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
    // material is built in a small space local to the climber's own origin; translating
    // here (a pure offset, no rotate/scale) keeps the stroked path in exactly the same
    // place a fresh, climber-position-centred gradient would have put it.
    ctx.save(); ctx.translate(c.x, c.y);
    tube(ctx, { x: start.x - c.x, y: start.y - c.y }, { x: middle.x - c.x, y: middle.y - c.y }, { x: end.x - c.x, y: end.y - c.y });
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.32)"; ctx.lineWidth = 1.4;
    tube(ctx, { x: start.x - 1, y: start.y - 1 }, { x: middle.x - 1, y: middle.y - 1 }, { x: end.x - 1, y: end.y - 1 });
    drawCreatureCap(ctx, style, end.x, end.y, c.angle, index);
    ctx.fillStyle = metalGradient(ctx); ctx.strokeStyle = "rgba(45,54,64,0.65)"; ctx.lineWidth = 0.8;
    ctx.save(); ctx.translate(end.x, end.y);
    ctx.beginPath(); ctx.arc(0, 0, 3.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
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
  ctx.save(); ctx.translate(c.x, c.y);
  tube(ctx, { x: shoulder.x - c.x, y: shoulder.y - c.y }, { x: hip.x - c.x, y: hip.y - c.y }, { x: hip.x - c.x, y: hip.y - c.y });
  ctx.restore();
  const head = project(shape.head, false);
  ctx.save(); ctx.translate(head.x, head.y);
  ctx.fillStyle = plasticGradient(ctx, style.color);
  ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // a face, like the creatures have: two eyes and a smile, turning with the body
  ctx.save(); ctx.translate(head.x, head.y); ctx.rotate(c.angle);
  for (const side of [-1, 1]) {
    ctx.fillStyle = "#f7fff3"; ctx.beginPath(); ctx.ellipse(side * 2.6, -1, 1.9, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#253748"; ctx.beginPath(); ctx.ellipse(side * 2.6 + 0.4, -1, 0.9, 1.3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = "#34464e"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-2.2, 2.6); ctx.quadraticCurveTo(0, 4.2, 2.2, 2.6); ctx.stroke();
  ctx.restore();
  ctx.restore();
}
