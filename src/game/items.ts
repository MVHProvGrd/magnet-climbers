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
  /** Guide-only hazard card; never enters a spawn pool. */
  hazard?: true;
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
    name: [["Lemon Keyring", "Trail Keyring", "Star Keyring"], ["Alphabet A", "Alphabet B", "Alphabet C"], ["Snack Clip", "Postcard Clip", "Art Class Clip"], ["Candy Poles", "Compass Poles", "Crayon Poles"]][i][j],
    description: ["Swinging silver grip carries you. Fling from it to cross the panel.", "A rotating letter carries a silver grip around its face. Time your launch.", "A dangling clip carries you above the paper. Only its silver top grips.", "A pole-flipping toy: blue holds for three seconds, then red pushes for three. The countdown warns before it flips."][i],
  }))),
  ...papers,
  ...PAPER_ADDITIONS.map((name, i): FridgeItem => ({ id: `paper-new-${i}`, name, family: "paper", art: 100 + i, kind: "sticker", description: "Printed paper blocks magnetic catches. Aim for the exposed steel around its edges." })),
  ...BUSINESS_MAGNETS.map(([name, label], i): FridgeItem => ({ id: `business-${i}`, name, label, family: "bumper", art: 100 + i, hue: [195, 5, 110, 205, 15, 255, 40, 25][i], description: "A moving advertising magnet. Its path can be sideways, vertical or zigzag; contact knocks a climber loose and costs a heart." })),
  { id: "heart", name: "Little Lifeline", family: "pickup", power: "heart", description: "Restores one heart to the climber who collects it, up to three." },
  { id: "coin", name: "Pocket Change", family: "pickup", power: "coin", description: "Coins feed the prize machine for new patterns. Chill mode doesn't award currency." },
  { id: "gem", name: "Ice Gem", family: "pickup", power: "gem", description: "Rare gem currency. Not awarded in Chill mode." },
  { id: "magnet", name: "Super Magnet", family: "pickup", power: "magnet", description: "Temporarily catch earlier, reach farther, and grip glass, plastic and paper as if they were steel." },
  { id: "extra", name: "Pocket Pal", family: "pickup", power: "extra", description: "Adds another climber to your run." },
  { id: "slowmo", name: "Kitchen Timer", family: "pickup", power: "slowmo", description: "Temporarily slows the action." },
  { id: "reach", name: "Reach Badge", family: "pickup", power: "reach", description: "Temporarily stretches the distance you can climb to a teammate." },
  { id: "candy", name: "Candy Drop", family: "pickup", power: "candy", description: "Cooper stops for a sweet: the red line crawls for a while." },
  { id: "dispenser", name: "Water Station", family: "surface", kind: "glass", description: "Slippery dispenser. Climb the steel beside it or its silver handle." },
  { id: "calendar", name: "Busy Month", family: "surface", kind: "sticker", description: "A big paper calendar. Follow the open steel side lane." },
  { id: "ice-tray", name: "Ice Cube Alley", family: "surface", kind: "trim", description: "Plastic ice tray: no grip. The exposed door around it is safe." },
  { id: "handle", name: "Silver Handle", family: "surface", kind: "void", metal: true, description: "A real metal hold over slippery panels. Hands and feet can catch here." },
  // every destination souvenir gets its own card; the plates in the game pick from these pools by position
  ...[["fiji", "Fiji (S)"], ["hawaii", "Hawaii (S)"], ["bali", "Bali (S)"], ["tahiti", "Tahiti (S)"], ["seychelles", "Seychelles (S)"], ["cape-town", "Cape Town (S)"], ["rio", "Rio (S)"]].map(([place, name]): FridgeItem => ({
    id: `attract-${place}`, name, family: "surface", kind: "attract", metal: true,
    description: "A fridge souvenir marked S. Its blue field pulls airborne climbers in from a distance and its face catches you. The aim dots turn blue where it bends your flight.",
  })),
  ...[["norway", "Norway (N)"], ["alaska", "Alaska (N)"], ["iceland", "Iceland (N)"], ["jurmala", "Jūrmala (N)"], ["kyiv", "Kyiv (N)"], ["edinburgh", "Edinburgh (N)"], ["lapland", "Lapland (N)"]].map(([place, name]): FridgeItem => ({
    id: `repel-${place}`, name, family: "surface", kind: "repel",
    description: "A fridge souvenir marked N. Its red field pushes airborne climbers away; the wider the arcs, the stronger the push. The big ones are slingshots.",
  })),
  { id: "glass", name: "Glass Panel", family: "surface", kind: "glass", description: "Glass blocks catches. Use steel at the sides or a silver handle across it." },
  { id: "plastic", name: "Plastic Trim", family: "surface", kind: "trim", description: "Plastic offers no magnetic hold. Cross in flight or use a metal island." },
  { id: "gap", name: "Door Gap", family: "surface", kind: "void", description: "Nothing to stick to here. Fling across or land on a metal handle." },
  { id: "seam", name: "Centre Seam", family: "surface", kind: "void", description: "The groove between the two doors runs the whole way up. No grip in it; cross it in flight." },
  { id: "vent", name: "Cold Air Vent", family: "surface", kind: "trim", description: "Non-magnetic plastic grille. Jump across or use the steel sides." },
  ...["DONUT", "DUCK", "ROBOT", "DINO", "POP!", "COOL"].map((label, i): FridgeItem => ({
    id: `bumper-${i}`, name: ["Rolling Donut", "Duck Dash", "Robot Patrol", "Dino Slide", "Pop Magnet", "Cool Cruiser"][i],
    family: "bumper", label, hue: [332, 45, 200, 125, 280, 175][i], art: [12, 16, 19, 14, 17, 7][i],
    description: "A toy. On a keychain it is plain resin and just swings when brushed; stuck straight on the door it is a magnet with a slight push. Never a grip.",
  })),
  { id: "kid-hand", name: "Cooper's Hand", family: "bumper", hazard: true, description: "A hand swipes across the door now and then. Watch for the LOOK OUT warning and get out of its curved path." },
  { id: "cat-paw", name: "The Cat's Paw", family: "bumper", hazard: true, description: "A paw drops in from the top and taps three times, the second one deepest. A ring warns where it will land; a hit knocks you loose and costs a heart." },
];
export const PAPER_ITEMS = FRIDGE_ITEMS.filter((item) => item.family === "paper");
/** Width/height of the photographed papers, so a v13 card takes the photo's shape instead of cropping it. */
export const PAPER_ASPECT: Record<string, number> = {
  "paper-0": 384 / 253, "paper-1": 253 / 384, "paper-2": 291 / 384, "paper-3": 384 / 282, "paper-4": 251 / 384, "paper-5": 365 / 384,
  "paper-6": 234 / 384, "paper-7": 383 / 384, "paper-8": 231 / 384, "paper-9": 1, "paper-10": 384 / 279, "paper-11": 316 / 384,
};
export const BUMPER_ITEMS = FRIDGE_ITEMS.filter((item) => item.family === "bumper" && !item.hazard);
const byId = new Map(FRIDGE_ITEMS.map((item) => [item.id, item]));
export const fridgeItem = (id?: string) => id ? byId.get(id) : undefined;

export function itemZone(id: string, x: number, y: number, w: number, h: number): NoStickZone {
  const item = fridgeItem(id);
  if (!item?.kind) throw new Error(`Not a surface item: ${id}`);
  return { x, y, w, h, kind: item.kind, hue: item.metal ? -1 : undefined, itemId: id };
}
