import type { NoStickKind, NoStickZone, PowerKind } from "./types";
import { PAPER_ADDITIONS, BUSINESS_MAGNETS } from "./fridge-art";
import PAPER_SHAPES from "./data/paper-aspect.json";

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
  /** Holds a magnet without being a metal island: paper, pinned up by its own magnet. */
  grips?: boolean;
  label?: string;
  hue?: number;
  behavior?: "swing" | "rotor" | "clip" | "polarity";
  theme?: "snack" | "travel" | "doodle";
  /** Guide-only hazard card; never enters a spawn pool. */
  hazard?: true;
}

const paperNames = ["Slice of Life", "Cat Nap Club", "Higher Together", "Scenic Route", "Space Cadet", "Home Sweet Fridge", "Grow Your Own Way", "Stay Cool", "Snack List", "You Got This", "Don't Let Go", "More Magnets", "Donut Worry", "Avo Good Climb", "Tiny Dinosaur", "Rain Check", "Lucky Duck", "Sundae Summit", "Gone Fishing", "Beep Boop"];
const papers: FridgeItem[] = paperNames.map((name, art) => ({
  id: `paper-${art}`, name, family: "paper", art, kind: "sticker", grips: true,
  description: "Pinned up by its own magnet, so yours holds on it too. Climb straight over it.",
}));

/** Stable IDs are shared by world generation, artwork, and the player's field guide.
 * Cosmetic additions must never consume the gameplay RNG or change a collider.
 */
/** Photographed gadget assemblies beyond the three themed originals: id, behaviour, name. */
const GADGET_VARIANTS = [
  ["swing-keys", "swing", "House Keys"],
  ["swing-bottle-opener", "swing", "Bottle Opener"],
  ["swing-disco-ball", "swing", "Disco Ball"],
  ["swing-rubber-duck", "swing", "Rubber Duck"],
  ["swing-bead-lanyard", "swing", "Bead Lanyard"],
  ["swing-carabiner-whistle", "swing", "Carabiner and Whistle"],
  ["swing-wind-chime", "swing", "Wind Chime"],
  ["swing-baby-shoe", "swing", "Baby Shoe"],
  ["swing-scissors", "swing", "Kitchen Scissors"],
  ["swing-measuring-spoons", "swing", "Measuring Spoons"],
  ["swing-souvenir-spoon", "swing", "Souvenir Spoon"],
  ["swing-fishing-lure", "swing", "Fishing Lure"],
  ["rotor-clock", "rotor", "Kitchen Clock"],
  ["rotor-pinwheel", "rotor", "Paper Pinwheel"],
  ["rotor-thermometer", "rotor", "Dial Thermometer"],
  ["rotor-fidget-spinner", "rotor", "Fidget Spinner"],
  ["clip-concert-ticket", "clip", "Kitchen Sessions Ticket"],
  ["clip-report-card", "clip", "Report Card"],
  ["clip-takeout-receipt", "clip", "Takeaway Receipt"],
  ["clip-birthday-invite", "clip", "Birthday Invitation"],
  ["clip-lost-cat", "clip", "Lost Cat Poster"],
  ["clip-coupon-sheet", "clip", "Coupon Sheet"],
  ["clip-grandma-polaroid", "clip", "Grandma's Photo"],
] as const satisfies readonly (readonly [string, "swing" | "rotor" | "clip", string])[];

const TOY_LABELS = ["DONUT", "DUCK", "ROBOT", "DINO", "POP!", "COOL", "TAXI", "RACE", "BANANA", "SHUTTLE", "BLOCK", "BRICK", "GUMMY"] as const;
const TOY_NAMES = ["Rolling Donut", "Duck Dash", "Robot Patrol", "Dino Slide", "Pop Magnet", "Cool Cruiser",
  "Yellow Taxi", "Race Car", "Banana", "Space Shuttle", "Letter Block", "Plastic Brick", "Gummy Bear"] as const;

export const FRIDGE_ITEMS: readonly FridgeItem[] = [
  ...(["swing", "rotor", "clip", "polarity"] as const).flatMap((behavior, i) => (["snack", "travel", "doodle"] as const).map((theme, j): FridgeItem => ({
    id: `${behavior}-${theme}`, family: "gadget", behavior, theme,
    name: [["Lemon Keyring", "Trail Keyring", "Star Keyring"], ["Alphabet A", "Alphabet B", "Alphabet C"], ["Snack Clip", "Postcard Clip", "Art Class Clip"], ["Candy Poles", "Compass Poles", "Crayon Poles"]][i][j],
    description: ["Swinging silver grip carries you. Fling from it to cross the panel.", "A rotating letter carries a silver grip around its face. Time your launch.", "A dangling clip carries you above the paper. Only its silver top grips.", "A pole-flipping toy: blue holds for three seconds, then red pushes for three. The countdown warns before it flips."][i],
  }))),
  ...papers,
  // Packs 25, 27, 28 and 29: photographed assemblies, one item each so they count and
  // can be named. Behaviour is the kind's, not the variant's: a keyring is a keyring.
  ...GADGET_VARIANTS.map(([id, behavior, name]): FridgeItem => ({
    id, family: "gadget", behavior, name,
    description: {
      swing: "A keyring hanging off a magnetic hook. The whole assembly swings when you grab it; only the silver grips.",
      rotor: "A round magnet that turns all the way round, carrying a silver grip about its face. Time your launch.",
      clip: "A bulldog clip holding a sheet of paper. It dangles and only the silver clip grips - the paper does not.",
    }[behavior],
  })),
  ...PAPER_ADDITIONS.map((name, i): FridgeItem => ({ id: `paper-new-${i}`, name, family: "paper", art: 100 + i, kind: "sticker", grips: true, description: "A print under its own magnet. It holds you like the door does." })),
  ...BUSINESS_MAGNETS.map(([name, label], i): FridgeItem => ({ id: `business-${i}`, name, label, family: "bumper", art: 100 + i, hue: [195, 5, 110, 205, 15, 255, 40, 25, 48, 215, 350, 190, 145, 0, 175, 280][i], description: "A moving advertising magnet. Its path can be sideways, vertical or zigzag; contact knocks a climber loose and costs a heart." })),
  { id: "heart", name: "Little Lifeline", family: "pickup", power: "heart", description: "Restores one heart to the climber who collects it, up to three." },
  { id: "coin", name: "Pocket Change", family: "pickup", power: "coin", description: "Coins feed the prize machine for new patterns. Chill mode doesn't award currency." },
  { id: "gem", name: "Ice Gem", family: "pickup", power: "gem", description: "Rare gem currency. Not awarded in Chill mode." },
  { id: "magnet", name: "Super Magnet", family: "pickup", power: "magnet", description: "Temporarily catch earlier, reach farther, and grip glass, plastic and paper as if they were steel." },
  { id: "extra", name: "Pocket Pal", family: "pickup", power: "extra", description: "Adds another climber to your run. Crew only: in solo these are paint buckets instead." },
  { id: "paint", name: "Paint Bucket", family: "pickup", power: "paint", description: "Repaints your climber mid-run. Solo only, and purely for the look of it." },
  { id: "slowmo", name: "Kitchen Timer", family: "pickup", power: "slowmo", description: "Temporarily slows the action." },
  { id: "reach", name: "Reach Badge", family: "pickup", power: "reach", description: "Temporarily stretches how far you can reach for your next hold." },
  { id: "candy", name: "Candy Drop", family: "pickup", power: "candy", description: "Cooper stops for a sweet: the red line crawls for a while." },
  { id: "dispenser", name: "Water Station", family: "surface", kind: "glass", description: "Slippery dispenser. Climb the steel beside it or its silver handle." },
  { id: "calendar", name: "Busy Month", family: "surface", kind: "sticker", grips: true, description: "A big paper calendar on its own magnet. Climb it like the door." },
  { id: "ice-tray", name: "Ice Cube Alley", family: "surface", kind: "trim", description: "Plastic ice tray: no grip. The exposed door around it is safe." },
  { id: "handle", name: "Silver Handle", family: "surface", kind: "void", metal: true, description: "A real metal hold over slippery panels. Hands and feet can catch here." },
  // every destination souvenir gets its own card; the plates in the game pick from these pools by position
  ...[["fiji", "Fiji (S)"], ["hawaii", "Hawaii (S)"], ["bali", "Bali (S)"], ["tahiti", "Tahiti (S)"], ["seychelles", "Seychelles (S)"], ["cape-town", "Cape Town (S)"], ["rio", "Rio (S)"],
      ["cancun", "Cancún (S)"], ["maldives", "Maldives (S)"], ["phuket", "Phuket (S)"], ["zanzibar", "Zanzibar (S)"]].map(([place, name]): FridgeItem => ({
    id: `attract-${place}`, name, family: "surface", kind: "attract", metal: true,
    description: "A fridge souvenir marked S. Its blue field pulls airborne climbers in from a distance and its face catches you. The aim dots turn blue where it bends your flight.",
  })),
  ...[["norway", "Norway (N)"], ["alaska", "Alaska (N)"], ["iceland", "Iceland (N)"], ["jurmala", "Jūrmala (N)"], ["kyiv", "Kyiv (N)"], ["edinburgh", "Edinburgh (N)"], ["lapland", "Lapland (N)"],
      ["banff", "Banff (N)"], ["hokkaido", "Hokkaido (N)"], ["svalbard", "Svalbard (N)"], ["tromso", "Tromsø (N)"]].map(([place, name]): FridgeItem => ({
    id: `repel-${place}`, name, family: "surface", kind: "repel",
    description: "A fridge souvenir marked N. Its red field pushes airborne climbers away; the wider the arcs, the stronger the push. The big ones are slingshots.",
  })),
  { id: "glass", name: "Glass Panel", family: "surface", kind: "glass", description: "Glass blocks catches. Use steel at the sides or a silver handle across it." },
  { id: "plastic", name: "Plastic Trim", family: "surface", kind: "trim", description: "Plastic offers no magnetic hold. Cross in flight or use a metal island." },
  { id: "gap", name: "Door Gap", family: "surface", kind: "void", description: "Nothing to stick to here. Fling across or land on a metal handle." },
  { id: "seam", name: "Centre Seam", family: "surface", kind: "void", description: "The groove between the two doors runs the whole way up. No grip in it; cross it in flight." },
  { id: "vent", name: "Cold Air Vent", family: "surface", kind: "trim", description: "Non-magnetic plastic grille. Jump across or use the steel sides." },
  ...TOY_LABELS.map((label, i): FridgeItem => ({
    id: `bumper-${i}`, name: TOY_NAMES[i],
    family: "bumper", label, hue: [332, 45, 200, 125, 280, 175, 48, 4, 52, 205, 28, 350, 320][i],
    art: [12, 16, 19, 14, 17, 7, 16, 12, 16, 19, 14, 17, 7][i],
    description: "A toy magnet. Stuck straight on the door it pulls or pushes a little, either way round; on a keychain it is plain resin and just swings when brushed. Never a grip.",
  })),
  // v18: the same toys again, this time on the keyring hook and chain. The chain meets each
  // toy at its own measured hook point, so nothing hangs off thin air.
  ...TOY_NAMES.map((name, i): FridgeItem => ({
    id: `swing-toy-${i}`, family: "gadget", behavior: "swing", name: `${name} Keyring`,
    description: "A toy hung off a magnetic hook on a short chain. The whole thing swings when you grab it; only the silver hook and chain grip.",
  })),
  { id: "kid-hand", name: "Cooper's Hand", family: "bumper", hazard: true, description: "A hand swipes across the door now and then. Watch for the LOOK OUT warning and get out of its curved path." },
  { id: "cat-paw", name: "The Cat's Paw", family: "bumper", hazard: true, description: "A paw drops in from the top and taps three times, the second one deepest. A ring warns where it will land; a hit knocks you loose and costs a heart." },
];
export const PAPER_ITEMS = FRIDGE_ITEMS.filter((item) => item.family === "paper");
/** Width/height of the photographed papers, so a v13 card takes the photo's shape instead of cropping it. */
/** Measured from the shipped files by scripts/paper-aspect.mjs, so a new pack cannot land
 *  with the wrong shape: a hand-written table had every card past paper-11 down as square,
 *  and the wide ones were cut to a square slot and drew two thirds the size they should. */
const PHOTO_ASPECT = PAPER_SHAPES as Record<string, number>;
/** Every paper card is cut to the shape of its own art: the photographed ones to
 *  the photo, the rest to the square the drawn cards are authored in. */
export const PAPER_ASPECT: Record<string, number> = Object.fromEntries(
  FRIDGE_ITEMS.filter((item) => item.family === "paper").map((item) => [item.id, PHOTO_ASPECT[item.id] ?? 1]),
);
/** Where a toy's keychain actually meets it, as fractions of its photo.
 *  Measured from the art itself: the highest point of the silhouette, which is the
 *  duck's head, the banana's stem, a block's top corner — not the middle of the
 *  bounding box, where the chain used to stop in mid-air over a sloping toy.
 *  The gummy bear is the one hand-set entry: it hangs by the dip between its ears
 *  rather than by an ear tip. */
export const TOY_HOOKS: Record<string, readonly [number, number]> = {
  "bumper-0": [0.534, 0.02], "bumper-1": [0.303, 0.019], "bumper-2": [0.498, 0.017],
  "bumper-3": [0.512, 0.024], "bumper-4": [0.533, 0.029], "bumper-5": [0.5, 0.017],
  "bumper-6": [0.547, 0], "bumper-7": [0.448, 0], "bumper-8": [0.08, 0],
  "bumper-9": [0.5, 0], "bumper-10": [0.379, 0], "bumper-11": [0.35, 0],
  "bumper-12": [0.5, 0.056],
};
export const toyHook = (id?: string): readonly [number, number] => (id ? TOY_HOOKS[id] : undefined) ?? [0.5, 0.02];
export const BUMPER_ITEMS = FRIDGE_ITEMS.filter((item) => item.family === "bumper" && !item.hazard);
const byId = new Map(FRIDGE_ITEMS.map((item) => [item.id, item]));
export const fridgeItem = (id?: string) => id ? byId.get(id) : undefined;

export function itemZone(id: string, x: number, y: number, w: number, h: number): NoStickZone {
  const item = fridgeItem(id);
  if (!item?.kind) throw new Error(`Not a surface item: ${id}`);
  return { x, y, w, h, kind: item.kind, hue: item.metal ? -1 : undefined, itemId: id };
}
