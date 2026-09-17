import { CFG, W } from "./config";

/** Closest two pickups in one segment may sit, centre to centre. */
const PICKUP_GAP = 96;
import type { Gadget, Bumper, NoStickZone, PowerKind, PowerUp, Rect, Segment, Vec } from "./types";
import { PAPER_ITEMS, BUMPER_ITEMS, PAPER_ASPECT, FRIDGE_ITEMS, toyHook } from "./items";
import { rule } from "./placement";
import { populateSetPiece, SET_PIECES } from "./world-patterns";
import type { Section } from "./expeditions";
import { faceUV, FREE_SPIN, gadgetContains, gadgetPose, gadgetZone, GADGET_KINDS, PAPER_THEMES, THEMES, toyFace } from "./gadgets";

/** Small seeded PRNG so a run can be replayed / shared later (daily challenge). */
export function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export type Rng = () => number;

const rangeOf = (r: Rng, a: number, b: number) => a + r() * (b - a);
const pick = <T,>(r: Rng, arr: T[]) => arr[Math.floor(r() * arr.length)];

/** Steel kept clear above and below every door seam (v7+), so a climber can always land at a door edge. */
export const SEAM_MARGIN = 36;

/** POP! bubble centres as fractions of the toy image (5 columns x 2 rows) and their radius as a fraction of width. */
export const POP_BUBBLES: readonly [number, number][] = [[0.158, 0.279], [0.329, 0.279], [0.498, 0.279], [0.666, 0.279], [0.843, 0.279], [0.158, 0.679], [0.329, 0.679], [0.498, 0.679], [0.666, 0.679], [0.843, 0.679]];
export const POP_RADIUS = 0.0695;
/** v13: true when a rect overlaps any zone a magnet cannot sit on (glass, plastic, paper, open gaps). */
function blocked(zones: NoStickZone[], rect: Rect, pad = 16, anyZone = false): boolean {
  return zones.some((o) => (anyZone || o.kind === "glass" || o.kind === "trim" || o.kind === "void" || o.kind === "sticker")
    && rect.x < o.x + o.w + pad && rect.x + rect.w > o.x - pad && rect.y < o.y + o.h + pad && rect.y + rect.h > o.y - pad);
}
/** v8+: an x for a box of width w that keeps it on one door, clear of the centre seam. */
function onOneDoor(r: Rng, w: number, min = 0): number {
  const left = DOOR_SEAM.x - 8 - w, right = DOOR_SEAM.x + DOOR_SEAM.w + 8;
  const canLeft = left >= min, canRight = right + w <= W - min;
  if (canLeft && canRight ? r() < 0.5 : canLeft) return rangeOf(r, min, left);
  return rangeOf(r, right, W - w - min);
}

/** The vertical seam between the two fridge doors. Always non-stick. */
export const DOOR_SEAM: Rect = { x: W / 2 - 5, y: -1e9, w: 10, h: 2e9 };

export class World {
  gadgetTime = 0;
  segments: Segment[] = [];
  /** Super Magnet: while true, glass, plastic, paper and plates all take a grip (open gaps and toys still do not). */
  superGrip = false;
  /** cosmetic memory (v12): the last few paper cards and bumpers, so neighbouring doors do not repeat */
  private recentPapers: string[] = [];
  private lastKind = "";
  private recentBumpers: string[] = [];
  private recentToys: string[] = [];
  private recentGadgets: string[] = [];
  private remember(list: string[], id: string, keep: number) { list.push(id); while (list.length > keep) list.shift(); }
  /**
   * v17: a hanging gadget is one of the photographed variants, not just its theme. Polarity
   * keeps its three themed toys - the compass, crayon and candy pole are drawn, not photographed.
   */
  private pickGadgetItem(art: () => number, kind: Gadget["kind"], theme: string): string {
    if (kind === "polarity" || this.version < 17) return `${kind}-${theme}`;
    // the v16 rule still holds: a doodle is a bit of paper, so it is clipped, never hung
    const pool = FRIDGE_ITEMS.filter((it) => it.family === "gadget" && it.behavior === kind
      && !(kind === "swing" && this.version >= 16 && it.theme !== undefined && PAPER_THEMES.has(it.theme))
      && !(this.version < 18 && it.id.startsWith("swing-toy-")));
    if (!pool.length) return `${kind}-${theme}`;
    let item = pick(art, pool);
    for (let k = 0; k < 6 && this.recentGadgets.includes(item.id); k++) item = pick(art, pool);
    this.remember(this.recentGadgets, item.id, 6);
    return item.id;
  }
  /** Swings are damped pendulums (Codex's motion study: a = -9.8 sin θ - 1.4 ω). Still until something touches them. */
  /** everything that hangs: gadgets and toy keychain zones */
  private get hanging(): { swing?: { angle: number; vel: number; cool: number } }[] {
    return [...this.gadgets.filter((g) => !g.fixed), ...this.segments.flatMap((s) => s.zones.filter((z) => z.swing))];
  }
  stepGadgets(dt: number) {
    for (const seg of this.segments) for (const z of seg.zones) if (z.popCool) z.popCool = Math.max(0, z.popCool - dt);
    for (const g of this.gadgets) if (g.popCool) g.popCool = Math.max(0, g.popCool - dt);
    for (const g of this.hanging) {
      const s = g.swing; if (!s) continue;
      s.cool = Math.max(0, s.cool - dt);
      s.vel += (-9.8 * Math.sin(s.angle) - 1.4 * s.vel) * dt;
      s.angle += s.vel * dt;
    }
    // a knocked spinner whirls and coasts back down to its idle drift; bearings lose about half a second
    for (const g of this.gadgets) {
      const s = g.spin; if (!s) continue;
      s.cool = Math.max(0, s.cool - dt);
      s.extra += s.vel * dt;
      s.vel -= s.vel * Math.min(1, 1.1 * dt);
      if (Math.abs(s.vel) < 0.02) s.vel = 0;
    }
  }

  /** Spin a free rotor up. dir is the travel direction, strength 0..1. Capped so it never blurs out. */
  spinGadget(id: string, dir: number, strength = 1) {
    const g = this.gadgets.find((g) => g.id === id); const s = g?.spin;
    if (!s || s.cool > 0) return false;
    s.vel = Math.max(-26, Math.min(26, s.vel + 16 * (dir || 1) * Math.max(0.3, strength)));
    s.cool = 0.25;
    return true;
  }
  /** Knock a swing: dir is the travel direction (sign of x velocity), strength 0..1. Capped at ±3 rad/s like the study. */
  bumpGadget(id: string, dir: number, strength = 1) {
    const g = this.gadgets.find((g) => g.id === id); const s = g?.swing; if (!s || g?.fixed) return;
    s.vel = Math.max(-3, Math.min(3, s.vel + 1.5 * (dir || 1) * Math.max(0.25, strength)));
    s.cool = 0.3;
  }
  /** A flying climber passing through the hanging charm knocks it (once per pass). */
  knockSwings(p: Vec, vx: number) {
    for (const g of this.gadgets) {
      const strength = Math.min(1, Math.abs(vx) / 300);
      if (g.spin) {
        const pose = gadgetPose(g, this.gadgetTime);
        // a rotor is a disc, so anywhere on the face counts, not just the arm a climber can hold
        if (Math.hypot(p.x - pose.x, p.y - pose.y) < 38 && this.spinGadget(g.id, Math.sign(vx), strength)) this.knocked = g.itemId;
        continue;
      }
      // a keyring POP! toy: the bubble nearest the hit flips, same as one stuck on the door
      if (g.pops != null && (g.popCool ?? 0) <= 0) {
        const face = toyFace(g, this.gadgetTime, toyHook(g.itemId.replace(/^swing-toy-/, "bumper-")));
        if (Math.hypot(p.x - face.x, p.y - face.y) < face.size * 0.6) {
          const { u, v } = faceUV(face, p);
          let best = 0, bd = 9;
          POP_BUBBLES.forEach(([bx, by], i) => { const d = Math.hypot((u - bx) * 2.3, v - by); if (d < bd) { bd = d; best = i; } });
          g.pops ^= 1 << best; g.popCool = 0.16;
          this.popped = { index: best, inward: !!(g.pops & (1 << best)) };
        }
      }
      const s = g.swing; if (!s || g.fixed || s.cool > 0) continue;
      const pose = gadgetPose(g, this.gadgetTime);
      if (Math.hypot(p.x - pose.x, p.y - pose.y) < 30) {
        this.bumpGadget(g.id, Math.sign(vx), strength);
        this.knocked = g.itemId;
      }
    }
    for (const seg of this.segments) for (const z of seg.zones) {
      const inside = p.x > z.x - 12 && p.x < z.x + z.w + 12 && p.y > z.y - 12 && p.y < z.y + z.h + 12;
      // POP! toy: the nearest bubble flips on contact (debounced per toy); report which for the sound
      if (inside && z.pops != null && (z.popCool ?? 0) <= 0) {
        const u = (p.x - z.x) / z.w, v = (p.y - z.y) / z.h;
        let best = 0, bd = 9;
        POP_BUBBLES.forEach(([bx, by], i) => { const d = Math.hypot((u - bx) * 2.3, v - by); if (d < bd) { bd = d; best = i; } });
        z.pops ^= 1 << best; z.popCool = 0.16;
        this.popped = { index: best, inward: !!(z.pops & (1 << best)) };
      }
      const s = z.swing; if (!s || s.cool > 0) continue;
      if (inside) {
        s.vel = Math.max(-3, Math.min(3, s.vel + 1.5 * (Math.sign(vx) || 1) * Math.max(0.25, Math.min(1, Math.abs(vx) / 300)))); s.cool = 0.3;
        if (z.itemId) this.knocked = z.itemId;
      }
    }
  }
  /** last bubble flipped this frame (the game turns it into a sound), cleared by the game */
  popped: { index: number; inward: boolean } | null = null;
  /** last hanging toy set swinging this frame, by item id: some of them make a noise */
  knocked: string | null = null;
  rng: Rng;
  /** y of the top-most generated segment */
  private topY: number;
  private index = 0;

  readonly seed: number;

  /** last paper card used, so consecutive segments do not repeat it */
  private lastCardId = "";

  /** Expedition recipe; when set, segments come from it instead of the endless generator. */
  spec: Section[] | null = null;

  constructor(seed: number, startY: number, readonly version = 22, spec: Section[] | null = null) {
    this.spec = spec;
    this.seed = seed;
    this.rng = makeRng(seed);
    this.topY = startY;
    // first segment: solid metal so the team has a home
    this.segments.push({ y: startY - CFG.segmentH, h: CFG.segmentH, zones: [], powerUps: [], bumpers: [] });
    this.topY = startY - CFG.segmentH;
    this.index = 1;
  }

  /** Number of segments generated so far (deterministic given the seed). */
  get generated(): number {
    return this.index;
  }

  /** Regenerate forward until `count` segments exist. Used when restoring a snapshot. */
  generateTo(count: number): void {
    while (this.index < count) {
      this.segments.push(this.generate(this.index++));
      this.topY -= CFG.segmentH;
    }
  }

  /** Make sure terrain exists up to (and beyond) the given y. */
  ensure(upToY: number): void {
    while (this.topY > upToY - CFG.segmentH * 2) {
      this.segments.push(this.generate(this.index++));
      this.topY -= CFG.segmentH;
    }
    // prune far-below segments
    while (this.segments.length > 12 && this.segments[0].y > upToY + CFG.segmentH * 6) {
      this.segments.shift();
    }
  }

  /** One expedition segment: exactly what the recipe says, two coins, nothing else. */
  private generateFromSpec(i: number): Segment {
    const r = this.rng;
    const y = this.topY - CFG.segmentH, h = CFG.segmentH;
    const section: Section = this.spec![i - 1] ?? { kind: "steel" };
    const zones: NoStickZone[] = []; const bumpers: Bumper[] = []; const powerUps: PowerUp[] = [];
    if (section.kind === "band") {
      const by = y + (h - section.h) / 2;
      const laneW = 64;
      const x = section.lane === "left" ? laneW : 0;
      const w = section.lane ? W - laneW : W;
      zones.push({ x, y: by, w, h: section.h, kind: "glass" });
      if (section.island) zones.push({ x: W / 2 - 34, y: by + section.h / 2 - 12, w: 68, h: 24, kind: "void", hue: -1 });
      // coins sit on the steel above and below the glass
      powerUps.push({ x: rangeOf(r, 40, W - 40), y: by - 30, kind: "coin", taken: false, bob: r() * 6 });
      powerUps.push({ x: rangeOf(r, 40, W - 40), y: by + section.h + 30, kind: "coin", taken: false, bob: r() * 6 });
    } else {
      if (section.kind === "bumper") {
        const bw = section.w ?? 56, bh = 34, by = y + section.y;
        bumpers.push({ x: rangeOf(r, 0, W - bw), y: by, w: bw, h: bh, vx: section.speed, minX: 0, maxX: W - bw, motion: "slide", vy: 0, minY: by, maxY: by, label: "MOM", hue: 5 });
      }
      for (let k = 0; k < 2; k++) powerUps.push({ x: rangeOf(r, 40, W - 40), y: y + rangeOf(r, 40, h - 40), kind: "coin", taken: false, bob: r() * 6 });
    }
    const segment: Segment = { y, h, zones, powerUps, bumpers };
    const art = makeRng(this.seed ^ Math.imul(i, 2654435761));
    const sliders = BUMPER_ITEMS.filter((item) => !item.id.startsWith("bumper-")); // toys hang, they never slide
    for (const bumper of bumpers) { const item = pick(art, sliders); bumper.itemId = item.id; bumper.label = item.label!; bumper.hue = item.hue!; }
    return segment;
  }

  private generate(i: number): Segment {
    if (this.spec) return this.generateFromSpec(i);
    const r = this.rng;
    const y = this.topY - CFG.segmentH;
    const h = CFG.segmentH;
    const difficulty = Math.min(1, i / 40);
    const zones: NoStickZone[] = [];
    const bumpers: Bumper[] = [];
    const powerUps: PowerUp[] = [];

    const kinds = ["solid", "band", "window", "pillar", "stickers", "band", "window"] as const;
    let kind = i < 2 ? "solid" : pick(r, kinds as unknown as (typeof kinds)[number][]);
    // v12: never the same layout two doors in a row (a window over a window, a band under a band)
    if (this.version >= 12) for (let k = 0; k < 4 && kind !== "solid" && kind === this.lastKind; k++) kind = pick(r, kinds as unknown as (typeof kinds)[number][]);
    this.lastKind = kind;

    switch (kind) {
      case "solid": {
        if (r() < 0.6) pushSticker(r, y, h, zones, this.version);
        break;
      }
      case "band": {
        // horizontal non-stick band across the full width. Tall bands need a chain ladder.
        // a solo jump clears ~250px of height; bands stay under that, and the tall ones
        // always carry a metal handle as a stepping stone
        let bandH = rangeOf(r, 110, 150 + difficulty * 60);
        const bandKind = pick(r, ["trim", "glass", "void"] as const);
        // v12: a glass band is the wide bottle door at its own 2:1 proportions, so it is never shorter than 190
        if (bandKind === "glass" && this.version >= 12) bandH = Math.max(bandH, 190);
        const by = y + rangeOf(r, 40, h - bandH - 40);
        zones.push({ x: 0, y: by, w: W, h: bandH, kind: bandKind });
        // v12: a band a solo jump clears (~250 px) needs no handle island; older worlds keep their stepping stones
        if (this.version >= 12 ? bandH > 230 : bandH > 165 || r() < 0.45) {
          const hw = rangeOf(r, 40, 70);
          const hx = rangeOf(r, 20, W - hw - 20);
          zones.push({ x: hx, y: by + bandH * 0.35, w: hw, h: 24, kind: "trim" });
          // "trim" zone here is a spacer; we punch a metal island via the metal list
          zones[zones.length - 1].kind = "void";
          zones[zones.length - 1].hue = -1; // marker: island (metal), see isMetal
        }
        break;
      }
      case "window": {
        // big glass panel, metal only on the sides (or one side)
        // glass panel with a usable steel strip (≥ 56px) on at least one side
        // v12: the window fills its door like the set pieces do (176 wide, 12 px in from the edge and the seam)
        const gw = this.version >= 12 ? 176 : this.version >= 8 ? rangeOf(r, 140, 180) : rangeOf(r, 180, 220 + difficulty * 60);
        const gx = this.version >= 12 ? (r() < 0.5 ? 12 : 212) : this.version >= 8 ? onOneDoor(r, gw) : r() < 0.5 ? rangeOf(r, 56, W - gw - 56) : r() < 0.5 ? 0 : W - gw;
        zones.push({ x: gx, y: y + 20, w: gw, h: h - 40, kind: "glass" });
        // a handle across the glass now and then, as a mid-way hold (dropped in v13: nothing bolts to a glass door;
        // since v8 the window sits on one door and the other door is the lane)
        if (r() < 0.5 && this.version < 13) {
          const hw = rangeOf(r, 50, 80);
          zones.push({ x: gx + rangeOf(r, 10, gw - hw - 10), y: y + rangeOf(r, 90, h - 120), w: hw, h: 24, kind: "void", hue: -1 });
        }
        break;
      }
      case "pillar": {
        // One or two vertical steel strips to climb, with door trim either side.
        // v15: the trim is a BAND, not the whole segment. Filling a segment with
        // plastic was a black wall across the door, which no fridge has; a band
        // leaves steel above and below it and still forces you onto the strips.
        const strips = r() < 0.5 + difficulty * 0.3 ? 1 : 2;
        const sw = rangeOf(r, 56, 80 - difficulty * 14);
        const xs = strips === 1 ? [rangeOf(r, 40, W - sw - 40)] : [rangeOf(r, 20, W / 2 - sw - 20), rangeOf(r, W / 2 + 20, W - sw - 20)];
        const bandH = this.version >= 15 ? Math.round(h * rangeOf(r, 0.34, 0.46)) : h;
        const bandY = this.version >= 15 ? y + Math.round(rangeOf(r, 0.1, 0.9) * (h - bandH)) : y;
        // trim on left of first strip, between, and right of last
        let cursor = 0;
        for (const sx of xs.sort((a, b) => a - b)) {
          if (sx > cursor) zones.push({ x: cursor, y: bandY, w: sx - cursor, h: bandH, kind: "trim" });
          cursor = sx + sw;
        }
        if (cursor < W) zones.push({ x: cursor, y: bandY, w: W - cursor, h: bandH, kind: "trim" });
        break;
      }
      case "stickers": {
        const n = 3 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) pushSticker(r, y, h, zones, this.version);
        break;
      }
    }

    // field plates never go where the steel is already a narrow lane (pillars, windows): a red plate
    // over the only lane makes the door impassable
    const laneSegment = this.version >= 10 && (kind === "pillar" || kind === "window");
    // repel panels show up later
    if (i > 6 && r() < 0.25 + difficulty * 0.3 && !laneSegment) {
      const rw = rangeOf(r, 70, 120);
      const rh = rangeOf(r, 70, 110);
      const m = this.version >= 7 ? SEAM_MARGIN : 10;
      const rx = this.version >= 8 ? onOneDoor(r, rw, 10) : rangeOf(r, 10, W - rw - 10);
      // v9+: plates vary in strength; the odd big one is a slingshot that throws a flier well past its arc
      const big = this.version >= 9 && r() < 0.2;
      const power = this.version >= 9 ? (big ? rangeOf(r, 2, 2.6) : rangeOf(r, 0.6, 1.5)) : 1;
      const rw2 = big ? rw * 1.25 : rw, rh2 = big ? rh * 1.25 : rh;
      // v13: magnets only sit on bare steel; try a few heights before giving the door up
      let plate = { x: Math.min(rx, W - rw2 - 10), y: y + rangeOf(r, m, Math.max(m, h - rh2 - m)), w: rw2, h: rh2 };
      for (let k = 0; k < 3 && this.version >= 13 && blocked(zones, plate); k++) plate = { ...plate, y: y + rangeOf(r, m, Math.max(m, h - rh2 - m)) };
      if (!(this.version >= 13 && blocked(zones, plate))) zones.push({ ...plate, kind: "repel", power });
    }

    // blue attract plates (v5+): pull airborne climbers in, and they are steel, so they catch you
    if (this.version >= 5 && i > 5 && r() < 0.22 + difficulty * 0.25 && !laneSegment) {
      const aw = rangeOf(r, 64, 100);
      const ah = rangeOf(r, 64, 96);
      const m = this.version >= 7 ? SEAM_MARGIN : 10;
      const ax = this.version >= 8 ? onOneDoor(r, aw, 10) : rangeOf(r, 10, W - aw - 10), ay = y + rangeOf(r, m, h - ah - m);
      const clash = zones.some((o) => ax < o.x + o.w + 16 && ax + aw > o.x - 16 && ay < o.y + o.h + 16 && ay + ah > o.y - 16);
      if (!clash) zones.push({ x: ax, y: ay, w: aw, h: ah, kind: "attract", power: this.version >= 9 ? rangeOf(r, 0.7, 1.6) : 1 });
    }

    // v13: toy keychains hang on the steel: no grip (a weak N push nudges you off), swing only when brushed
    // v22: a gadget door and a set piece both throw this segment's zones away and build their own,
    // which is where most stuck-on toys were going. Do not spend one on a door about to be cleared.
    const setPieceDoor = this.version >= 7 ? i >= 5 && i % 5 === 0 && i % 4 !== 0 : i >= 3 && i % 3 === 0;
    const gadgetDoor = this.version >= 4 && i >= 4 && i % 4 === 0;
    const cleared = this.version >= 22 && (setPieceDoor || gadgetDoor);
    if (this.version >= 13 && i > 3 && !cleared && r() < (this.version >= 22 ? 0.6 : 0.3)) {
      const tw = rangeOf(r, 60, 76), th = rangeOf(r, 40, 52);
      const m = SEAM_MARGIN + 60; // room for the hook and chain above
      let toy = { x: onOneDoor(r, tw, 10), y: y + rangeOf(r, m, Math.max(m, h - th - SEAM_MARGIN)), w: tw, h: th };
      // toys keep clear of everything, magnets included (hook and chain need 56 px above the toy)
      const hangs = r() < 0.5;
      // v22: only a toy on a chain needs headroom for its hook. A toy stuck flat on the door needs
      // none, and holding it to the chain's clearance is why they had all but vanished from a
      // crowded door: three tries against an inflated box, and almost every one was refused.
      const head = this.version >= 22 && !hangs ? 0 : 56;
      const tries = this.version >= 22 ? 8 : 3;
      const box = (t: Rect) => ({ ...t, y: t.y - head, h: t.h + head });
      for (let k = 0; k < tries && blocked(zones, box(toy), 16, true); k++) toy = { ...toy, y: y + rangeOf(r, m, Math.max(m, h - th - SEAM_MARGIN)) };
      // half hang on a keychain (plain resin: no field, they just swing when brushed); half are stuck straight on
      // the door by their magnet backing. Those are magnets, so from v18 they are as likely to pull as to push:
      // a negative power flips the same field round, which keeps them ungrippable - an attract ZONE would read
      // as bare steel to isMetal and quietly turn every other toy into a hold.
      const hanging = this.version >= 22 ? hangs : r() < 0.5;
      const pull = this.version >= 18 && r() < 0.5;
      if (!blocked(zones, box(toy), 16, true)) zones.push(hanging
        ? { ...toy, kind: "trim", itemId: `toy:${Math.floor(r() * 6)}`, swing: { angle: 0, vel: 0, cool: 0 } }
        : { ...toy, kind: "repel", power: pull ? -0.2 : 0.2, itemId: `toy:${Math.floor(r() * 6)}` });
    }
    // sliding fridge magnet bumpers
    if (i > 4 && r() < 0.3 + difficulty * 0.5) {
      // v13: sliders are real advertising magnets, drawn at collider size, so the collider is magnet-sized
      const bw = this.version >= 13 ? rangeOf(r, 96, 124) : rangeOf(r, 44, 64);
      const bh = this.version >= 13 ? 60 : 34;
      const by = y + rangeOf(r, 30, h - 60);
      const speed = rangeOf(r, 60, 90 + difficulty * 120) * (r() < 0.5 ? 1 : -1);
      // motion: sideways early; lifts and zig-zags appear as difficulty rises
      const roll = this.version > 0 ? r() : 0;
      const motion = roll < 0.55 - difficulty * 0.25 ? "slide" : roll < 0.8 ? "lift" : "zigzag";
      const span = this.version > 0 ? rangeOf(r, 90, 160) : 0;
      let minY = Math.max(y + 10, by - span / 2), maxY = Math.min(y + h - bh - 10, by + span / 2);
      const vy = motion === "slide" ? 0 : rangeOf(r, 50, 70 + difficulty * 80) * (r() < 0.5 ? 1 : -1);
      // v13: the whole travel box must be clear of EVERY zone (magnets included; a slider covering a plate ruins both).
      // Sliders and zigzags cross the full width; a lift stays in its own column, so it also picks that column here.
      let bx = rangeOf(r, 0, W - bw);
      const box = (yy: number, lo: number, hi: number, xx: number) => motion === "slide"
        ? { x: 0, y: yy, w: W, h: bh } : motion === "lift" ? { x: xx, y: lo, w: bw, h: hi - lo + bh } : { x: 0, y: lo, w: W, h: hi - lo + bh };
      let travel = box(by, minY, maxY, bx);
      let ok = !(this.version >= 13 && (blocked(zones, travel, 8, true) || (motion !== "slide" && maxY - minY < 120)));
      for (let k = 0; k < 6 && !ok; k++) {
        const ny = y + rangeOf(r, 30, h - 60), nx = motion === "lift" ? (r() < 0.5 ? rangeOf(r, 10, DOOR_SEAM.x - bw - 10) : rangeOf(r, DOOR_SEAM.x + DOOR_SEAM.w + 10, W - bw - 10)) : bx;
        const nMin = Math.max(y + 10, ny - span / 2), nMax = Math.min(y + h - bh - 10, ny + span / 2);
        const t = box(ny, nMin, nMax, nx);
        if (!blocked(zones, t, 8, true) && (motion === "slide" || nMax - nMin >= 120)) { ok = true; minY = nMin; maxY = nMax; bx = nx; travel = t; travel.y = motion === "slide" ? ny : nMin; }
      }
      if (this.version >= 13 && motion === "slide") { minY = travel.y; maxY = travel.y; }
      if (ok) bumpers.push({
        x: bx, y: motion === "slide" ? travel.y : Math.min(Math.max(by, minY), maxY), w: bw, h: bh, vx: motion === "lift" ? 0 : speed,
        minX: 0, maxX: W - bw, motion, vy, minY, maxY,
        label: pick(r, ["VEG", "24/7", "A", "M", "PIZZA", "★", "dentist", "MOM"]),
        hue: Math.floor(r() * 360),
      });
    }

    // power-ups: 1-2 per segment
    const pn = 1 + (r() < 0.45 ? 1 : 0);
    const table: PowerKind[] = ["coin", "coin", "coin", "coin", "magnet", "extra", "slowmo", "reach", "coin", "gem"];
    if (this.version > 0) table.push("heart");
    if (this.version >= 13) table.push("candy");
    for (let k = 0; k < pn; k++) {
      let kindP = pick(r, table);
      if (kindP === "gem" && r() < 0.6) kindP = "coin";
      let px = rangeOf(r, 30, W - 30), py = y + rangeOf(r, 30, h - 30);
      // v19: the two pickups in a segment were rolled independently, so they regularly landed
      // on top of each other. The version guard comes first so older worlds consume no extra RNG.
      for (let t = 0; t < 6 && this.version >= 19 && powerUps.some((o) => Math.hypot(o.x - px, o.y - py) < PICKUP_GAP); t++) {
        px = rangeOf(r, 30, W - 30); py = y + rangeOf(r, 30, h - 30);
      }
      powerUps.push({ x: px, y: py, kind: kindP, taken: false, bob: r() * 6 });
    }

    const segment: Segment = { y, h, zones, powerUps, bumpers };
    if (this.version >= 2) {
      // Separate stream keeps the original world RNG and old saved runs intact.
      const art = makeRng(this.seed ^ Math.imul(i, 2654435761));
      const paperPool = this.version >= 6 ? PAPER_ITEMS : PAPER_ITEMS.slice(0, 20);
      // v13: toys hang as keychains (zones below); only the advertising magnets slide
      const bumperPool = this.version >= 13 ? BUMPER_ITEMS.filter(item => !item.id.startsWith("bumper-")) : this.version >= 6 ? BUMPER_ITEMS : BUMPER_ITEMS.filter(item => item.id.startsWith("bumper-"));
      if (this.version >= 3) {
        const used = new Set<string>([this.lastCardId]);
        // v12: also avoid anything shown in the last few doors, so a big library actually reads as variety
        for (const id of this.version >= 12 ? this.recentPapers : []) used.add(id);
        for (const zone of zones) {
          if (zone.kind !== "sticker") continue;
          let choice = pick(art, paperPool);
          for (let k = 0; k < 10 && used.has(choice.id); k++) choice = pick(art, paperPool);
          used.add(choice.id);
          zone.itemId = choice.id;
          this.lastCardId = choice.id;
          this.remember(this.recentPapers, choice.id, 10);
          // v13: a card takes its art's own proportions. Fitting it inside the slot
          // was wrong -- a portrait card in a short wide slot collapsed to a stamp,
          // next to a square one filling its slot. Keep the slot's AREA instead, so
          // every card carries the same visual weight whatever its shape, then back
          // off only if that runs into the segment edge or something already placed.
          const aspect = this.version >= 13 ? PAPER_ASPECT[choice.id] : undefined;
          if (aspect) {
            const others = zones.filter((o) => o !== zone);
            // a floor on the area: the slot a card lands in varies a lot, and a small
            // slot made a portrait card read as a stamp beside a landscape one
            const area = Math.max(zone.w * zone.h, this.version >= 19 ? 20000 : 11000);
            const cx = zone.x + zone.w / 2, cy = zone.y + zone.h / 2;
            let cw = Math.round(Math.sqrt(area * aspect)), ch = Math.round(cw / aspect);
            // a resized card may move, so it must clear the bumper paths too --
            // those were laid down before this pass and expect bare steel
            const paths = bumpers.map((b) => b.motion === "lift"
              ? { x: b.x, y: b.minY, w: b.w, h: b.maxY - b.minY + b.h }
              : b.motion === "slide" ? { x: 0, y: b.y, w: W, h: b.h }
              : { x: 0, y: b.minY, w: W, h: b.maxY - b.minY + b.h });
            const fitsAt = (w: number, h: number, at: Vec) => {
              const x = Math.round(at.x - w / 2), y = Math.round(at.y - h / 2);
              if (x < 6 || x + w > W - 6 || y < segment.y + 6 || y + h > segment.y + segment.h - 6) return false;
              if (blocked(others, { x, y, w, h }, 8, true)) return false;
              return !paths.some((t) => x < t.x + t.w + 8 && x + w + 8 > t.x && y < t.y + t.h + 8 && y + h + 8 > t.y);
            };
            const fits = (w: number, h: number) => fitsAt(w, h, { x: cx, y: cy });
            // v20: move it before shrinking it, and never shrink it into a stamp. A card
            // that cannot be read is not worth placing, so a crowded slot loses the card
            // rather than keeping a 40 px version of it.
            let put = { x: cx, y: cy };
            if (this.version >= 20) {
              const nudges: Vec[] = [{ x: 0, y: 0 }, { x: -26, y: 0 }, { x: 26, y: 0 }, { x: 0, y: -22 }, { x: 0, y: 22 }, { x: -44, y: 0 }, { x: 44, y: 0 }];
              let placed = false;
              for (const n of nudges) {
                const at = { x: cx + n.x, y: cy + n.y };
                if (fitsAt(cw, ch, at)) { put = at; placed = true; break; }
              }
              while (!placed && cw > 104) {
                cw -= 6; ch = Math.round(cw / aspect);
                placed = nudges.some((n) => { const at = { x: cx + n.x, y: cy + n.y }; if (fitsAt(cw, ch, at)) { put = at; return true; } return false; });
              }
              // nothing fits: mark it for removal below rather than leave a stamp behind
              if (!placed) { zone.w = 0; zone.h = 0; continue; }
            } else {
              while (!fits(cw, ch) && cw > 40) { cw -= 6; ch = Math.round(cw / aspect); }
              if (cw < 40) continue;
            }
            zone.w = cw; zone.h = ch; zone.x = Math.round(put.x - cw / 2); zone.y = Math.round(put.y - ch / 2);
          }
        }
        // cards that could not be placed at a readable size leave the segment entirely
        for (let k = zones.length - 1; k >= 0; k--) if (zones[k].w <= 0) zones.splice(k, 1);
      } else {
        for (const zone of zones) if (zone.kind === "sticker") zone.itemId = pick(art, paperPool).id;
      }
      // A real door bin, on the steel: at most ONE in the whole segment, on one door or
      // the other. There is a single bin photo, so two of them anywhere near each other
      // read as wallpaper, side by side across the middle included. It may hang over the
      // seams between panels -- those are drawn, not physical -- and it always spans the
      // door it sits on, at the one size a door bin has.
      if (this.version >= 13) {
        const bin = rule("bin"), min = bin.minZone ?? { w: 80, h: 58 };
        const sides = bin.door === "left" ? [0] : bin.door === "right" ? [1] : bin.door === "span" ? [0, 1] : [art() < 0.5 ? 0 : 1];
        let placed = 0;
        for (const side of sides) {
          if (placed >= bin.max) break;
          // the panel must cover its door, or a door-wide bin would stick out past it
          const lo = side === 0 ? 0 : DOOR_SEAM.x + DOOR_SEAM.w, hi = side === 0 ? DOOR_SEAM.x : W;
          const half = zones.filter((z) => z.kind === "trim" && z.hue !== -1 && !z.itemId && !z.swing
            && z.h >= min.h && z.w >= min.w && z.x <= lo + 10 && z.x + z.w >= hi - 10);
          if (half.length && art() < bin.rate) { half[Math.floor(art() * half.length)].itemId = "plastic"; placed++; }
        }
      }
      // v14 added seven more toys; older worlds keep the original six so their terrain is unchanged
      const toys = BUMPER_ITEMS.filter(item => item.id.startsWith("bumper-") && (this.version >= 14 || Number(item.id.slice(7)) <= 5));
      for (const zone of zones) if (zone.itemId?.startsWith("toy:")) {
        let item = pick(art, toys);
        for (let k = 0; k < 6 && this.recentToys.includes(item.id); k++) item = pick(art, toys);
        this.remember(this.recentToys, item.id, 4); zone.itemId = item.id;
        if (item.id === "bumper-4") { zone.pops = 0b0101010101; zone.popCool = 0; }
      }
      const usedBumpers = new Set<string>(this.version >= 12 ? this.recentBumpers : []);
      for (const bumper of bumpers) {
        let item = pick(art, bumperPool);
        for (let k = 0; k < 10 && this.version >= 12 && usedBumpers.has(item.id); k++) item = pick(art, bumperPool);
        usedBumpers.add(item.id); this.remember(this.recentBumpers, item.id, 8);
        bumper.itemId = item.id; bumper.label = item.label!; bumper.hue = item.hue!;
      }
      // set pieces: every third door before v7, every fifth since (they filled the doors and sat on the seams)
      if (this.version >= 7 ? i >= 5 && i % 5 === 0 && i % 4 !== 0 : i >= 3 && i % 3 === 0) populateSetPiece(segment, pick(art, [...SET_PIECES]), art() < 0.5, this.version);
      if (this.version >= 4 && i >= 4 && i % 4 === 0) {
        const kind = GADGET_KINDS[(i / 4 - 1) % 4];
        // v15: a letter board on the door, not a plastic wall across it. The steel
        // lanes either side are what you climb; the board is what the gadget hangs on.
        segment.zones = this.version >= 15
          ? [{ x: 104, y: y + 74, w: 192, h: 186, kind: "trim" as const }]
          : [{ x: 78, y: y + 20, w: 244, h: 300, kind: "trim" as const }];
        segment.bumpers = [];
        // v16: paper never dangles off a keyring chain. A doodle is a bit of paper,
        // so it only ever turns up under a clip; hard charms take the swinging hook.
        const themes = this.version >= 16 && kind === "swing" ? THEMES.filter((t) => !PAPER_THEMES.has(t)) : [...THEMES];
        let first = "";
        segment.gadgets = [0, 1].map((n) => {
          let theme = pick(art, themes);
          // v12: the two gadgets on a door are never the same theme (no two pancake clips side by side)
          if (this.version >= 12 && n === 1 && theme === first) theme = themes[(themes.indexOf(theme) + 1 + Math.floor(art() * (themes.length - 1))) % themes.length];
          first = theme;
          const g: Gadget = { id: `g${i}-${n}`, itemId: this.pickGadgetItem(art, kind, theme), kind, x: 135 + n * 130, y: y + 105 + n * 125, phase: art() * 6 };
          // hanging things start still and only move when touched: keyrings since v12, clips since v13
          if ((kind === "swing" && this.version >= 12) || (kind === "clip" && this.version >= 13)) g.swing = { angle: 0, vel: 0, cool: 0 };
          // v16: the clip is part of the photo, a real steel clip biting the board.
          // Paper held that way does not sway, so a clip is a fixed grip, not a pendulum.
          if (kind === "clip" && this.version >= 16) g.fixed = true;
          // a spinner or a pinwheel is on a free bearing: it winds up when a climber clips it
          if (kind === "rotor" && FREE_SPIN.has(g.itemId)) g.spin = { extra: 0, vel: 0, cool: 0 };
          // the POP! toy pops on a keyring exactly as it does stuck to the door
          if (g.itemId === "swing-toy-4") { g.pops = 0b0101010101; g.popCool = 0; }
          return g;
        });
        if (powerUps[0]) {
          powerUps[0].x = 32; powerUps[0].y = y + 170;
          // moving it can land it back on the other one, so push that one clear
          const other = powerUps[1];
          if (this.version >= 19 && other && Math.hypot(other.x - 32, other.y - (y + 170)) < PICKUP_GAP)
            other.x = W - 32;
        }
      }
    }
    return segment;
  }

  /** What a toy is touching at this point, for the sound it makes hitting it. */
  materialAt(x: number, y: number): "glass" | "plastic" | "paper" | "ice" | undefined {
    for (const s of this.segments) {
      if (y < s.y - 60 || y > s.y + s.h + 60) continue;
      for (const z of s.zones) {
        if (x < z.x || x > z.x + z.w || y < z.y || y > z.y + z.h) continue;
        if (z.hue === -1 && z.kind === "void") return undefined; // metal island
        if (z.itemId === "ice-tray") return "ice";
        if (z.kind === "glass") return "glass";
        if (z.kind === "trim") return "plastic";
        if (z.kind === "sticker") return "paper";
        if (z.kind === "void") return undefined;
      }
    }
    return undefined;
  }

  /** v13: how much a non-steel surface drags a toy sliding down it (per second). Undefined = nothing to slide on (open gap, bare steel).
   * Ice barely slows anything, glass a little, plastic more, paper grips hardest. */
  slideFriction(x: number, y: number): number | undefined {
    for (const s of this.segments) {
      if (y < s.y - 60 || y > s.y + s.h + 60) continue;
      for (const z of s.zones) {
        if (x < z.x || x > z.x + z.w || y < z.y || y > z.y + z.h) continue;
        if (z.hue === -1 && z.kind === "void") return undefined; // metal island
        if (z.itemId === "ice-tray") return 0.08;
        if (z.kind === "glass" || z.kind === "repel") return 0.7;
        if (z.kind === "trim") return 1.8;
        if (z.kind === "sticker") return this.version >= 15 ? undefined : 3.6;
        if (z.kind === "void") return undefined;
      }
    }
    return undefined;
  }
  /** Whether a point is on stickable stainless steel. */
  isMetal(x: number, y: number, pad = 0): boolean {
    if (x < -pad || x > W + pad) return false;
    if (inRect(x, y, DOOR_SEAM, -pad)) return false;
    for (const g of this.gadgets) if (gadgetContains(g, this.gadgetTime, { x, y })) return !gadgetPose(g, this.gadgetTime).active;
    for (const s of this.segments) {
      if (y < s.y - 60 || y > s.y + s.h + 60) continue;
      // islands (hue -1) are metal and override everything in that segment
      for (const z of s.zones) {
        if (z.hue === -1 && inRect(x, y, z, pad)) return true;
      }
      for (const z of s.zones) {
        if (z.hue === -1 || z.kind === "attract") continue;
        // v15: a photo on a fridge is held there by a magnet, so a magnet holds on it.
        // Paper is scenery you can climb now, not a hole in the door.
        if (this.version >= 15 && z.kind === "sticker" && !z.swing) continue;
        if (this.superGrip && z.kind !== "void" && !z.swing) continue;
        if (inRect(x, y, z, -pad)) return false;
      }
    }
    return true;
  }

  /** Closest legal point from rectangle edge candidates, including narrow metal islands. */
  nearestMetal(x: number, y: number, radius: number): { x: number; y: number } | null {
    if (this.isMetal(x, y)) return { x, y };
    const xs = [x, 0, W], ys = [y];
    const edges = (r: Rect) => {
      xs.push(r.x - 0.1, r.x + 0.1, r.x + r.w - 0.1, r.x + r.w + 0.1);
      ys.push(r.y - 0.1, r.y + 0.1, r.y + r.h - 0.1, r.y + r.h + 0.1);
    };
    edges(DOOR_SEAM);
    for (const g of this.gadgets) if (Math.abs(g.y - y) <= radius + 80) edges(gadgetZone(g, this.gadgetTime));
    for (const s of this.segments) {
      if (y + radius < s.y - 60 || y - radius > s.y + s.h + 60) continue;
      for (const z of s.zones) edges(z);
    }
    let best: { x: number; y: number } | null = null;
    let distance = radius + 0.001;
    for (const cx of xs.filter((v) => Math.abs(v - x) <= radius)) {
      for (const cy of ys.filter((v) => Math.abs(v - y) <= radius)) {
        const d = Math.hypot(cx - x, cy - y);
        if (d <= radius && d < distance && this.isMetal(cx, cy)) { best = { x: cx, y: cy }; distance = d; }
      }
    }
    return best;
  }

  repelAt(x: number, y: number): NoStickZone | null {
    for (const g of this.gadgets) {
      const zone = gadgetZone(g, this.gadgetTime);
      if (zone.kind === "repel" && inRect(x, y, zone, repelReach(zone))) return zone;
    }
    for (const s of this.segments) {
      if (y < s.y - 200 || y > s.y + s.h + 200) continue;
      for (const z of s.zones) if (z.kind === "repel" && inRect(x, y, z, repelReach(z))) return z;
    }
    return null;
  }

  /** Acceleration a field magnet applies at a point: red pushes out, blue pulls in. Shared by the sim and the aim preview. */
  fieldAt(x: number, y: number, withAttract = true): { ax: number; ay: number; repel: NoStickZone | null; attract: NoStickZone | null } {
    let ax = 0, ay = 0;
    const repel = this.repelAt(x, y);
    if (repel) {
      const cx = repel.x + repel.w / 2, cy = repel.y + repel.h / 2;
      const dx = x - cx, dy = y - cy;
      const d = Math.max(20, Math.hypot(dx, dy));
      const f = 1400 * (repel.power ?? 1);
      ax += (dx / d) * f; ay += (dy / d) * f;
    }
    const attract = withAttract ? this.attractAt(x, y) : null;
    if (attract) {
      const cx = attract.x + attract.w / 2, cy = attract.y + attract.h / 2;
      const dx = cx - x, dy = cy - y;
      const d = Math.max(20, Math.hypot(dx, dy));
      const f = 1500 * (attract.power ?? 1);
      ax += (dx / d) * f; ay += (dy / d) * f;
    }
    return { ax, ay, repel, attract };
  }

  /** Nearest blue attract plate whose field (rect + 110px) covers the point. */
  attractAt(x: number, y: number): NoStickZone | null {
    // a polarity toy in its blue phase pulls, exactly as its red phase pushes. This scan was
    // missing, so blue was three seconds of nothing while red threw you across the door.
    for (const g of this.gadgets) {
      const zone = gadgetZone(g, this.gadgetTime);
      if (zone.kind === "attract" && inRect(x, y, zone, attractReach(zone))) return zone;
    }
    for (const s of this.segments) {
      if (y < s.y - 220 || y > s.y + s.h + 220) continue;
      for (const z of s.zones) if (z.kind === "attract" && inRect(x, y, z, attractReach(z))) return z;
    }
    return null;
  }

  get gadgets() { return this.segments.flatMap((s) => s.gadgets ?? []); }
  carrierAt(p: { x: number; y: number }) {
    const g = this.gadgets.find((g) => gadgetContains(g, this.gadgetTime, p) && !gadgetPose(g, this.gadgetTime).active);
    if (!g) return {};
    const hold = gadgetPose(g, this.gadgetTime).hold;
    return { carrierId: g.id, carrierOffset: { x: p.x - hold.x, y: p.y - hold.y } };
  }
  carrierPoint(id: string, offset: { x: number; y: number }) {
    const g = this.gadgets.find((g) => g.id === id); if (!g) return null;
    const p = gadgetPose(g, this.gadgetTime); if (p.active) return null;
    return { x: p.hold.x + offset.x, y: p.hold.y + offset.y };
  }
}

/** Place a sticker; from world version 3 it must not overlap other zones (12px clearance). */
function pushSticker(r: Rng, y: number, h: number, zones: NoStickZone[], version: number) {
  if (version < 3) { zones.push(sticker(r, y, h)); return; }
  for (let attempt = 0; attempt < 8; attempt++) {
    const z = sticker(r, y, h, version);
    const clash = zones.some((o) => z.x < o.x + o.w + 12 && z.x + z.w > o.x - 12 && z.y < o.y + o.h + 12 && z.y + z.h > o.y - 12);
    if (!clash) { zones.push(z); return; }
  }
  // too crowded: skip this sticker rather than pile it on
}

function sticker(r: Rng, y: number, h: number, version = 0): NoStickZone {
  // v15: a card is a thing you look at, so the slot it lands in starts bigger. The
  // old 50..110 range bottomed out at a stamp, and a portrait card in the small end
  // of it was unreadable next to a landscape one in the large end.
  const w = version >= 15 ? rangeOf(r, 84, 132) : rangeOf(r, 50, 110);
  const sh = version >= 15 ? rangeOf(r, 84, 124) : rangeOf(r, 50, 100);
  const m = version >= 7 ? SEAM_MARGIN : 0;
  return { x: version >= 8 ? onOneDoor(r, w) : rangeOf(r, 0, W - w), y: y + rangeOf(r, m, h - sh - m), w, h: sh, kind: "sticker", hue: Math.floor(r() * 360) };
}

/** How far a red plate's push reaches past its edge; strong plates reach much further. */
export const repelReach = (z: { power?: number }) => 20 + Math.max(0, (z.power ?? 1) - 1) * 70;
/** How far a blue plate pulls from. */
export const attractReach = (z: { power?: number }) => 110 * (z.power ?? 1);

/** pad > 0 grows the rect; pad < 0 shrinks it. */
export function inRect(x: number, y: number, r: Rect, pad = 0): boolean {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}
