import { zoned, dayKeyAt } from "./day";
/**
 * The fridge of the month.
 *
 * The door is repainted on the first of each month: a different kitchen, the same game. Every
 * update needs something to show, and the art is the strongest thing this project has, so the
 * cheapest way to give a month a face is to change the thing every screenshot is mostly made of.
 *
 * Each theme also carries one pattern you can only get by climbing that month. Patterns are
 * colour sets rather than drawings, so a limited one costs nothing to make and cannot be bought
 * from the prize machine — turning up is the only way to own it.
 *
 * The month is Central, like the daily climb and the league week, so everyone changes door together.
 */
export interface FridgeTheme {
  id: string;
  /** what the month is called, shown when the door changes */
  name: string;
  /** 1-12 */
  month: number;
  /** six stops across the door, left to right: the brushed steel gradient */
  steel: readonly [string, string, string, string, string, string];
  /** the pattern only this month gives out */
  pattern: string;
}

export const FRIDGE_THEMES: readonly FridgeTheme[] = [
  { id: "frost", month: 1, name: "Deep Freeze", pattern: "frost",
    steel: ["#8aa5bd", "#b6d2e8", "#a0bcd4", "#a6c2da", "#c0dcef", "#85a0b8"] },
  { id: "cocoa", month: 2, name: "Hot Cocoa", pattern: "cocoa",
    steel: ["#a99a94", "#cfc1b9", "#bdaea7", "#c3b4ad", "#d6c8c0", "#a4948d"] },
  { id: "meadow", month: 3, name: "First Thaw", pattern: "meadow",
    steel: ["#a3b3a6", "#c8d6c6", "#b5c4b4", "#bbcab9", "#d0dcce", "#9dae9f"] },
  { id: "bloom", month: 4, name: "Kitchen Bloom", pattern: "bloom",
    steel: ["#b6a6b2", "#d8cbd6", "#c5b6c2", "#cbbcc8", "#e0d4dd", "#b0a0ac" ] },
  { id: "lemonade", month: 5, name: "Lemonade", pattern: "lemonade",
    steel: ["#b8b49a", "#dcd8bd", "#c8c4aa", "#cecab0", "#e4e0c6", "#b2ae95"] },
  { id: "seaside", month: 6, name: "Beach House", pattern: "seaside",
    steel: ["#9ab4bd", "#c2dbe3", "#aec7d0", "#b4cdd6", "#cde4eb", "#95afb8"] },
  { id: "picnic", month: 7, name: "Backyard Picnic", pattern: "picnic",
    steel: ["#bdaf9c", "#e0d3c0", "#ccbfac", "#d2c5b2", "#e8dccb", "#b7a997"] },
  { id: "sunblock", month: 8, name: "Popsicle", pattern: "sunblock",
    steel: ["#b9a9a0", "#e2d2c6", "#cdbdb2", "#d3c3b8", "#eaddd2", "#b3a39a"] },
  { id: "pencil", month: 9, name: "Back to School", pattern: "pencil",
    steel: ["#aab3bc", "#c9d0d7", "#b7bfc7", "#bdc5cd", "#d0d6dc", "#a5aeb8"] },
  { id: "harvest", month: 10, name: "Harvest", pattern: "harvest",
    steel: ["#b3a292", "#d9c6b2", "#c5b29e", "#cbb8a4", "#e1cfbc", "#ad9c8c"] },
  { id: "spice", month: 11, name: "Spice Rack", pattern: "spice",
    steel: ["#a8998f", "#cdbdb0", "#bbab9e", "#c1b1a4", "#d6c6b9", "#a29388"] },
  { id: "tinsel", month: 12, name: "Tinsel", pattern: "tinsel",
    steel: ["#9eaab5", "#c7d3de", "#b4c0cb", "#bac6d1", "#d2dee9", "#98a4af"] },
];

/** September's brushed stainless is the one the game shipped with, so it is the fallback. */
export const DEFAULT_THEME = FRIDGE_THEMES[8];

/** The owner of this phone would rather the door stayed stainless; the month still hands out its pattern. */
let plainSteel = false;
export function setPlainSteel(on: boolean): void { plainSteel = on; }
/** What the door is painted: the month's tint, or the plain steel when the phone asked for it. */
export function doorTheme(at: number | Date = Date.now()): FridgeTheme { return plainSteel ? DEFAULT_THEME : themeFor(at); }

export function themeFor(at: number | Date = Date.now()): FridgeTheme {
  const month = zoned(typeof at === "number" ? at : at.getTime()).m;
  return FRIDGE_THEMES.find((t) => t.month === month) ?? DEFAULT_THEME;
}

/** "2026-10", the key a save remembers so a month's pattern is only handed over once. */
export const monthKey = (at: number | Date = Date.now()): string => dayKeyAt(typeof at === "number" ? at : at.getTime()).slice(0, 7);
