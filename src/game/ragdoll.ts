import type { Climber, Ragdoll, Vec } from "./types";

export const LIMB_ROOTS: readonly Vec[] = [
  { x: -2, y: -5 }, { x: 2, y: -5 }, { x: -2, y: 7 }, { x: 2, y: 7 },
];
const REST = [-2.35, -0.79, 2.08, 1.06];
const UPPER = [13, 13, 12, 12];
const LOWER = [13, 13, 14, 14];
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function cloneRagdoll(rag?: Ragdoll): Ragdoll | undefined {
  return rag ? { ...rag, limbs: rag.limbs.map((limb) => ({ ...limb })) } : undefined;
}

export function resetRagdoll(c: Climber) {
  c.ragdoll = {
    lastVx: c.vx, lastVy: c.vy,
    limbs: REST.map((angle, i) => ({ angle: angle + Math.sin(c.id * 2 + i) * 0.15,
      bend: (i % 2 ? -1 : 1) * 0.55, velocity: -c.spin * 0.7,
      bendVelocity: (i % 2 ? -1 : 1) * (1 + Math.abs(c.spin) * 0.3) })),
  };
}

/** Passive, bounded angular joints. Drag/inertia make limbs lag, tuck and unfold.
 * The torso keeps the existing ballistic arc, but these tips perform the catches.
 */
export function stepRagdoll(c: Climber, dt: number) {
  if (!c.ragdoll) resetRagdoll(c);
  const rag = c.ragdoll!;
  const cos = Math.cos(c.angle), sin = Math.sin(c.angle);
  const fx = -c.vx * 0.38 + (rag.lastVx - c.vx) * 2;
  const fy = -c.vy * 0.38 + (rag.lastVy - c.vy) * 2;
  const localFx = fx * cos + fy * sin, localFy = -fx * sin + fy * cos;
  const speed = Math.hypot(c.vx, c.vy);
  for (let i = 0; i < 4; i++) {
    const joint = rag.limbs[i], side = i % 2 ? -1 : 1;
    const bendTarget = side * (0.4 + Math.min(0.85, speed / 650));
    const torque = (Math.cos(joint.angle) * localFy - Math.sin(joint.angle) * localFx) * 0.055;
    joint.velocity += (torque - (joint.angle - REST[i]) * 13 - joint.velocity * 3.5 - c.spin * 3) * dt;
    joint.bendVelocity += ((bendTarget - joint.bend) * 21 + torque * 0.4 - joint.bendVelocity * 3.8) * dt;
    joint.velocity = clamp(joint.velocity, -10, 10);
    joint.bendVelocity = clamp(joint.bendVelocity, -12, 12);
    joint.angle += joint.velocity * dt; joint.bend += joint.bendVelocity * dt;
    const a = clamp(joint.angle, REST[i] - 1.25, REST[i] + 1.25);
    const b = clamp(joint.bend, -1.9, 1.9);
    if (a !== joint.angle) joint.velocity *= -0.18;
    if (b !== joint.bend) joint.bendVelocity *= -0.18;
    joint.angle = a; joint.bend = b;
  }
  rag.lastVx = c.vx; rag.lastVy = c.vy;
}

export function flightLimb(c: Climber, limb: number): { joint: Vec; tip: Vec } | null {
  const rag = c.ragdoll?.limbs[limb];
  if (!rag || c.state !== "flying") return null;
  const root = LIMB_ROOTS[limb];
  const joint = { x: root.x + Math.cos(rag.angle) * UPPER[limb], y: root.y + Math.sin(rag.angle) * UPPER[limb] };
  return { joint, tip: { x: joint.x + Math.cos(rag.angle + rag.bend) * LOWER[limb], y: joint.y + Math.sin(rag.angle + rag.bend) * LOWER[limb] } };
}

/** Two-bone elbow/knee for a planted tip. No stretching beyond the pin is drawn. */
export function plantedJoint(root: Vec, tip: Vec, limb: number): Vec {
  const dx = tip.x - root.x, dy = tip.y - root.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const length = Math.max((UPPER[limb] + LOWER[limb]) / 2, distance / 2 + 0.01);
  const height = Math.min(11, Math.sqrt(Math.max(0, length * length - distance * distance / 4)));
  const side = limb % 2 ? -1 : 1;
  return { x: (root.x + tip.x) / 2 - dy / distance * height * side,
    y: (root.y + tip.y) / 2 + dx / distance * height * side };
}
