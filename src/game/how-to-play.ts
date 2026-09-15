/**
 * The "how to play" page: the rules grouped by what they DO to you, not by item family.
 *
 * Replaces the old Field Guide, which was a catalogue of every variant, one card each:
 * one row per rule instead, with a live count of how many variants sit behind it. Counts and
 * families are derived from FRIDGE_ITEMS, so adding art can never leave this page stale.
 */
import { FRIDGE_ITEMS, type FridgeItem } from "./items";

export interface HowToRow {
  icon: string;
  name: string;
  text: string;
  /** Shown as "N kinds" when a single rule covers a pool of art. */
  count?: number;
}
export interface HowToSection {
  title: string;
  blurb?: string;
  rows: HowToRow[];
}

const tally = (fn: (item: FridgeItem) => boolean) => FRIDGE_ITEMS.filter(fn).length;
const surfaces = (kind: FridgeItem["kind"]) => tally((i) => i.family === "surface" && i.kind === kind && !i.metal);

export function howToSections(): HowToSection[] {
  return [
    {
      title: "What holds you",
      blurb: "Magnets only catch on bare steel. Everything else is something to cross.",
      rows: [
        { icon: "🔩", name: "Bare steel", text: "The shiny door itself. Hands and feet catch here, and nowhere else." },
        { icon: "🪝", name: "Silver handles", text: "Real metal islands laid across slippery panels. A legal hold in the middle of glass." },
        { icon: "🧲", name: "S souvenirs (blue)", text: "Pull you in from a distance and catch you. The aim dots turn blue where one bends your flight.", count: tally((i) => i.kind === "attract") },
        { icon: "⛓️", name: "Gadget grips", text: "Keyrings swing, letters rotate, clips dangle. Only the silver part grips — ride it, then fling.", count: tally((i) => i.family === "gadget") },
      ],
    },
    {
      title: "What won't",
      blurb: "No grip at all. Cross these in flight, or go around by the steel at the edges.",
      rows: [
        { icon: "🫙", name: "Glass", text: "Panels and the water station. Use the steel at the sides or a handle across it.", count: surfaces("glass") },
        { icon: "🧊", name: "Plastic", text: "Trim, air vents and the ice tray. Nothing magnetic to hold.", count: surfaces("trim") },
        { icon: "📄", name: "Paper", text: "Drawings, notes, prints and the calendar. Catch the bare door around them.", count: tally((i) => i.family === "paper" || i.kind === "sticker") },
        { icon: "🕳️", name: "Open gaps", text: "The door gap and the centre seam that runs the whole way up. Fling across.", count: surfaces("void") },
      ],
    },
    {
      title: "What pushes and hurts",
      rows: [
        { icon: "🔴", name: "The red line", text: "The kid's reach, rising the whole time — and faster the higher you get. Anything below it is lost." },
        { icon: "🧲", name: "N souvenirs (red)", text: "Push you away mid-flight. The wider the arcs the stronger it is; the big ones are slingshots.", count: tally((i) => i.kind === "repel") },
        { icon: "🚚", name: "Advertising magnets", text: "Moving magnets on sideways, vertical or zigzag paths. Contact knocks you loose and costs a heart.", count: tally((i) => /^business-/.test(i.id)) },
        { icon: "🧸", name: "Toy keychains", text: "Toys hanging on chains. Brushing one gives you a small push and sets it swinging — no damage.", count: tally((i) => /^bumper-\d/.test(i.id)) },
        { icon: "✋", name: "The kid's hand", text: "Swipes across the door now and then. Watch for the LOOK OUT warning and get clear of the curved path." },
      ],
    },
    {
      title: "What to grab",
      rows: [
        { icon: "🪙", name: "Coins and gems", text: "Currency for the prize machine and revives. Chill mode pays neither." },
        { icon: "❤️", name: "Hearts", text: "Restore one heart to whoever collects it, up to three." },
        { icon: "✨", name: "Boosts", text: "Super Magnet catches earlier and farther, Reach Badge stretches your climb, Kitchen Timer slows everything, Pocket Pal adds a climber.", count: tally((i) => i.family === "pickup") },
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
