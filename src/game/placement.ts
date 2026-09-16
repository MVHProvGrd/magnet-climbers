/**
 * Placement rules: how big a thing is drawn on the fridge, which door it may sit
 * on, and how often the generator puts one there.
 *
 * These used to be numbers buried in world generation, which is how a door bin
 * ended up sized to whatever zone happened to carry it and repeated up the door.
 * They live here so the admin workbench at /placement/ can show a real fridge,
 * let the owner drag the numbers, and hand back a JSON blob to paste in.
 *
 * The sim reads these at generation time, so a change only affects new runs.
 */

/** Where a thing is allowed to sit across the two doors. */
export type DoorRule = "left" | "right" | "either" | "span";

export interface PlacementRule {
  /** shown in the workbench */
  label: string;
  /** chance a segment that could carry one actually gets one, 0..1 */
  rate: number;
  /** most per segment, counting both doors */
  max: number;
  /** which door it may occupy */
  door: DoorRule;
  /** on-fridge size. "door" = as wide as the door it sits on, keeping the art's
   *  own proportions. A number pair is an explicit size in game pixels. */
  size: "door" | "auto" | { w: number; h: number };
  /** smallest zone that may carry one, in game pixels */
  minZone?: { w: number; h: number };
}

export type PlacementRules = Record<string, PlacementRule>;

/** Shipped defaults. The workbench edits a copy of this. */
export const DEFAULT_PLACEMENT: PlacementRules = {
  bin: {
    label: "Door bin (plastic)",
    rate: 0.6,
    max: 1,
    door: "either",
    size: "door",
    minZone: { w: 80, h: 58 },
  },
  tray: {
    label: "Ice tray",
    rate: 1,
    max: 1,
    door: "either",
    // the photo is 340x170 and stands on end, so half as wide as it is tall
    size: { w: 170, h: 340 },
  },
  toy: {
    label: "Toy magnets",
    rate: 0.3,
    max: 2,
    door: "either",
    size: "auto",
  },
  paper: {
    label: "Paper cards",
    rate: 1,
    max: 5,
    door: "either",
    size: "auto",
  },
};

const KEY = "mc-placement";
let active: PlacementRules = DEFAULT_PLACEMENT;

/** Merge a workbench override on top of the defaults. Unknown keys are ignored,
 *  so an old blob keeps working after a rule is added. */
export function applyPlacement(over: Partial<PlacementRules> | null | undefined): PlacementRules {
  active = !over ? DEFAULT_PLACEMENT : Object.fromEntries(
    Object.entries(DEFAULT_PLACEMENT).map(([k, base]) => [k, { ...base, ...(over[k] ?? {}) }]),
  ) as PlacementRules;
  return active;
}

/** Read the saved override once at boot. Never throws in private mode. */
export function loadPlacement(): PlacementRules {
  try {
    const raw = localStorage.getItem(KEY);
    return applyPlacement(raw ? (JSON.parse(raw) as Partial<PlacementRules>) : null);
  } catch { return applyPlacement(null); }
}

export function savePlacement(rules: PlacementRules): void {
  try { localStorage.setItem(KEY, JSON.stringify(rules)); } catch { /* private mode */ }
}

export function clearPlacement(): void {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
  applyPlacement(null);
}

/** The rules the sim is currently generating with. */
export const placement = (): PlacementRules => active;
export const rule = (key: string): PlacementRule => active[key] ?? DEFAULT_PLACEMENT[key];
