/**
 * The size every thing on the door is drawn at, in the game's own pixels.
 *
 * These are not guesses. Each one was chosen on the scale bench against a climber standing
 * beside it, one item at a time, and the table is generated from that audit
 * (`data/scale-audit.json`) rather than typed out here. Ten pixels is a centimetre, and a
 * climber is 36 px, so a number in here is a real statement about how big a thing is on a
 * fridge -- a paper card at 150 px is fifteen centimetres, about four climbers tall.
 *
 * Everything that draws a door object should ask here rather than carrying its own constant,
 * so the door has one answer per thing instead of several that drift.
 */
import TABLE from "./data/item-sizes.json";

export type Size = readonly [w: number, h: number];

const SIZES = TABLE as unknown as Record<string, Size>;

/** The chosen size, or undefined for anything never audited (the hand, the paw, the seam). */
export const sizeOf = (id: string): Size | undefined => SIZES[id];

/** The chosen size scaled by a percentage, which is how the bench now talks about it. */
export function sizeAt(id: string, percent: number): Size | undefined {
  const s = SIZES[id];
  if (!s) return undefined;
  const k = percent / 100;
  return [Math.max(1, Math.round(s[0] * k)), Math.max(1, Math.round(s[1] * k))];
}

/** How many things carry a chosen size, for the bench's own progress line. */
export const SIZED_COUNT = Object.keys(SIZES).length;
