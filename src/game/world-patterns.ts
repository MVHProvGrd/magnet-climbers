import { itemZone } from "./items";
import type { Segment } from "./types";
import { rule } from "./placement";

export const SET_PIECES = ["water-station", "busy-month", "ice-alley", "handle-hop"] as const;
export type SetPiece = typeof SET_PIECES[number];

/** Each set piece leaves an uninterrupted 64px steel lane at one door edge.
 * Silver holds offer the more adventurous route. No hidden art-only collision.
 */
export function populateSetPiece(s: Segment, pattern: SetPiece, rightLane: boolean, version = 0) {
  const y = s.y;
  // v8+: the art lives on one door and never crosses the centre seam; the other door is the lane
  const onDoor = version >= 8;
  const w = onDoor ? 176 : 244, x = onDoor ? (rightLane ? 12 : 212) : rightLane ? 14 : 78;
  // v7+: the art stops short of both door seams so the door edges stay landable
  const top = version >= 7 ? 40 : 0, bottom = version >= 7 ? 300 : 340;
  const fit = (y0: number, h: number) => { const a = Math.max(top, y0), b = Math.min(bottom, y0 + h); return { y: y + a, h: b - a }; };
  const trayW = onDoor ? 82 : 113, trayGap = onDoor ? 94 : 125;
  s.zones = []; s.bumpers = [];
  if (pattern === "water-station") {
    const d = fit(25, 280); s.zones.push(itemZone("dispenser", x, d.y, w, d.h));
    s.zones.push(itemZone("handle", x + 28, y + 173, 70, 24));
  } else if (pattern === "busy-month") {
    const d = fit(34, 264); s.zones.push(itemZone("calendar", x, d.y, w, d.h));
  } else if (pattern === "ice-alley" && version >= 13) {
    // one tray, standing on end at the photo's own proportions, centred on its door,
    // no handle. The photo is 340x170 and the renderer turns it a quarter turn, so a
    // tray that is not exactly half as wide as it is tall comes out stretched; the
    // old 189/338 guess was 11% too wide.
    const tray = rule("tray"), ta = typeof tray.size === "object" ? tray.size.w / tray.size.h : 170 / 340;
    const d = fit(36, 264), tw = Math.round(d.h * ta);
    s.zones.push(itemZone("ice-tray", x + Math.round((w - tw) / 2), d.y, tw, d.h));
  } else if (pattern === "ice-alley") {
    const d = fit(36, 264);
    for (let i = 0; i < 2; i++) s.zones.push(itemZone("ice-tray", x + i * trayGap, d.y, trayW, d.h));
    s.zones.push(itemZone("handle", x + 18, y + 153, 72, 24));
  } else {
    const d = fit(20, 300); s.zones.push(itemZone("vent", x, d.y, w, d.h));
    for (let i = 0; i < 3; i++) s.zones.push(itemZone("handle", x + (i % 2 ? w - 90 : 20), y + 55 + i * 95, 70, 24));
  }
  // Guarantee a reachable pickup in the clear lane, not buried inside the art.
  if (s.powerUps[0]) { s.powerUps[0].x = rightLane ? 367 : 32; s.powerUps[0].y = y + 170; }
}
