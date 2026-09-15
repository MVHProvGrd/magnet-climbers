export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Areas a magnet cannot stick to. Drawn on top of the stainless surface. */
export type NoStickKind = "glass" | "trim" | "sticker" | "void" | "repel" | "attract";

export interface NoStickZone extends Rect {
  itemId?: string;
  kind: NoStickKind;
  /** sticker colour / photo hue */
  hue?: number;
  /** field magnets: strength multiplier (1 = the original plates); reach and push scale with it */
  power?: number;
  /** v13 toy keychains: hang still, swing when brushed (same pendulum as gadgets) */
  swing?: { angle: number; vel: number; cool: number };
}

export type PowerKind = "coin" | "magnet" | "extra" | "slowmo" | "reach" | "gem" | "heart" | "candy";

export interface PowerUp extends Vec {
  kind: PowerKind;
  taken: boolean;
  bob: number;
}

export type BumperMotion = "slide" | "lift" | "zigzag";

export interface Bumper {
  itemId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  minX: number;
  maxX: number;
  label: string;
  hue: number;
  /** slide = sideways, lift = up/down, zigzag = both at once (bounces off a box) */
  motion: BumperMotion;
  vy: number;
  minY: number;
  maxY: number;
}

export interface Segment {
  gadgets?: Gadget[];
  /** top of segment (smaller y = higher up the fridge) */
  y: number;
  h: number;
  zones: NoStickZone[];
  powerUps: PowerUp[];
  bumpers: Bumper[];
}

export type ClimberState = "stuck" | "flying" | "linked" | "lost";

export type LimbId = 0 | 1 | 2 | 3; // left hand, right hand, left foot, right foot
export interface MagneticContact extends Vec { limb: LimbId; carrierId?: string; carrierOffset?: Vec }
export interface Gadget extends Vec { id: string; itemId: string; kind: "swing" | "rotor" | "clip" | "polarity"; phase: number;
  /** v12 swings hang still and only move when a climber grabs, leaves or flies through them: a damped pendulum. */
  swing?: { angle: number; vel: number; cool: number } }
export interface MagneticGrip {
  contacts: MagneticContact[];
  pose: "flat" | "feet" | "hands" | "mixed" | "single";
  lift: number;
  age: number;
  angularVelocity: number;
  targetAngle?: number;
  pivotLocal?: Vec;
}

export interface LimbJoint {
  angle: number;
  bend: number;
  velocity: number;
  bendVelocity: number;
}
export interface Ragdoll {
  limbs: LimbJoint[];
  lastVx: number;
  lastVy: number;
}

export interface Climber {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  state: ClimberState;
  color: string;
  /** cosmetic body (see creatures.ts); renderers fall back to "toy" when missing or unknown */
  creature?: string;
  /** cosmetic colours/effects id; `color` is already resolved from it */
  pattern?: string;
  /** id of the climber this one is hanging on (linked state) */
  parent: number | null;
  /** linked and standing upright on the parent's shoulders (a stack), rather than hanging from a catch */
  locked?: boolean;
  /** distance from launcher must exceed reach before it can re-grab */
  leftLauncher: boolean;
  launcherId: number | null;
  airTime: number;
  squash: number;
  /** height off the fridge door (px, visual). Only a climber at z = 0 can be caught by steel. Optional for old saves. */
  z?: number;
  vz?: number;
  /** hit points; bumpers take one each, zero = lost */
  hp: number;
  /** seconds of invulnerability left after a hit */
  iframes: number;
  /** seconds during which the magnets will not catch (right after being knocked off) */
  noStick?: number;
  /** flight height this fling started from; a flier back below it has missed and is falling */
  launchY?: number;
  /** knocked off or fallen past its launch point: teammates may CATCH it */
  fell?: boolean;
  /** where the hands are held this frame when joined to a teammate: a stack's base reaches up to the feet above it, a hanger holds the feet of its catcher */
  handsAt?: Vec[];
  /** World-space magnetic tips. Optional so v1 saves remain readable. */
  grip?: MagneticGrip;
  ragdoll?: Ragdoll;
}

export interface ActiveEffects {
  superMagnet: number;
  slowmo: number;
  reach: number;
  /** candy drop: the kid stops for a sweet, the red line crawls */
  candy: number;
}
