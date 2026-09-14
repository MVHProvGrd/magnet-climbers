import type { NoStickKind, NoStickZone, PowerKind } from "./types";
import { PAPER_ADDITIONS, BUSINESS_MAGNETS } from "./fridge-art";

export type ItemFamily = "pickup" | "paper" | "surface" | "bumper" | "gadget";
export interface FridgeItem {
  id: string;
  name: string;
  family: ItemFamily;
  description: string;
  art?: number;
  kind?: NoStickKind;
  power?: PowerKind;
  metal?: boolean;
  label?: string;
  hue?: number;
  behavior?: "swing" | "rotor" | "clip" | "polarity";
  theme?: "snack" | "travel" | "doodle";
}

const paperNames = ["Slice of Life", "Cat Nap Club", "Higher Together", "Scenic Route", "Space Cadet", "Home Sweet Fridge", "Grow Your Own Way", "Stay Cool", "Snack List", "You Got This", "Don't Let Go", "More Magnets", "Donut Worry", "Avo Good Climb", "Tiny Dinosaur", "Rain Check", "Lucky Duck", "Sundae Summit", "Gone Fishing", "Beep Boop"];
const papers: FridgeItem[] = paperNames.map((name, art) => ({
  id: `paper-${art}`, name, family: "paper", art, kind: "sticker",
  description: "Paper isn't steel. Catch the bare door around this card.",
}));

/** Stable IDs are shared by world generation, artwork, and the player's field guide.
 * Cosmetic additions must never consume the gameplay RNG or change a collider.
 */
export const FRIDGE_ITEMS: readonly FridgeItem[] = [
  ...(["swing", "rotor", "clip", "polarity"] as const).flatMap((behavior, i) => (["snack", "travel", "doodle"] as const).map((theme, j): FridgeItem => ({
    id: `${behavior}-${theme}`, family: "gadget", behavior, theme,
    name: [["Donut Keyring", "Trail Keyring", "Star Keyring"], ["Alphabet A", "Alphabet B", "Alphabet C"], ["Snack Clip", "Postcard Clip", "Art Class Clip"], ["Candy Poles", "Compass Poles", "Crayon Poles"]][i][j],
    description: ["Swinging silver grip carries you. Fling from it to cross the panel.", "A rotating letter carries a silver grip around its face. Time your launch.", "A dangling clip carries you above the paper. Only its silver top grips.", "Blue steel holds for three seconds; red repels for three. The countdown warns before it releases you."][i],
  }))),
  ...papers,
  ...PAPER_ADDITIONS.map((name, i): FridgeItem => ({ id: `paper-new-${i}`, name, family: "paper", art: 100 + i, kind: "sticker", description: "Printed paper blocks magnetic catches. Aim for the exposed steel around its edges." })),
  ...BUSINESS_MAGNETS.map(([name, label], i): FridgeItem => ({ id: `business-${i}`, name, label, family: "bumper", art: 100 + i, hue: [195, 5, 110, 205, 15, 255, 40, 25][i], description: "A moving advertising magnet. Its path can be sideways, vertical or zigzag; contact knocks a climber loose and costs a heart." })),
  { id: "heart", name: "Little Lifeline", family: "pickup", power: "heart", description: "Restores one heart to the climber who collects it, up to three." },
  { id: "coin", name: "Pocket Change", family: "pickup", power: "coin", description: "Collect coins for upgrades. Chill mode doesn't award currency." },
  { id: "gem", name: "Ice Gem", family: "pickup", power: "gem", description: "Rare gem currency. Not awarded in Chill mode." },
  { id: "magnet", name: "Super Magnet", family: "pickup", power: "magnet", description: "Temporarily catch earlier and reach farther for real steel." },
  { id: "extra", name: "Pocket Pal", family: "pickup", power: "extra", description: "Adds another climber to your run." },
  { id: "slowmo", name: "Kitchen Timer", family: "pickup", power: "slowmo", description: "Temporarily slows the action." },
  { id: "reach", name: "Pocket Tape Measure", family: "pickup", power: "reach", description: "Unroll extra reach: temporarily stretches the distance you can climb to a teammate." },
  { id: "dispenser", name: "Water Station", family: "surface", kind: "glass", description: "Slippery dispenser. Climb the steel beside it or its silver handle." },
  { id: "calendar", name: "Busy Month", family: "surface", kind: "sticker", description: "A big paper calendar. Follow the open steel side lane." },
  { id: "ice-tray", name: "Ice Cube Alley", family: "surface", kind: "trim", description: "Plastic ice tray: no grip. The exposed door around it is safe." },
  { id: "handle", name: "Silver Handle", family: "surface", kind: "void", metal: true, description: "A real metal hold over slippery panels. Hands and feet can catch here." },
  { id: "repel", name: "N / Repelling Magnet", family: "surface", kind: "repel", description: "RED / N: pushes airborne climbers away. The field flows outward. Its face is not a safe hold." },
  { id: "attract", name: "S / Attracting Magnet", family: "surface", kind: "attract", metal: true, description: "BLUE / S: pulls airborne climbers toward it from a distance. Its steel face catches you. The aim preview bends with the pull." },
  { id: "glass", name: "Glass Panel", family: "surface", kind: "glass", description: "Glass blocks catches. Use steel at the sides or a silver handle across it." },
  { id: "plastic", name: "Plastic Trim", family: "surface", kind: "trim", description: "Plastic offers no magnetic hold. Cross in flight or use a metal island." },
  { id: "gap", name: "Door Gap", family: "surface", kind: "void", description: "Nothing to stick to here. Fling across or land on a metal handle." },
  { id: "vent", name: "Cold Air Vent", family: "surface", kind: "trim", description: "Non-magnetic plastic grille. Jump across or use the steel sides." },
  ...["DONUT", "DUCK", "ROBOT", "DINO", "POP!", "COOL"].map((label, i): FridgeItem => ({
    id: `bumper-${i}`, name: ["Rolling Donut", "Duck Dash", "Robot Patrol", "Dino Slide", "Pop Magnet", "Cool Cruiser"][i],
    family: "bumper", label, hue: [332, 45, 200, 125, 280, 175][i], art: [12, 16, 19, 14, 17, 7][i],
    description: "Moving magnet: knocks you loose, even from a planted grip. Time your fling.",
  })),
];
export const PAPER_ITEMS = FRIDGE_ITEMS.filter((item) => item.family === "paper");
export const BUMPER_ITEMS = FRIDGE_ITEMS.filter((item) => item.family === "bumper");
const byId = new Map(FRIDGE_ITEMS.map((item) => [item.id, item]));
export const fridgeItem = (id?: string) => id ? byId.get(id) : undefined;

export function itemZone(id: string, x: number, y: number, w: number, h: number): NoStickZone {
  const item = fridgeItem(id);
  if (!item?.kind) throw new Error(`Not a surface item: ${id}`);
  return { x, y, w, h, kind: item.kind, hue: item.metal ? -1 : undefined, itemId: id };
}
