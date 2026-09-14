import { CFG } from "./config";
import type { Climber, LimbId, MagneticContact, MagneticGrip, Vec } from "./types";
import type { World } from "./world";
import { flightLimb } from "./ragdoll";

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
  let local = flightLimb(c, limb)?.tip ?? LIMB_TIPS[limb];
  if (c.state === "stuck" && c.grip?.pose === "feet" && limb < 2) {
    local = { x: limb === 0 ? -15 : 15, y: 4 };
  }
  const p = rotate(local, c.angle);
  return { x: c.x + p.x, y: c.y + p.y };
}

export function cloneGrip(grip?: MagneticGrip): MagneticGrip | undefined {
  if (!grip) return undefined;
  const copy = { ...grip, contacts: grip.contacts.map((p) => ({ ...p, ...(p.carrierOffset ? { carrierOffset: { ...p.carrierOffset } } : {}) })) };
  if (grip.pivotLocal) copy.pivotLocal = { ...grip.pivotLocal };
  return copy;
}

/** Each tip searches for real steel; magnet upgrades extend reach, not the surface. */
export function findContacts(c: Climber, world: World, radius: number): MagneticContact[] {
  return LIMB_TIPS.flatMap((_, limb) => {
    const tip = limbTip(c, limb);
    const metal = world.nearestMetal(tip.x, tip.y, radius);
    return metal ? [{ ...metal, limb: limb as LimbId, ...world.carrierAt(metal) }] : [];
  });
}

export function attachGrip(c: Climber, available: MagneticContact[], flat = false): boolean {
  if (!available.length) return false;
  // A low-spin landing splats flat. Otherwise the edge facing the motion lands first.
  // Only real available tips participate, so narrow ledges can produce one-hand catches.
  const speed = Math.hypot(c.vx, c.vy);
  const offsetFor = (limb: number) => rotate(flightLimb(c, limb)?.tip ?? LIMB_TIPS[limb], c.angle);
  const direction = speed > 15 ? { x: c.vx / speed, y: c.vy / speed } : { x: 0, y: 1 };
  const ordered = [...available].sort((a, b) => {
    const pa = offsetFor(a.limb), pb = offsetFor(b.limb);
    return (pb.x - pa.x) * direction.x + (pb.y - pa.y) * direction.y || a.limb - b.limb;
  });
  const leading = offsetFor(ordered[0].limb);
  const maxDot = leading.x * direction.x + leading.y * direction.y;
  const contacts = flat || Math.abs(c.spin) < 1.8 ? ordered : ordered.filter((p) => {
    const offset = offsetFor(p.limb);
    return maxDot - offset.x * direction.x - offset.y * direction.y < 12;
  });
  const hands = contacts.filter((p) => p.limb < 2).length;
  const pose = contacts.length === 4 ? "flat" : contacts.length === 1 ? "single"
    : hands === contacts.length ? "hands" : hands === 0 ? "feet" : "mixed";
  const pivot = contacts[0];
  const pivotLocal = flightLimb(c, pivot.limb)?.tip ?? LIMB_TIPS[pivot.limb];
  const rx = c.x - pivot.x, ry = c.y - pivot.y;
  const angularVelocity = (rx * c.vy - ry * c.vx) / Math.max(1, rx * rx + ry * ry);
  c.grip = {
    contacts: contacts.map((p) => ({ ...p })), pose, age: 0, pivotLocal: { ...pivotLocal },
    lift: pose === "flat" ? 2 : pose === "single" ? CFG.magnetism.singleLift : CFG.magnetism.standingLift,
    angularVelocity: Math.max(-CFG.magnetism.maxSwingSpeed, Math.min(CFG.magnetism.maxSwingSpeed, angularVelocity)),
  };
  // Snap the body by the primary tip displacement. Other limbs flex to their contacts.
  const offset = rotate(pivotLocal, c.angle);
  c.x = pivot.x - offset.x; c.y = pivot.y - offset.y;
  return true;
}

/** After a catch, limbs relax toward their rest spread wherever there is steel to plant on.
 * The body stays where the primary tip pinned it; only tucked limbs unfold. Edge catches with
 * no steel under the rest position keep their tucked contact, so one-hand saves still read.
 */
export function settleGrip(c: Climber, world: World): void {
  const grip = c.grip;
  if (!grip || grip.contacts.length < 2) return;
  for (const contact of grip.contacts) {
    if (contact.carrierId) continue;
    const rest = rotate(LIMB_TIPS[contact.limb], c.angle);
    const metal = world.nearestMetal(c.x + rest.x, c.y + rest.y, 4);
    if (!metal || world.carrierAt(metal).carrierId) continue;
    contact.x = metal.x; contact.y = metal.y;
    if (grip.contacts[0] === contact) grip.pivotLocal = { ...LIMB_TIPS[contact.limb] };
  }
}

/** Catch with the actual flying tips first, then brace an obvious upright stance
 * only when both desired magnets have real steel within a small settling reach.
 */
export function braceLanding(c: Climber, world: World): boolean {
  const angle = Math.atan2(Math.sin(c.angle), Math.cos(c.angle));
  const upsideDown = Math.abs(angle) > Math.PI * 0.66;
  const target = upsideDown ? (angle < 0 ? -Math.PI : Math.PI) : 0;
  if (Math.abs(target - angle) > 1.15 || !world.isMetal(c.x, c.y)) return false;
  const limbs = upsideDown ? [0, 1] : [2, 3];
  const contacts: MagneticContact[] = [];
  for (const limb of limbs) {
    const p = rotate(LIMB_TIPS[limb], target);
    const metal = world.nearestMetal(c.x + p.x, c.y + p.y, 3);
    if (!metal) return false;
    contacts.push({ ...metal, limb: limb as LimbId, ...world.carrierAt(metal) });
  }
  c.grip = { contacts, pose: upsideDown ? "hands" : "feet", lift: CFG.magnetism.standingLift,
    age: 0, angularVelocity: c.spin * 0.2,
    targetAngle: c.angle + (target - angle) };
  return true;
}

/** A single magnet is a pinned pendulum; multiple contacts brace the body in its landing pose. */
export function stepGrip(c: Climber, dt: number): void {
  const grip = c.grip;
  if (!grip) return;
  grip.age += dt;
  if (grip.contacts.length !== 1) {
    if (grip.targetAngle != null) {
      grip.angularVelocity += ((grip.targetAngle - c.angle) * CFG.magnetism.uprightSpring
        - grip.angularVelocity * CFG.magnetism.uprightDamping) * dt;
      c.angle += grip.angularVelocity * dt;
    }
    return;
  }
  const contact = grip.contacts[0];
  const local = grip.pivotLocal ?? LIMB_TIPS[contact.limb];
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
  // real height off the door when the sim tracks it; the old airtime curve for older saves
  if (c.state === "flying") return c.z != null ? 3 + Math.min(40, c.z * 0.45) : 3 + Math.min(32, Math.sin(Math.min(1, c.airTime / 1.4) * Math.PI) * 32);
  if (c.state === "linked") return 10;
  const grip = c.grip;
  return grip ? grip.lift + Math.exp(-grip.age * 9) * Math.sin(grip.age * 24) * 3 : 2;
}
