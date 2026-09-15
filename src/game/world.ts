import { CFG, W } from "./config";
import type { Gadget, Bumper, NoStickZone, PowerKind, PowerUp, Rect, Segment, Vec } from "./types";
import { PAPER_ITEMS, BUMPER_ITEMS, PAPER_ASPECT } from "./items";
import { populateSetPiece, SET_PIECES } from "./world-patterns";
import type { Section } from "./expeditions";
import { gadgetContains, gadgetPose, gadgetZone, GADGET_KINDS, THEMES } from "./gadgets";

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
  private remember(list: string[], id: string, keep: number) { list.push(id); while (list.length > keep) list.shift(); }
  /** Swings are damped pendulums (Codex's motion study: a = -9.8 sin θ - 1.4 ω). Still until something touches them. */
  /** everything that hangs: gadgets and toy keychain zones */
  private get hanging(): { swing?: { angle: number; vel: number; cool: number } }[] {
    return [...this.gadgets, ...this.segments.flatMap((s) => s.zones.filter((z) => z.swing))];
  }
  stepGadgets(dt: number) {
    for (const seg of this.segments) for (const z of seg.zones) if (z.popCool) z.popCool = Math.max(0, z.popCool - dt);
    for (const g of this.hanging) {
      const s = g.swing; if (!s) continue;
      s.cool = Math.max(0, s.cool - dt);
      s.vel += (-9.8 * Math.sin(s.angle) - 1.4 * s.vel) * dt;
      s.angle += s.vel * dt;
    }
  }
  /** Knock a swing: dir is the travel direction (sign of x velocity), strength 0..1. Capped at ±3 rad/s like the study. */
  bumpGadget(id: string, dir: number, strength = 1) {
    const g = this.gadgets.find((g) => g.id === id); const s = g?.swing; if (!s) return;
    s.vel = Math.max(-3, Math.min(3, s.vel + 1.5 * (dir || 1) * Math.max(0.25, strength)));
    s.cool = 0.3;
  }
  /** A flying climber passing through the hanging charm knocks it (once per pass). */
  knockSwings(p: Vec, vx: number) {
    for (const g of this.gadgets) {
      const s = g.swing; if (!s || s.cool > 0) continue;
      const pose = gadgetPose(g, this.gadgetTime);
      if (Math.hypot(p.x - pose.x, p.y - pose.y) < 30) this.bumpGadget(g.id, Math.sign(vx), Math.min(1, Math.abs(vx) / 300));
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
      }
    }
  }
  /** last bubble flipped this frame (the game turns it into a sound), cleared by the game */
  popped: { index: number; inward: boolean } | null = null;
  rng: Rng;
  /** y of the top-most generated segment */
  private topY: number;
  private index = 0;

  readonly seed: number;

  /** last paper card used, so consecutive segments do not repeat it */
  private lastCardId = "";

  /** Expedition recipe; when set, segments come from it instead of the endless generator. */
  spec: Section[] | null = null;

  constructor(seed: number, startY: number, readonly version = 13, spec: Section[] | null = null) {
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
    for (const bumper of bumpers) { const item = pick(art, BUMPER_ITEMS); bumper.itemId = item.id; bumper.label = item.label!; bumper.hue = item.hue!; }
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
        // whole segment is plastic trim except one or two vertical metal strips
        const strips = r() < 0.5 + difficulty * 0.3 ? 1 : 2;
        const sw = rangeOf(r, 56, 80 - difficulty * 14);
        const xs = strips === 1 ? [rangeOf(r, 40, W - sw - 40)] : [rangeOf(r, 20, W / 2 - sw - 20), rangeOf(r, W / 2 + 20, W - sw - 20)];
        // trim on left of first strip, between, and right of last
        let cursor = 0;
        for (const sx of xs.sort((a, b) => a - b)) {
          if (sx > cursor) zones.push({ x: cursor, y, w: sx - cursor, h, kind: "trim" });
          cursor = sx + sw;
        }
        if (cursor < W) zones.push({ x: cursor, y, w: W - cursor, h, kind: "trim" });
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
    if (this.version >= 13 && i > 3 && r() < 0.3) {
      const tw = rangeOf(r, 60, 76), th = rangeOf(r, 40, 52);
      const m = SEAM_MARGIN + 60; // room for the hook and chain above
      let toy = { x: onOneDoor(r, tw, 10), y: y + rangeOf(r, m, Math.max(m, h - th - SEAM_MARGIN)), w: tw, h: th };
      // toys keep clear of everything, magnets included (hook and chain need 56 px above the toy)
      for (let k = 0; k < 3 && blocked(zones, { ...toy, y: toy.y - 56, h: toy.h + 56 }, 16, true); k++) toy = { ...toy, y: y + rangeOf(r, m, Math.max(m, h - th - SEAM_MARGIN)) };
      // half hang on a keychain (plain resin: no field, they just swing when brushed); half are stuck straight on the
      // door by their magnet backing (a weak N push, no grip)
      const hanging = r() < 0.5;
      if (!blocked(zones, { ...toy, y: toy.y - 56, h: toy.h + 56 }, 16, true)) zones.push(hanging
        ? { ...toy, kind: "trim", itemId: `toy:${Math.floor(r() * 6)}`, swing: { angle: 0, vel: 0, cool: 0 } }
        : { ...toy, kind: "repel", power: 0.2, itemId: `toy:${Math.floor(r() * 6)}` });
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
      // v13: the whole travel box must be steel (a slider crosses the full width; lifts and zigzags climb too)
      let travel = { x: 0, y: motion === "slide" ? by : minY, w: W, h: motion === "slide" ? bh : maxY - minY + bh };
      let ok = !(this.version >= 13 && blocked(zones, travel, 8));
      for (let k = 0; k < 4 && !ok; k++) {
        const ny = y + rangeOf(r, 30, h - 60);
        const nMin = Math.max(y + 10, ny - span / 2), nMax = Math.min(y + h - bh - 10, ny + span / 2);
        travel = { x: 0, y: motion === "slide" ? ny : nMin, w: W, h: motion === "slide" ? bh : nMax - nMin + bh };
        if (!blocked(zones, travel, 8)) { ok = true; minY = nMin; maxY = nMax; travel.y = motion === "slide" ? ny : nMin; }
      }
      if (this.version >= 13 && motion === "slide") { minY = travel.y; maxY = travel.y; }
      if (ok) bumpers.push({
        x: rangeOf(r, 0, W - bw), y: motion === "slide" ? travel.y : Math.min(Math.max(by, minY), maxY), w: bw, h: bh, vx: motion === "lift" ? 0 : speed,
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
      powerUps.push({ x: rangeOf(r, 30, W - 30), y: y + rangeOf(r, 30, h - 30), kind: kindP, taken: false, bob: r() * 6 });
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
          // v13: a photographed paper keeps its own proportions (shrink to fit rather than crop)
          const aspect = this.version >= 13 ? PAPER_ASPECT[choice.id] : undefined;
          if (aspect) {
            const others = zones.filter((o) => o !== zone);
            let cw = zone.w, ch = Math.round(cw / aspect);
            // only ever shrink inside the card's own rectangle, so nothing placed earlier can be overlapped
            while (ch > zone.h || blocked(others, { x: zone.x, y: zone.y, w: cw, h: ch }, 8, true)) {
              cw -= 6; ch = Math.round(cw / aspect); if (cw < 40) break;
            }
            if (cw >= 40) { zone.w = cw; zone.h = ch; }
          }
        }
      } else {
        for (const zone of zones) if (zone.kind === "sticker") zone.itemId = pick(art, paperPool).id;
      }
      const toys = BUMPER_ITEMS.filter(item => item.id.startsWith("bumper-"));
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
        segment.zones = [{ x: 78, y: y + 20, w: 244, h: 300, kind: "trim" }];
        segment.bumpers = [];
        const themes = [...THEMES]; let first = "";
        segment.gadgets = [0, 1].map((n) => {
          let theme = pick(art, themes);
          // v12: the two gadgets on a door are never the same theme (no two pancake clips side by side)
          if (this.version >= 12 && n === 1 && theme === first) theme = themes[(themes.indexOf(theme) + 1 + Math.floor(art() * 2)) % themes.length];
          first = theme;
          const g: Gadget = { id: `g${i}-${n}`, itemId: `${kind}-${theme}`, kind, x: 135 + n * 130, y: y + 105 + n * 125, phase: art() * 6 };
          // hanging things start still and only move when touched: keyrings since v12, clips since v13
          if ((kind === "swing" && this.version >= 12) || (kind === "clip" && this.version >= 13)) g.swing = { angle: 0, vel: 0, cool: 0 };
          return g;
        });
        if (powerUps[0]) { powerUps[0].x = 32; powerUps[0].y = y + 170; }
      }
    }
    return segment;
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
        if (z.kind === "sticker") return 3.6;
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
  const w = rangeOf(r, 50, 110);
  const sh = rangeOf(r, 50, 100);
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
