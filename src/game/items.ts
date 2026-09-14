import type { NoStickKind, NoStickZone, PowerKind } from "./types";

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

// Data-heavy catalog: seeded runs can keep showing new fridge ephemera
// without adding another collision rule.
const paperNames = [
  "Slice of Life", "Cat Nap Club", "Higher Together", "Scenic Route", "Space Cadet",
  "Home Sweet Fridge", "Grow Your Own Way", "Stay Cool", "Snack List", "You Got This",
  "Don't Let Go", "More Magnets", "Donut Worry", "Avo Good Climb", "Tiny Dinosaur",
  "Rain Check", "Lucky Duck", "Sundae Summit", "Gone Fishing", "Beep Boop",
  "Pancake Patrol", "The Nice List", "Moon Mail", "Garden Club", "Bicycle Day",
  "Best Buds", "Cloud Nine", "Tiny Chef", "Camp Out", "Good Egg",
  "Read More Books", "Rocket Science", "Warm Socks", "Fresh Start", "Snack Attack",
  "You Are Here", "Little Big Dream", "Keep It Sunny", "Doodle Break", "Soup Season",
  "Make Room", "Weekend Plans", "Brave Potato", "Rainbow Route", "Good News",
  "Laundry Legend", "Tiny Victory", "Find Your North", "Star Student", "Nice Try",
  "Almost There", "Friend Zone", "Plant Parent", "Cloud Watcher", "No Bad Days",
  "Good Morning", "Take Five", "Big Feelings", "Pocket Adventure", "Stay Curious",
  "Wild At Heart", "Map The Snacks", "Kindness Counts", "Silly Goose", "Window Seat",
  "A Little Luck", "Keep Growing", "Best Day Ever", "Tiny Treasure", "Fresh Air",
  "One More Fling", "Fridge Famous", "Built Different", "Top Shelf", "Made You Look",
];

const papers: FridgeItem[] = paperNames.map((name, art) => ({
  id: `paper-${art}`, name, family: "paper", art: art % 20, kind: "sticker",
  description: "Paper isn't steel. Catch the bare door around this card.",
}));

const gadgetItems: FridgeItem[] =
  (["swing", "rotor", "clip", "polarity"] as const).flatMap((behavior, i) =>
    (["snack", "travel", "doodle"] as const).map((theme, j): FridgeItem => ({
      id: `${behavior}-${theme}`, family: "gadget", behavior, theme,
      name: [
        ["Donut Keyring", "Trail Keyring", "Star Keyring"],
        ["Alphabet A", "Alphabet B", "Alphabet C"],
        ["Snack Clip", "Postcard Clip", "Art Class Clip"],
        ["Red Bouncer", "Blue Grabber", "Push-Pull Badge"],
      ][i][j],
      description: [
        "Swinging silver grip carries you. Fling from it to cross the panel.",
        "A rotating letter carries a silver grip around its face. Time your launch.",
        "A dangling clip carries you above the paper. Only its silver top grips.",
        "A color-coded field magnet alternates between bouncing you away and grabbing you in. Read the arrows, not a compass letter.",
      ][i],
    })),
  );

const pickups: FridgeItem[] = [
  { id: "heart", name: "Little Lifeline", family: "pickup", power: "heart", description: "Restores one heart to the climber who collects it, up to three." },
  { id: "coin", name: "Pocket Change", family: "pickup", power: "coin", description: "Collect coins for upgrades. Chill mode doesn't award currency." },
  { id: "gem", name: "Ice Gem", family: "pickup", power: "gem", description: "Rare gem currency. Not awarded in Chill mode." },
  { id: "magnet", name: "Super Magnet", family: "pickup", power: "magnet", description: "Temporarily catch earlier and reach farther for real steel." },
  { id: "extra", name: "Pocket Pal", family: "pickup", power: "extra", description: "Adds another climber to your run." },
  { id: "slowmo", name: "Kitchen Timer", family: "pickup", power: "slowmo", description: "Temporarily slows the action." },
  { id: "reach", name: "Stretch Armstrong", family: "pickup", power: "reach", description: "Temporarily extends teammate reach." },
];

const surfaces: FridgeItem[] = [
  { id: "dispenser", name: "Water Station", family: "surface", kind: "glass", description: "Slippery dispenser. Climb the steel beside it or its silver handle." },
  { id: "calendar", name: "Busy Month", family: "surface", kind: "sticker", description: "A big paper calendar. Follow the open steel side lane." },
  { id: "ice-tray", name: "Ice Cube Alley", family: "surface", kind: "trim", description: "Plastic ice tray: no grip. The exposed door around it is safe." },
  { id: "handle", name: "Silver Handle", family: "surface", kind: "void", metal: true, description: "A real metal hold over slippery panels. Hands and feet can catch here." },
  { id: "repel", name: "Red Bouncer", family: "surface", kind: "repel", description: "A red field magnet that kicks airborne climbers away. Follow the outward arrows." },
  { id: "attract", name: "Blue Grabber", family: "surface", kind: "attract", metal: true, description: "A blue field magnet that pulls airborne climbers in and catches them on its steel face." },
  { id: "vent", name: "Cold Air Vent", family: "surface", kind: "trim", description: "Non-magnetic plastic grille. Jump across or use the steel sides." },
];

// Set-piece and field-guide variants reuse existing material rules, so catalog
// variety cannot accidentally invent a new foothold.
const surfaceThemes = [
  ["Lunchbox", "glass"], ["Recipe Card", "sticker"], ["Freezer Rail", "trim"], ["Bottle Opener", "void"],
  ["Red Bouncer Mini", "repel"], ["Blue Grabber Mini", "attract"], ["Fan Grille", "trim"], ["Photo Sleeve", "glass"],
  ["Chore Chart", "sticker"], ["Cookie Tin", "void"], ["Rubber Seal", "trim"], ["Ice Window", "glass"],
  ["Souvenir Card", "sticker"], ["Drawer Lip", "void"], ["Vent Cover", "trim"], ["Cold Shelf", "glass"],
  ["Bouncer Sticker", "repel"], ["Grabber Sticker", "attract"], ["Steel Tab", "void"], ["Plastic Basket", "trim"],
  ["Milk Door", "glass"], ["School Note", "sticker"], ["Crisper Rail", "void"], ["Magnet Mailbox", "attract"],
] as const;
for (let i = 0; i < surfaceThemes.length; i++) {
  const [name, kind] = surfaceThemes[i];
  surfaces.push({
    id: `surface-${i}`, name, family: "surface", kind,
    metal: kind === "void" || kind === "attract", hue: (i * 47) % 360,
    description: kind === "repel" ? "Red field magnet: arrows point away. Do not launch straight at it."
      : kind === "attract" ? "Blue field magnet: arrows point in. It is a legal steel landing."
        : kind === "sticker" ? "Paper decoration. The steel around its edges is the route."
          : kind === "glass" ? "Slippery glass. Use the side lane or find a metal hold."
            : kind === "trim" ? "Plastic trim. It looks sturdy but gives no magnetic grip."
              : "A small steel hold hidden in the fridge clutter.",
  });
}

const bumperBases = [
  ["Rolling Donut", "DONUT"], ["Duck Dash", "DUCK"], ["Robot Patrol", "ROBOT"], ["Dino Slide", "DINO"],
  ["Pop Magnet", "POP!"], ["Cool Cruiser", "COOL"], ["Pizza Run", "PIZZA"], ["Veggie Van", "VEG"],
  ["Night Bus", "NITE"], ["Garden Bug", "BUG"], ["Toy Train", "GO!"], ["Moon Rover", "MOON"],
  ["Sock Rocket", "SOCK"], ["Snack Cart", "YUM"], ["Tiny Taxi", "TAXI"], ["Cloud Skater", "CLOUD"],
  ["Puddle Jumper", "SPLASH"], ["Book Worm", "READ"], ["Rainbow Ride", "RAIN"], ["Camp Wagon", "CAMP"],
  ["Star Hopper", "STAR"], ["Milk Run", "MILK"], ["Pancake Pad", "FLIP"], ["Crayon Car", "DRAW"],
] as const;
const bumpers: FridgeItem[] = [];
for (let i = 0; i < 75; i++) {
  const [base, label] = bumperBases[i % bumperBases.length];
  const round = Math.floor(i / bumperBases.length);
  bumpers.push({
    id: `bumper-${i}`, name: round ? `${base} ${round + 1}` : base, family: "bumper",
    label, hue: (i * 53) % 360, art: i % 20,
    description: "Moving fridge magnet: knocks you loose, even from a planted grip. Time your fling.",
  });
}

/** Stable IDs are shared by world generation, artwork, and the player's field guide. */
export const FRIDGE_ITEMS: readonly FridgeItem[] = [...gadgetItems, ...papers, ...pickups, ...surfaces, ...bumpers];
export const PAPER_ITEMS = FRIDGE_ITEMS.filter((item) => item.family === "paper");
export const BUMPER_ITEMS = FRIDGE_ITEMS.filter((item) => item.family === "bumper");
const byId = new Map(FRIDGE_ITEMS.map((item) => [item.id, item]));
export const fridgeItem = (id?: string) => id ? byId.get(id) : undefined;

export function itemZone(id: string, x: number, y: number, w: number, h: number): NoStickZone {
  const item = fridgeItem(id);
  if (!item?.kind) throw new Error(`Not a surface item: ${id}`);
  return { x, y, w, h, kind: item.kind, hue: item.metal ? -1 : undefined, itemId: id };
}
