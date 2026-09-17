/** Logical canvas width. Height scales with the device aspect ratio. */
export const W = 400;

/**
 * The upgrade shop. The crew-only upgrades (team size, arm reach, chain length, spare tokens)
 * left with the crew code; what a lone climber can feel is what is on the shelf.
 */
export const SHOP_ENABLED = true;
export const CFG = {
  gravity: 950,
  maxDrag: 130,
  /** launch speed per px of drag. 5.3 → max vertical jump ≈ 250px; the widest gaps need ladders */
  launchScale: 5.3,
  minDrag: 14,
  /** how far above a teammate a stacked climber stands (px); the fling gain of a 2-stack */
  stackHeight: 56,
  /** a flier this close to a teammate's centre lands on its shoulders */
  stackSnap: 44,
  /** climbers standing on each other, base included */
  stackMax: 3,
  /** px/s a climber crawls over teammates when a ladder bridges a gap */
  crawlSpeed: 240,
  segmentH: 340,
  climberRadius: 18,
  /** floor (danger line) speed in px/s at height 0 and growth per 1000px climbed */
  floorBase: 22,
  /** stepped ramp: +15% per 50cm, capped at 5x base (about two thirds of a clean climbing pace) */
  floorStepCm: 50,
  floorStepMult: 0.15,
  floorCapMult: 5,
  /** catch-up: if the lowest climber is more than this many px above the wall, the wall hurries */
  floorCatchupGap: 500,
  floorCatchupMult: 2.2,
  /** time creep: +2% per 10 s of running time on top of the height ramp (dithering costs), capped at 2x */
  floorCreepPer10s: 0.02,
  floorCreepCap: 2,
  /** ceiling on the ramp × creep × catch-up product itself, not just each factor: without this a
   *  climber who is both high up and far ahead can meet all three multipliers at once (~11x) rather
   *  than one escalation at a time. Comfortably above floorCapMult alone so the catch-up nudge still bites. */
  floorMultCap: 6,
  floorStartOffset: 320,
  powerRadius: 36,
  bumperKnock: 420,
  /** hit points per climber and the grace period after a hit */
  maxHp: 3,
  /** HUD danger state: red-line distance in cm at or below which the dock goes red (handoff 1e) */
  dangerCm: 15,
  hitIframes: 0.9,
  /** kid hand swipes: first one after this many seconds of running, then every base..base/2 s as height grows */
  handFirstAfter: 18,
  handIntervalBase: 22,
  handIntervalMin: 9,
  handWarn: 1.1,
  /** rare double attack: Cooper and the cat come at the same climber at once (world v13+) */
  comboChance: 0.07,
  handShove: 560,
  /** How long an attack holds you off the steel. Shared, so the cat and the kid cost the
   *  same ground: the paw drives you down, the hand sideways, but neither is the harder hit. */
  attackNoStick: 0.45,
  effectDurations: { superMagnet: 8, slowmo: 6, reach: 14, candy: 9 },
  /** Picking one up while it is already running adds its time instead of replacing
   *  it, up to this ceiling — so a lucky double is worth having without parking
   *  the red line (or the rest of the threat) for the best part of a minute. */
  effectCaps: { superMagnet: 16, slowmo: 12, reach: 28, candy: 18 },
  /** red line speed while a candy drop is active */
  candySlow: 0.3,
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
    /** How far inside a glass, plastic or paper panel counts as "on the panel": a toy that comes
     *  down this far past its rim lands there and slides, instead of being pulled to an edge
     *  its magnets cannot feel through the panel. */
    panelInset: 12,
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
  "#2fd4c2", // teal
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
  /** does this change anything for a lone climber? Crew-only upgrades are not sold today. */
  solo: boolean;
  /** what one click buys, for the button: the player should never have to guess. */
  gain?: string;
}

export type UpgradeKey =
  | "magnet"
  | "power"
  | "floor";

export const UPGRADES: UpgradeDef[] = [
  { key: "magnet", name: "Magnet strength", desc: "Grabs steel from further out", max: 6, baseCost: 40, costGrowth: 1.7, solo: false },
  { key: "power", name: "Higher jump", desc: "Pull back and every sling throws you further up the door.", max: 3, baseCost: 50, costGrowth: 1.8, solo: true, gain: "+9% jump" },
  { key: "floor", name: "Sticky floor", desc: "The red line creeping up behind you climbs slower.", max: 3, baseCost: 70, costGrowth: 1.9, solo: true, gain: "-9% line" },
];

export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
}

/** Derived run stats from upgrade levels. */
export function statsFor(levels: Record<UpgradeKey, number>) {
  return {
    /** px the climber may be outside metal and still snap (4 → 16 at max; more grabbed across gaps) */
    magnetRadius: 4 + levels.magnet * 2,
    /** max upward velocity at which the magnet can still catch (px/s). Kept well under fling speed so
     *  a maxed magnet never kills a fling on the way up: 40 → 100 at max (was 370). */
    magnetCatch: 40 + levels.magnet * 10,
    reach: 70,
    maxLinks: 1,
    launchMult: 1 + levels.power * 0.09,
    floorMult: 1 - levels.floor * 0.09,
    /**
     * One second chance in every run, given rather than sold. The game-over card offers them
     * in the order they cost: this first and free, then the ad, then gems. It is deliberately
     * not read from `levels` -- the tier you could buy three of is gone, and a kit that lasts
     * one climb has no business changing how many lives that climb gets.
     */
    revives: 1,
  };
}


export interface SkinDef { key: string; name: string; cost: number; colors: string[] }
export const SKINS: SkinDef[] = [
  { key: "classic", name: "Classic", cost: 0, colors: CLIMBER_COLORS },
  { key: "glow", name: "Glow in the dark", cost: 250, colors: ["#c8ff5a", "#9bff8a", "#e6ffb0", "#7cf0c8", "#d4ff3d", "#b8ffe0"] },
  { key: "candy", name: "Candy", cost: 400, colors: ["#ff9ad5", "#ffd1a1", "#a1e3ff", "#d3a1ff", "#a1ffb8", "#fff3a1"] },
  { key: "stealth", name: "Stealth", cost: 600, colors: ["#3a3f47", "#5b6470", "#8a94a1", "#2c3036", "#b0b8c2", "#6f7986"] },
];
