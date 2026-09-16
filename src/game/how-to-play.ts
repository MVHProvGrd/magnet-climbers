/**
 * The "how to play" page: the rules grouped by what they DO to you, not by item family.
 *
 * Replaces the old Field Guide, which was a catalogue of every variant, one card each:
 * one row per rule instead, with a live count of how many variants sit behind it.
 *
 * Anything that is its own mechanic — every boost, every hazard — is generated from
 * FRIDGE_ITEMS rather than written out here, because a hand-written sentence silently
 * goes stale the moment someone adds an item. Counts alone are not enough: they move
 * without the prose moving with them, which is how the candy drop and the cat's paw came
 * to be missing from a page whose numbers had already updated around them.
 *
 * Keep these rows generated. `tests/magnetism.test.ts` asserts every boost and hazard is
 * named here; while the rows come from FRIDGE_ITEMS that holds by construction, and the
 * assertion is there to fail the day someone writes the list out by hand again.
 */
import { FRIDGE_ITEMS, type FridgeItem } from "./items";

export interface HowToRow {
  icon: string;
  name: string;
  text: string;
  /** Shown as "N kinds" when a single rule covers a pool of art. */
  count?: number;
  /** Art for the 4-column tile grid (handoff 3c), relative to BASE_URL. Absent = swatch. */
  art?: string;
  /** Swatch class when there is no photograph: brushed steel, or the red line. */
  swatch?: "steel" | "redline";
  /** Short note under the tile name. */
  note?: string;
  /**
   * How the art sits in its 44 px tile. Flat surfaces fill it (the handoff asks for cover);
   * objects are shown whole. A few sources are tall with the subject at one end -- the paw
   * pad sits 85% down its art -- so those crop to a focus point instead.
   */
  fit?: "cover" | "contain";
  focus?: string;
}
export interface HowToSection {
  title: string;
  blurb?: string;
  rows: HowToRow[];
}

const tally = (fn: (item: FridgeItem) => boolean) => FRIDGE_ITEMS.filter(fn).length;
const surfaces = (kind: FridgeItem["kind"]) => tally((i) => i.family === "surface" && i.kind === kind && !i.metal);

/** Currency and health read as their own rules; everything else in the pickup pool is a boost. */
const CARRIED = ["coin", "gem", "heart"];
export const boostItems = () => FRIDGE_ITEMS.filter((i) => i.family === "pickup" && !CARRIED.includes(i.power ?? ""));
export const hazardItems = () => FRIDGE_ITEMS.filter((i) => i.hazard);

/** One icon per mechanic; anything new falls back to a neutral mark rather than vanishing. */
const ICONS: Record<string, string> = {
  magnet: "🧲", reach: "📏", slowmo: "⏱️", extra: "🧍", candy: "🍬",
  "kid-hand": "✋", "cat-paw": "🐾",
};
/** Tile art for the generated rows; pickups are named by their power kind. */
const ART: Record<string, string> = {
  coin: "art/real-v1/pickups/coin.png", gem: "art/real-v1/pickups/gem.png", heart: "art/real-v1/pickups/heart.png",
  magnet: "art/real-v1/pickups/magnet.png", extra: "art/real-v1/pickups/extra.png",
  slowmo: "art/real-v1/pickups/slowmo.png", reach: "art/real-v1/pickups/reach.png", candy: "art/real-v1/pickups/candy.png",
  paint: "art/real-v1/pickups/paint.png",
  "kid-hand": "art/real-v1/kid-arm.webp", "cat-paw": "art/real-v1/cat-paw.webp",
};
const iconFor = (item: FridgeItem, fallback: string) => ICONS[item.id] ?? ICONS[item.power ?? ""] ?? fallback;
/**
 * Tall sources whose subject sits at one END of the frame, not in the middle.
 *
 * cover on a 44 px square shows only about a third of these images, and an
 * object-position percentage opens that window part-way down -- which clipped the
 * fingertips off the hand. Both subjects are hard against an edge, so anchor to the
 * edge and nothing can be cut: kid-hand.ts puts the fingertips at 2.7% with the sleeve
 * running down, and cat-paw.ts puts the pad 85% down with the toes below it.
 */
const FOCUS: Record<string, string> = { "kid-hand": "center top", "cat-paw": "center bottom" };
const fromItem = (item: FridgeItem, fallback: string): HowToRow => ({
  icon: iconFor(item, fallback), name: item.name, text: item.description,
  art: ART[item.id] ?? ART[item.power ?? ""],
  fit: FOCUS[item.id] ? "cover" : undefined, focus: FOCUS[item.id],
});

export function howToSections(): HowToSection[] {
  return [
    {
      title: "What holds you",
      blurb: "Magnets only catch on bare steel. Everything else is something to cross.",
      rows: [
        { icon: "🔩", name: "Bare steel", swatch: "steel", note: "the only hold", text: "The shiny door itself. Hands and feet catch here, and nowhere else." },
        { icon: "🪝", name: "Handles", art: "art/real-v1/obstacles/handle.png", note: "metal island", text: "Real metal islands laid across slippery panels. A legal hold in the middle of glass." },
        { icon: "📄", name: "Paper", fit: "cover", art: "art/real-v1/obstacles/calendar.png", note: "holds you", text: "Drawings, notes, prints and the calendar are pinned up by their own magnets, so yours catches on them.", count: tally((i) => i.family === "paper" || i.kind === "sticker") },
        { icon: "🧲", name: "S souvenirs", art: "art/destinations/attract-bali.webp", note: "pull you in", text: "Pull you in from a distance and catch you. The aim dots turn blue where one bends your flight.", count: tally((i) => i.kind === "attract") },
        { icon: "⛓️", name: "Gadget grips", art: "art/gadgets/swing-snack.webp", note: "ride, then fling", text: "Keyrings swing, letters rotate, clips dangle. Only the silver part grips — ride it, then fling.", count: tally((i) => i.family === "gadget") },
      ],
    },
    {
      title: "What won't",
      blurb: "No grip at all. Cross these in flight, or go around by the steel at the edges.",
      rows: [
        { icon: "🫙", name: "Glass", fit: "cover", art: "art/real-v1/obstacles/glass.png", note: "no catch", text: "Panels and the water station. Use the steel at the sides or a handle across it.", count: surfaces("glass") },
        { icon: "🧊", name: "Plastic", fit: "cover", art: "art/real-v1/obstacles/plastic.png", note: "no hold", text: "Trim, air vents and the ice tray. Nothing magnetic to hold.", count: surfaces("trim") },
        { icon: "🕳️", name: "Open gaps", fit: "cover", art: "art/real-v1/obstacles/gap.png", note: "fling across", text: "The door gap and the centre seam that runs the whole way up. Fling across.", count: surfaces("void") },
      ],
    },
    {
      title: "What pushes and hurts",
      rows: [
        { icon: "🔴", name: "The red line", swatch: "redline", note: "never stops", text: "Cooper's reach, rising the whole time — and faster the higher you get. Anything below it is lost." },
        { icon: "🧲", name: "N souvenirs", art: "art/destinations/repel-iceland.webp", note: "push you away", text: "Push you away mid-flight. The wider the arcs the stronger it is; the big ones are slingshots.", count: tally((i) => i.kind === "repel") },
        { icon: "🚚", name: "Advertising", art: "art/business/business-0.webp", note: "costs a heart", text: "Moving magnets on sideways, vertical or zigzag paths. Contact knocks you loose and costs a heart.", count: tally((i) => /^business-/.test(i.id)) },
        { icon: "🧸", name: "Toy keychains", art: "art/bumpers/bumper-0.webp", note: "a small push", text: "Toys hanging on chains. Brushing one gives you a small push and sets it swinging — no damage.", count: tally((i) => /^bumper-\d/.test(i.id)) },
        ...hazardItems().map((i) => fromItem(i, "⚠️")),
      ],
    },
    {
      title: "What to grab",
      rows: [
        { icon: "🪙", name: "Coin", art: ART.coin, note: "prize machine", text: "Currency for the prize machine. Chill mode pays none." },
        { icon: "💎", name: "Gem", art: ART.gem, note: "revives", text: "Rare currency, spent on revives. Chill mode pays none." },
        { icon: "❤️", name: "Heart", art: ART.heart, note: "up to three", text: "Restores one heart to whoever collects it, up to three." },
        ...boostItems().map((i) => fromItem(i, "✨")),
      ],
    },
    {
      title: "Climbing",
      rows: [
        { icon: "👆", name: "Fling", text: "Drag back from anywhere on the screen and let go. The dashed ring shows who you're throwing." },
        { icon: "🐸", name: "Leapfrog", text: "The lowest free climber is picked for you, so a good run is a rhythm of bottom over top." },
        { icon: "🪜", name: "Chains", text: "CLIMB builds a ladder of teammates across a wide gap. A climber holding someone is a rung and can't launch." },
        { icon: "🌟", name: "Tricks", text: "Handstands, one-hand saves and close calls pay small coin bonuses. They can't be farmed at the same height." },
      ],
    },
  ];
}
