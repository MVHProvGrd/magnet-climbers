import { itemZone } from "./items";
import type { Segment } from "./types";

export const SET_PIECES = ["water-station", "busy-month", "ice-alley", "handle-hop"] as const;
export type SetPiece = typeof SET_PIECES[number];

/** Each set piece leaves an uninterrupted 64px steel lane at one door edge.
 * Silver holds offer the more adventurous route. No hidden art-only collision.
 */
export function populateSetPiece(s: Segment, pattern: SetPiece, rightLane: boolean) {
  const x = rightLane ? 14 : 78, y = s.y;
  s.zones = []; s.bumpers = [];
  if (pattern === "water-station") {
    s.zones.push(itemZone("dispenser", x, y + 25, 244, 280));
    s.zones.push(itemZone("handle", x + 28, y + 173, 70, 24));
  } else if (pattern === "busy-month") {
    s.zones.push(itemZone("calendar", x, y + 34, 244, 264));
  } else if (pattern === "ice-alley") {
    for (let i = 0; i < 2; i++) s.zones.push(itemZone("ice-tray", x + i * 125, y + 36, 113, 264));
    s.zones.push(itemZone("handle", x + 18, y + 153, 72, 24));
  } else {
    s.zones.push(itemZone("vent", x, y + 20, 244, 300));
    for (let i = 0; i < 3; i++) s.zones.push(itemZone("handle", x + (i % 2 ? 140 : 20), y + 55 + i * 95, 70, 24));
  }
  // Guarantee a reachable pickup in the clear lane, not buried inside the art.
  if (s.powerUps[0]) { s.powerUps[0].x = rightLane ? 367 : 32; s.powerUps[0].y = y + 170; }
}
