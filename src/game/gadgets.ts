import type { Gadget, NoStickZone, Vec } from "./types";
export const GADGET_KINDS = ["swing", "rotor", "clip", "polarity"] as const;
export const THEMES = ["snack", "travel", "doodle"] as const;
/** Themes whose art is a bit of paper: they get clipped, never hung off a chain. */
export const PAPER_THEMES = new Set<typeof THEMES[number]>(["doodle"]);
/** Souvenir art is cosmetic; polarity, timing, and collision remain the same for every destination. */
export const ATTRACT_DESTINATIONS = ["attract-fiji", "attract-hawaii", "attract-bali", "attract-tahiti",
  "attract-seychelles", "attract-cape-town", "attract-rio",
  "attract-cancun", "attract-maldives", "attract-phuket", "attract-zanzibar"] as const;
export const REPEL_DESTINATIONS = ["repel-norway", "repel-alaska", "repel-iceland", "repel-jurmala",
  "repel-kyiv", "repel-edinburgh", "repel-lapland",
  "repel-banff", "repel-hokkaido", "repel-svalbard", "repel-tromso"] as const;
export const POLARITY_DESTINATIONS = [...ATTRACT_DESTINATIONS, ...REPEL_DESTINATIONS] as const;
export function polarityDestination(id: string, repel = false): typeof POLARITY_DESTINATIONS[number] {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  const pool = repel ? REPEL_DESTINATIONS : ATTRACT_DESTINATIONS;
  return pool[(hash >>> 0) % pool.length];
}
export function gadgetPose(g: Gadget, time: number) {
  const t = time + g.phase;
  const angle = g.kind === "rotor" ? t * 0.95 : g.swing ? g.swing.angle : Math.sin(t * 1.3) * (g.kind === "clip" ? 0.22 : 0.5);
  const x = g.x + (g.kind === "swing" || g.kind === "clip" ? Math.sin(angle) * 45 : 0);
  const y = g.y + (g.kind === "swing" || g.kind === "clip" ? (1 - Math.cos(angle)) * 45 : 0);
  const active = g.kind === "polarity" && t % 6 >= 3;
  const remaining = 3 - t % 3;
  const hold = g.kind === "rotor" ? { x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20 }
    : { x, y: y + (g.kind === "polarity" ? 0 : -27) };
  return { x, y, angle, active, remaining, hold };
}
export function gadgetZone(g: Gadget, time: number): NoStickZone {
  // clip hold matches the visible photographed clip (36 wide); swings hold on the chain below the hook
  const p = gadgetPose(g, time), w = g.kind === "polarity" ? 64 : g.kind === "clip" ? 36 : 54, h = g.kind === "polarity" ? 64 : 14;
  return { x: p.hold.x - w / 2, y: p.hold.y - h / 2, w, h, kind: p.active ? "repel" : "void", hue: p.active ? 0 : -1 };
}
export function gadgetContains(g: Gadget, time: number, p: Vec): boolean {
  const z = gadgetZone(g, time);
  return p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h;
}
