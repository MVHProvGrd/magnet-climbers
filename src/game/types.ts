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
  kind: NoStickKind;
  /** sticker colour / photo hue */
  hue?: number;
}

export type PowerKind = "coin" | "magnet" | "extra" | "slowmo" | "reach" | "gem";

export interface PowerUp extends Vec {
  kind: PowerKind;
  taken: boolean;
  bob: number;
}

export interface Bumper {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  minX: number;
  maxX: number;
  label: string;
  hue: number;
}

export interface Segment {
  /** top of segment (smaller y = higher up the fridge) */
  y: number;
  h: number;
  zones: NoStickZone[];
  powerUps: PowerUp[];
  bumpers: Bumper[];
}

export type ClimberState = "stuck" | "flying" | "linked" | "lost";

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
}

export interface ActiveEffects {
  superMagnet: number;
  slowmo: number;
  reach: number;
}
