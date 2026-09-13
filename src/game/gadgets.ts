import type { Gadget, NoStickZone, Vec } from "./types";
export const GADGET_KINDS = ["swing", "rotor", "clip", "polarity"] as const;
export const THEMES = ["snack", "travel", "doodle"] as const;
export function gadgetPose(g: Gadget, time: number) {
  const t = time + g.phase;
  const angle = g.kind === "rotor" ? t * 0.95 : Math.sin(t * 1.3) * (g.kind === "clip" ? 0.22 : 0.5);
  const x = g.x + (g.kind === "swing" || g.kind === "clip" ? Math.sin(angle) * 45 : 0);
  const y = g.y + (g.kind === "swing" || g.kind === "clip" ? (1 - Math.cos(angle)) * 45 : 0);
  const active = g.kind === "polarity" && t % 6 >= 3;
  const remaining = 3 - t % 3;
  const hold = g.kind === "rotor" ? { x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20 }
    : { x, y: y + (g.kind === "polarity" ? 0 : -27) };
  return { x, y, angle, active, remaining, hold };
}
export function gadgetZone(g: Gadget, time: number): NoStickZone {
  const p = gadgetPose(g, time), w = g.kind === "polarity" ? 64 : 54, h = g.kind === "polarity" ? 64 : 14;
  return { x: p.hold.x - w / 2, y: p.hold.y - h / 2, w, h, kind: p.active ? "repel" : "void", hue: p.active ? 0 : -1 };
}
export function gadgetContains(g: Gadget, time: number, p: Vec): boolean {
  const z = gadgetZone(g, time);
  return p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h;
}
