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
export type NoStickKind = "glass" | "trim" | "sticker" | "void" | "repel";

export interface NoStickZone extends Rect {
  itemId?: string;
  kind: NoStickKind;
  /** sticker colour / photo hue */
  hue?: number;
}

export type PowerKind = "coin" | "magnet" | "extra" | "slowmo" | "reach" | "gem" | "heart";

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
export interface Gadget extends Vec { id: string; itemId: string; kind: "swing" | "rotor" | "clip" | "polarity"; phase: number }
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
  /** id of the climber this one is hanging on (linked state) */
  parent: number | null;
  /** distance from launcher must exceed reach before it can re-grab */
  leftLauncher: boolean;
  launcherId: number | null;
  airTime: number;
  squash: number;
  /** hit points; bumpers take one each, zero = lost */
  hp: number;
  /** seconds of invulnerability left after a hit */
  iframes: number;
  /** seconds during which the magnets will not catch (right after being knocked off) */
  noStick?: number;
  /** World-space magnetic tips. Optional so v1 saves remain readable. */
  grip?: MagneticGrip;
  ragdoll?: Ragdoll;
}

export interface ActiveEffects {
  superMagnet: number;
  slowmo: number;
  reach: number;
}
