/** Logical canvas width. Height scales with the device aspect ratio. */
export const W = 400;

export const CFG = {
  gravity: 950,
  maxDrag: 130,
  /** launch speed per px of drag. 5.3 → max vertical jump ≈ 250px; the widest gaps need ladders */
  launchScale: 5.3,
  minDrag: 14,
  segmentH: 340,
  climberRadius: 18,
  /** floor (danger line) speed in px/s at height 0 and growth per 1000px climbed */
  floorBase: 22,
  /** stepped ramp: +15% per 50cm, capped at 2.5x base */
  floorStepCm: 50,
  floorStepMult: 0.15,
  floorCapMult: 3.5,
  /** catch-up: if the lowest climber is more than this many px above the wall, the wall hurries */
  floorCatchupGap: 900,
  floorCatchupMult: 2.2,
  floorStartOffset: 320,
  powerRadius: 30,
  bumperKnock: 420,
  /** hit points per climber and the grace period after a hit */
  maxHp: 3,
  hitIframes: 0.9,
  /** kid hand swipes: first one after this many seconds of running, then every base..base/2 s as height grows */
  handFirstAfter: 18,
  handIntervalBase: 22,
  handIntervalMin: 9,
  handWarn: 1.1,
  handShove: 560,
  effectDurations: { superMagnet: 8, slowmo: 6, reach: 14 },
  coinValue: 5,
  /** 10px of fridge = 1cm of score */
  pxPerCm: 10,
  /**
   * Off-the-door hop. A fling pops the toy away from the fridge in proportion to the pull; magnetism
   * pulls it back. Steel can only catch a toy that has come back down (z = 0), so the preview arc and
   * the real flight agree, and a long pull always clears a short obstacle.
   */
  hop: {
    /** z speed at a full pull (px/s); hang time = 2 * lift / zGravity ≈ 1.0 s at full pull */
    liftFull: 150,
    /** z speed at the shortest pull */
    liftMin: 40,
    /** pull back toward the door over steel (px/s²) at magnet level 0 */
    zGravity: 300,
    /** stronger magnets pull the toy back sooner: +6% per upgrade level */
    magnetPerLevel: 0.06,
    /** pull over glass, plastic and paper. Kept equal to steel: a weaker pull would make the toy touch
     *  down later on its way down, i.e. lower, which punishes crossing glass instead of rewarding it */
    offMetal: 1,
    /** extra pull inside a blue attract plate's field */
    attractPull: 900,
    /** SUPER MAGNET slams the toy back onto the door */
    superMagnet: 3,
  },
  magnetism: {
    attractionRange: 13,
    attractionAccel: 260,
    snapDistance: 4,
    swingGravity: 380,
    swingDamping: 5,
    maxSwingSpeed: 5,
    standingLift: 15,
    singleLift: 9,
    uprightSpring: 48,
    uprightDamping: 12,
  },
};

export const CLIMBER_COLORS = [
  "#ff8a3d", // orange
  "#ff5c8a", // pink
  "#ffd23f", // yellow
  "#4fc3f7", // blue
  "#9be15d", // green
  "#c77dff", // purple
  "#f4f4f4", // white
  "#ff4d4d", // red
];

/** Upgrade table for the meta-progression shop (soft currency). */
export interface UpgradeDef {
  key: UpgradeKey;
  name: string;
  desc: string;
  max: number;
  baseCost: number;
  costGrowth: number;
}

export type UpgradeKey =
  | "team"
  | "magnet"
  | "reach"
  | "links"
  | "power"
  | "floor"
  | "revive";

export const UPGRADES: UpgradeDef[] = [
  { key: "team", name: "Team size", desc: "+1 climber at the start of every run", max: 5, baseCost: 60, costGrowth: 1.9 },
  { key: "magnet", name: "Magnet strength", desc: "Pulls you back onto the door sooner, so you land nearer the top of your arc", max: 6, baseCost: 40, costGrowth: 1.7 },
  { key: "reach", name: "Arm reach", desc: "Grab teammates from further away", max: 6, baseCost: 45, costGrowth: 1.7 },
  { key: "links", name: "Chain length", desc: "More climbers can hang off one anchor", max: 4, baseCost: 80, costGrowth: 2.0 },
  { key: "power", name: "Slingshot power", desc: "Launch further", max: 5, baseCost: 50, costGrowth: 1.8 },
  { key: "floor", name: "Sticky floor", desc: "The danger line rises slower", max: 5, baseCost: 70, costGrowth: 1.9 },
  { key: "revive", name: "Spare tokens", desc: "+1 free revive per run", max: 3, baseCost: 150, costGrowth: 2.5 },
];

export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
}

/** Derived run stats from upgrade levels. */
export function statsFor(levels: Record<UpgradeKey, number>) {
  return {
    teamSize: 3 + levels.team,
    /** px the climber may be outside metal and still snap (4 → 16 at max; more grabbed across gaps) */
    magnetRadius: 4 + levels.magnet * 2,
    /** max upward velocity at which the magnet can still catch (px/s). Kept well under fling speed so
     *  a maxed magnet never kills a fling on the way up: 40 → 100 at max (was 370). */
    magnetCatch: 40 + levels.magnet * 10,
    reach: 70 + levels.reach * 9,
    maxLinks: 1 + levels.links,
    launchMult: 1 + levels.power * 0.09,
    floorMult: 1 - levels.floor * 0.09,
    revives: levels.revive,
  };
}

/** A consumable extra climber, dropped in mid-run from the HUD. */
export const RESERVE_COST = 35;

export interface SkinDef { key: string; name: string; cost: number; colors: string[] }
export const SKINS: SkinDef[] = [
  { key: "classic", name: "Classic", cost: 0, colors: CLIMBER_COLORS },
  { key: "glow", name: "Glow in the dark", cost: 250, colors: ["#c8ff5a", "#9bff8a", "#e6ffb0", "#7cf0c8", "#d4ff3d", "#b8ffe0"] },
  { key: "candy", name: "Candy", cost: 400, colors: ["#ff9ad5", "#ffd1a1", "#a1e3ff", "#d3a1ff", "#a1ffb8", "#fff3a1"] },
  { key: "stealth", name: "Stealth", cost: 600, colors: ["#3a3f47", "#5b6470", "#8a94a1", "#2c3036", "#b0b8c2", "#6f7986"] },
];
