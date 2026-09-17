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
/** Rotors on a free bearing: knock one and it whirls. A wall clock and a dial thermometer do not. */
export const FREE_SPIN = new Set(["rotor-fidget-spinner", "rotor-pinwheel", "rotor-snack", "rotor-travel", "rotor-doodle"]);
/** Nothing turns these on its own: a spinner and an alphabet letter sit dead still until they are hit. */
export const STILL_UNTIL_HIT = new Set(["rotor-fidget-spinner", "rotor-snack", "rotor-travel", "rotor-doodle"]);
/** A wall clock hangs on a nail and does not turn at all: it reads the time, so spinning it is nonsense. */
export const NEVER_TURNS = new Set(["rotor-clock", "rotor-compass"]);
/** Hung from the loop in its own photo: the hook above it is the hold, not a spot on its face. */
export const HUNG_BY_LOOP = new Set(["rotor-compass"]);
/** The keyring toy as gadget-art draws it: 68px down a 44px chain from a pivot 62px above the anchor. */
export const KEYRING = { pivotUp: 62, chain: 44, toy: 68 } as const;
/** Where the hanging toy's face is right now, so a hit can be mapped onto the art a player sees. */
export function toyFace(g: Gadget, time: number, hook: readonly [number, number] = [0.5, 0.02]) {
  const p = gadgetPose(g, time);
  const px = g.x, py = g.y - KEYRING.pivotUp;
  // gadget-art rotates the chain and toy together by -lean about that pivot
  const lean = -Math.atan2(p.hold.x - g.x, p.hold.y - py);
  const size = KEYRING.toy;
  const tx = -hook[0] * size, ty = KEYRING.chain - 2 - hook[1] * size;
  const lx = tx + size / 2, ly = ty + size / 2;
  const cos = Math.cos(lean), sin = Math.sin(lean);
  return { x: px + lx * cos - ly * sin, y: py + lx * sin + ly * cos, size, lean };
}
/** Local coordinates (0..1 across the toy) of a world point on that face. */
export function faceUV(face: ReturnType<typeof toyFace>, p: Vec) {
  const cos = Math.cos(-face.lean), sin = Math.sin(-face.lean);
  const dx = p.x - face.x, dy = p.y - face.y;
  return { u: (dx * cos - dy * sin) / face.size + 0.5, v: (dx * sin + dy * cos) / face.size + 0.5 };
}
export function gadgetPose(g: Gadget, time: number) {
  const t = time + g.phase;
  // a clock and a compass are read, not played with: they hang square on the door. Everything else
  // that rests keeps its phase as a resting angle, so a row of them does not sit the same way up.
  const fixed = NEVER_TURNS.has(g.itemId);
  const still = fixed || (!!g.spin && STILL_UNTIL_HIT.has(g.itemId));
  const angle = g.kind === "rotor" ? (fixed ? 0 : still ? g.phase : t * 0.95) + (g.spin?.extra ?? 0) : g.swing ? g.swing.angle : Math.sin(t * 1.3) * (g.kind === "clip" ? 0.22 : 0.5);
  const x = g.x + (g.kind === "swing" || g.kind === "clip" ? Math.sin(angle) * 45 : 0);
  const y = g.y + (g.kind === "swing" || g.kind === "clip" ? (1 - Math.cos(angle)) * 45 : 0);
  const active = g.kind === "polarity" && t % 6 >= 3;
  const remaining = 3 - t % 3;
  const hold = HUNG_BY_LOOP.has(g.itemId) ? { x, y: y - 30 }
    : g.kind === "rotor" ? { x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20 }
    : { x, y: y + (g.kind === "polarity" ? 0 : -27) };
  return { x, y, angle, active, remaining, hold };
}
export function gadgetZone(g: Gadget, time: number): NoStickZone {
  // clip hold matches the visible photographed clip (36 wide); swings hold on the chain below the hook
  const p = gadgetPose(g, time), w = g.kind === "polarity" ? 64 : g.kind === "clip" ? 36 : 54, h = g.kind === "polarity" ? 64 : 14;
  // a polarity toy is a real magnet on both poles: red pushes, blue pulls. Anything else that
  // hangs is plain resin, so its zone stays a hole you cannot stick to.
  const kind = p.active ? "repel" : g.kind === "polarity" ? "attract" : "void";
  return { x: p.hold.x - w / 2, y: p.hold.y - h / 2, w, h, kind, hue: p.active ? 0 : -1 };
}
export function gadgetContains(g: Gadget, time: number, p: Vec): boolean {
  const z = gadgetZone(g, time);
  return p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h;
}
