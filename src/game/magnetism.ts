import { CFG } from "./config";
import type { Climber, LimbId, MagneticContact, MagneticGrip, Vec } from "./types";
import type { World } from "./world";

/** Shared by collision and drawing: changing the art cannot move a magnetic tip. */
export const LIMB_TIPS: readonly Vec[] = [
  { x: -21, y: -20 }, { x: 21, y: -20 },
  { x: -15, y: 21 }, { x: 15, y: 21 },
];

export function rotate(p: Vec, angle: number): Vec {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

export function limbTip(c: Climber, limb: number): Vec {
  const pinned = c.grip?.contacts.find((p) => p.limb === limb);
  if (pinned && c.state === "stuck") return pinned;
  const p = rotate(LIMB_TIPS[limb], c.angle);
  return { x: c.x + p.x, y: c.y + p.y };
}

export function cloneGrip(grip?: MagneticGrip): MagneticGrip | undefined {
  return grip ? { ...grip, contacts: grip.contacts.map((p) => ({ ...p })) } : undefined;
}

/** Each tip searches for real steel; magnet upgrades extend reach, not the surface. */
export function findContacts(c: Climber, world: World, radius: number): MagneticContact[] {
  return LIMB_TIPS.flatMap((_, limb) => {
    const tip = limbTip(c, limb);
    const metal = world.nearestMetal(tip.x, tip.y, radius);
    return metal ? [{ ...metal, limb: limb as LimbId }] : [];
  });
}

export function attachGrip(c: Climber, available: MagneticContact[], flat = false): boolean {
  if (!available.length) return false;
  // A low-spin landing splats flat. Otherwise the edge facing the motion lands first.
  // Only real available tips participate, so narrow ledges can produce one-hand catches.
  const speed = Math.hypot(c.vx, c.vy);
  const direction = speed > 15 ? { x: c.vx / speed, y: c.vy / speed } : { x: 0, y: 1 };
  const ordered = [...available].sort((a, b) => {
    const pa = rotate(LIMB_TIPS[a.limb], c.angle), pb = rotate(LIMB_TIPS[b.limb], c.angle);
    return (pb.x - pa.x) * direction.x + (pb.y - pa.y) * direction.y || a.limb - b.limb;
  });
  const leading = rotate(LIMB_TIPS[ordered[0].limb], c.angle);
  const maxDot = leading.x * direction.x + leading.y * direction.y;
  const contacts = flat || Math.abs(c.spin) < 1.8 ? ordered : ordered.filter((p) => {
    const offset = rotate(LIMB_TIPS[p.limb], c.angle);
    return maxDot - offset.x * direction.x - offset.y * direction.y < 12;
  });
  const hands = contacts.filter((p) => p.limb < 2).length;
  const pose = contacts.length === 4 ? "flat" : contacts.length === 1 ? "single"
    : hands === contacts.length ? "hands" : hands === 0 ? "feet" : "mixed";
  const pivot = contacts[0];
  const rx = c.x - pivot.x, ry = c.y - pivot.y;
  const angularVelocity = (rx * c.vy - ry * c.vx) / Math.max(1, rx * rx + ry * ry);
  c.grip = {
    contacts: contacts.map((p) => ({ ...p })), pose, age: 0,
    lift: pose === "flat" ? 2 : pose === "single" ? CFG.magnetism.singleLift : CFG.magnetism.standingLift,
    angularVelocity: Math.max(-CFG.magnetism.maxSwingSpeed, Math.min(CFG.magnetism.maxSwingSpeed, angularVelocity)),
  };
  // Snap the body by the primary tip displacement. Other limbs flex to their contacts.
  const offset = rotate(LIMB_TIPS[pivot.limb], c.angle);
  c.x = pivot.x - offset.x; c.y = pivot.y - offset.y;
  return true;
}

/** A single magnet is a pinned pendulum; multiple contacts brace the body in its landing pose. */
export function stepGrip(c: Climber, dt: number): void {
  const grip = c.grip;
  if (!grip) return;
  grip.age += dt;
  if (grip.contacts.length !== 1) return;
  const contact = grip.contacts[0];
  const local = LIMB_TIPS[contact.limb];
  const offset = rotate(local, c.angle);
  const radiusSquared = local.x * local.x + local.y * local.y;
  grip.angularVelocity += (-CFG.magnetism.swingGravity * offset.x / radiusSquared
    - CFG.magnetism.swingDamping * grip.angularVelocity) * dt;
  grip.angularVelocity = Math.max(-CFG.magnetism.maxSwingSpeed, Math.min(CFG.magnetism.maxSwingSpeed, grip.angularVelocity));
  c.angle += grip.angularVelocity * dt;
  const next = rotate(local, c.angle);
  c.x = contact.x - next.x; c.y = contact.y - next.y;
}

/** Apparent height off the door, in logical pixels. It never changes the flight arc. */
export function bodyLift(c: Climber): number {
  if (c.state === "flying") return 3 + Math.min(32, Math.sin(Math.min(1, c.airTime / 1.4) * Math.PI) * 32);
  if (c.state === "linked") return 10;
  const grip = c.grip;
  return grip ? grip.lift + Math.exp(-grip.age * 9) * Math.sin(grip.age * 24) * 3 : 2;
}
