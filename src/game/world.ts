import { CFG, W } from "./config";
import type { Bumper, NoStickZone, PowerKind, PowerUp, Rect, Segment } from "./types";
import { PAPER_ITEMS, BUMPER_ITEMS } from "./items";
import { populateSetPiece, SET_PIECES } from "./world-patterns";

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

/** The vertical seam between the two fridge doors. Always non-stick. */
export const DOOR_SEAM: Rect = { x: W / 2 - 5, y: -1e9, w: 10, h: 2e9 };

export class World {
  segments: Segment[] = [];
  rng: Rng;
  /** y of the top-most generated segment */
  private topY: number;
  private index = 0;

  readonly seed: number;

  constructor(seed: number, startY: number, readonly version = 2) {
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

  private generate(i: number): Segment {
    const r = this.rng;
    const y = this.topY - CFG.segmentH;
    const h = CFG.segmentH;
    const difficulty = Math.min(1, i / 40);
    const zones: NoStickZone[] = [];
    const bumpers: Bumper[] = [];
    const powerUps: PowerUp[] = [];

    const kinds = ["solid", "band", "window", "pillar", "stickers", "band", "window"] as const;
    const kind = i < 2 ? "solid" : pick(r, kinds as unknown as (typeof kinds)[number][]);

    switch (kind) {
      case "solid": {
        if (r() < 0.6) zones.push(sticker(r, y, h));
        break;
      }
      case "band": {
        // horizontal non-stick band across the full width. Tall bands need a chain ladder.
        // a solo jump clears ~250px of height; bands stay under that, and the tall ones
        // always carry a metal handle as a stepping stone
        const bandH = rangeOf(r, 110, 150 + difficulty * 60);
        const by = y + rangeOf(r, 40, h - bandH - 40);
        const bandKind = pick(r, ["trim", "glass", "void"] as const);
        zones.push({ x: 0, y: by, w: W, h: bandH, kind: bandKind });
        if (bandH > 165 || r() < 0.45) {
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
        const gw = rangeOf(r, 180, 220 + difficulty * 60);
        const gx = r() < 0.5 ? rangeOf(r, 56, W - gw - 56) : r() < 0.5 ? 0 : W - gw;
        zones.push({ x: gx, y: y + 20, w: gw, h: h - 40, kind: "glass" });
        // a handle across the glass now and then, as a mid-way hold
        if (r() < 0.5) {
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
        for (let k = 0; k < n; k++) zones.push(sticker(r, y, h));
        break;
      }
    }

    // repel panels show up later
    if (i > 6 && r() < 0.25 + difficulty * 0.3) {
      const rw = rangeOf(r, 70, 120);
      const rh = rangeOf(r, 70, 110);
      zones.push({ x: rangeOf(r, 10, W - rw - 10), y: y + rangeOf(r, 10, h - rh - 10), w: rw, h: rh, kind: "repel" });
    }

    // sliding fridge magnet bumpers
    if (i > 4 && r() < 0.3 + difficulty * 0.5) {
      const bw = rangeOf(r, 44, 64);
      const bh = 34;
      const by = y + rangeOf(r, 30, h - 60);
      const speed = rangeOf(r, 60, 90 + difficulty * 120) * (r() < 0.5 ? 1 : -1);
      // motion: sideways early; lifts and zig-zags appear as difficulty rises
      const roll = r();
      const motion = roll < 0.55 - difficulty * 0.25 ? "slide" : roll < 0.8 ? "lift" : "zigzag";
      const span = rangeOf(r, 90, 160);
      const minY = Math.max(y + 10, by - span / 2), maxY = Math.min(y + h - bh - 10, by + span / 2);
      const vy = motion === "slide" ? 0 : rangeOf(r, 50, 70 + difficulty * 80) * (r() < 0.5 ? 1 : -1);
      bumpers.push({
        x: rangeOf(r, 0, W - bw), y: by, w: bw, h: bh, vx: motion === "lift" ? 0 : speed,
        minX: 0, maxX: W - bw, motion, vy, minY, maxY,
        label: pick(r, ["VEG", "24/7", "A", "M", "PIZZA", "★", "dentist", "MOM"]),
        hue: Math.floor(r() * 360),
      });
    }

    // power-ups: 1-2 per segment
    const pn = 1 + (r() < 0.45 ? 1 : 0);
    const table: PowerKind[] = ["coin", "coin", "coin", "coin", "magnet", "extra", "slowmo", "reach", "coin", "gem", "heart"];
    for (let k = 0; k < pn; k++) {
      let kindP = pick(r, table);
      if (kindP === "gem" && r() < 0.6) kindP = "coin";
      powerUps.push({ x: rangeOf(r, 30, W - 30), y: y + rangeOf(r, 30, h - 30), kind: kindP, taken: false, bob: r() * 6 });
    }

    const segment = { y, h, zones, powerUps, bumpers };
    if (this.version >= 2) {
      // Separate stream keeps the original world RNG and old saved runs intact.
      const art = makeRng(this.seed ^ Math.imul(i, 2654435761));
      for (const zone of zones) if (zone.kind === "sticker") zone.itemId = pick(art, PAPER_ITEMS).id;
      for (const bumper of bumpers) {
        const item = pick(art, BUMPER_ITEMS);
        bumper.itemId = item.id; bumper.label = item.label!; bumper.hue = item.hue!;
      }
      if (i >= 3 && i % 3 === 0) populateSetPiece(segment, pick(art, [...SET_PIECES]), art() < 0.5);
    }
    return segment;
  }

  /** Whether a point is on stickable stainless steel. */
  isMetal(x: number, y: number, pad = 0): boolean {
    if (x < -pad || x > W + pad) return false;
    if (inRect(x, y, DOOR_SEAM, -pad)) return false;
    for (const s of this.segments) {
      if (y < s.y - 60 || y > s.y + s.h + 60) continue;
      // islands (hue -1) are metal and override everything in that segment
      for (const z of s.zones) {
        if (z.hue === -1 && inRect(x, y, z, pad)) return true;
      }
      for (const z of s.zones) {
        if (z.hue === -1) continue;
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
    for (const s of this.segments) {
      if (y < s.y - 60 || y > s.y + s.h + 60) continue;
      for (const z of s.zones) if (z.kind === "repel" && inRect(x, y, z, 20)) return z;
    }
    return null;
  }
}

function sticker(r: Rng, y: number, h: number): NoStickZone {
  const w = rangeOf(r, 50, 110);
  const sh = rangeOf(r, 50, 100);
  return { x: rangeOf(r, 0, W - w), y: y + rangeOf(r, 0, h - sh), w, h: sh, kind: "sticker", hue: Math.floor(r() * 360) };
}

/** pad > 0 grows the rect; pad < 0 shrinks it. */
export function inRect(x: number, y: number, r: Rect, pad = 0): boolean {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}
