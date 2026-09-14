import { itemZone } from "./items";
import type { Segment } from "./types";

export const SET_PIECES = ["water-station", "busy-month", "ice-alley", "handle-hop"] as const;
export type SetPiece = typeof SET_PIECES[number];

/** Each set piece leaves an uninterrupted 64px steel lane at one door edge.
 * Silver holds offer the more adventurous route. No hidden art-only collision.
 */
export function populateSetPiece(s: Segment, pattern: SetPiece, rightLane: boolean, version = 0) {
  const x = rightLane ? 14 : 78, y = s.y;
  // v7+: the art stops short of both door seams so the door edges stay landable
  const top = version >= 7 ? 40 : 0, bottom = version >= 7 ? 300 : 340;
  const fit = (y0: number, h: number) => { const a = Math.max(top, y0), b = Math.min(bottom, y0 + h); return { y: y + a, h: b - a }; };
  s.zones = []; s.bumpers = [];
  if (pattern === "water-station") {
    const d = fit(25, 280); s.zones.push(itemZone("dispenser", x, d.y, 244, d.h));
    s.zones.push(itemZone("handle", x + 28, y + 173, 70, 24));
  } else if (pattern === "busy-month") {
    const d = fit(34, 264); s.zones.push(itemZone("calendar", x, d.y, 244, d.h));
  } else if (pattern === "ice-alley") {
    const d = fit(36, 264);
    for (let i = 0; i < 2; i++) s.zones.push(itemZone("ice-tray", x + i * 125, d.y, 113, d.h));
    s.zones.push(itemZone("handle", x + 18, y + 153, 72, 24));
  } else {
    const d = fit(20, 300); s.zones.push(itemZone("vent", x, d.y, 244, d.h));
    for (let i = 0; i < 3; i++) s.zones.push(itemZone("handle", x + (i % 2 ? 140 : 20), y + 55 + i * 95, 70, 24));
  }
  // Guarantee a reachable pickup in the clear lane, not buried inside the art.
  if (s.powerUps[0]) { s.powerUps[0].x = rightLane ? 367 : 32; s.powerUps[0].y = y + 170; }
}
