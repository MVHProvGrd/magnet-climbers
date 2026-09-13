import type { NoStickKind, NoStickZone, PowerKind } from "./types";

export type ItemFamily = "pickup" | "paper" | "surface" | "bumper";
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
  ...papers,
  { id: "heart", name: "Little Lifeline", family: "pickup", power: "heart", description: "Restores one heart to the climber who collects it, up to three." },
  { id: "coin", name: "Pocket Change", family: "pickup", power: "coin", description: "Collect coins for upgrades. Chill mode doesn't award currency." },
  { id: "gem", name: "Ice Gem", family: "pickup", power: "gem", description: "Rare gem currency. Not awarded in Chill mode." },
  { id: "magnet", name: "Super Magnet", family: "pickup", power: "magnet", description: "Temporarily catch earlier and reach farther for real steel." },
  { id: "extra", name: "Pocket Pal", family: "pickup", power: "extra", description: "Adds another climber to your run." },
  { id: "slowmo", name: "Kitchen Timer", family: "pickup", power: "slowmo", description: "Temporarily slows the action." },
  { id: "reach", name: "Stretch Armstrong", family: "pickup", power: "reach", description: "Temporarily extends teammate reach." },
  { id: "dispenser", name: "Water Station", family: "surface", kind: "glass", description: "Slippery dispenser. Climb the steel beside it or its silver handle." },
  { id: "calendar", name: "Busy Month", family: "surface", kind: "sticker", description: "A big paper calendar. Follow the open steel side lane." },
  { id: "ice-tray", name: "Ice Cube Alley", family: "surface", kind: "trim", description: "Plastic ice tray: no grip. The exposed door around it is safe." },
  { id: "handle", name: "Silver Handle", family: "surface", kind: "void", metal: true, description: "A real metal hold over slippery panels. Hands and feet can catch here." },
  { id: "repel", name: "Wrong Pole", family: "surface", kind: "repel", description: "Pushes airborne climbers away. Watch the red magnetic field." },
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
