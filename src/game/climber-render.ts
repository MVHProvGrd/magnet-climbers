import { bodyLift, limbTip, rotate } from "./magnetism";
import type { Climber, Vec } from "./types";

interface Point extends Vec { z: number }

function geometry(c: Climber) {
  const lift = bodyLift(c);
  const bodyPoint = (x: number, y: number, z = lift): Point => {
    const p = rotate({ x, y }, c.angle);
    return { x: c.x + p.x, y: c.y + p.y, z };
  };
  const shoulder = bodyPoint(0, -5), hip = bodyPoint(0, 7), head = bodyPoint(0, -14, lift + 2);
  const limbs = [0, 1, 2, 3].map((limb) => {
    const tip = limbTip(c, limb);
    const attached = c.state === "stuck" && c.grip?.contacts.some((p) => p.limb === limb);
    const end: Point = { ...tip, z: attached ? 0 : lift + 3 };
    const start = limb < 2 ? shoulder : hip;
    // Curved rubber tube; contact endpoints stay fixed even during the landing wobble.
    const bend = rotate({ x: limb % 2 === 0 ? -4 : 4, y: limb < 2 ? 5 : -2 }, c.angle);
    const middle: Point = { x: (start.x + end.x) / 2 + bend.x, y: (start.y + end.y) / 2 + bend.y, z: (start.z + end.z) / 2 + 3 };
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
  ctx.quadraticCurveTo(middle.x, middle.y, end.x, end.y); ctx.stroke();
}

export function drawClimberShadow(ctx: CanvasRenderingContext2D, c: Climber) {
  const shape = geometry(c);
  ctx.save();
  const opacity = Math.max(0.07, 0.23 - shape.lift * 0.004);
  ctx.strokeStyle = ctx.fillStyle = `rgba(31,37,48,${opacity})`;
  ctx.shadowColor = `rgba(31,37,48,${opacity})`;
  ctx.shadowBlur = 1 + shape.lift * 0.22;
  ctx.lineCap = "round"; ctx.lineWidth = 7;
  for (const limb of shape.limbs) tube(ctx, project(limb.start, true), project(limb.middle, true), project(limb.end, true));
  ctx.lineWidth = 9;
  tube(ctx, project(shape.shoulder, true), project(shape.hip, true), project(shape.hip, true));
  const head = project(shape.head, true);
  ctx.beginPath(); ctx.arc(head.x, head.y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Flexible toy geometry, metallic tips, and a common window light in world coordinates. */
export function drawClimber(ctx: CanvasRenderingContext2D, c: Climber, selected: boolean, t: number) {
  const shape = geometry(c);
  ctx.save();
  if (selected) {
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]); ctx.lineDashOffset = -t * 24;
    ctx.beginPath(); ctx.arc(c.x, c.y, 33, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  const material = ctx.createLinearGradient(c.x - 25, c.y - 25, c.x + 25, c.y + 25);
  material.addColorStop(0, "#ffffff"); material.addColorStop(0.22, c.color);
  material.addColorStop(0.8, c.color); material.addColorStop(1, "#47505c");
  ctx.lineCap = "round";
  for (const limb of shape.limbs) {
    const start = project(limb.start, false), middle = project(limb.middle, false), end = project(limb.end, false);
    ctx.strokeStyle = "rgba(45,37,42,0.32)"; ctx.lineWidth = 7.5;
    tube(ctx, start, middle, end);
    ctx.strokeStyle = material; ctx.lineWidth = 6;
    tube(ctx, start, middle, end);
    ctx.strokeStyle = "rgba(255,255,255,0.32)"; ctx.lineWidth = 1.4;
    tube(ctx, { x: start.x - 1, y: start.y - 1 }, { x: middle.x - 1, y: middle.y - 1 }, { x: end.x - 1, y: end.y - 1 });
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
  const shoulder = project(shape.shoulder, false), hip = project(shape.hip, false);
  ctx.strokeStyle = material; ctx.lineWidth = 8;
  tube(ctx, shoulder, hip, hip);
  const head = project(shape.head, false);
  const plastic = ctx.createRadialGradient(head.x - 3, head.y - 4, 0.5, head.x, head.y, 8);
  plastic.addColorStop(0, "#ffffff"); plastic.addColorStop(0.25, c.color); plastic.addColorStop(1, c.color);
  ctx.fillStyle = plastic;
  ctx.beginPath(); ctx.arc(head.x, head.y, 7.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
