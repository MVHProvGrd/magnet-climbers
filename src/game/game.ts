import { CFG, CLIMBER_COLORS, statsFor, W, type UpgradeKey } from "./config";
import { sfx } from "./audio";
import type { ActiveEffects, Climber, PowerUp, Vec } from "./types";
import { World, inRect } from "./world";

export type Phase = "idle" | "running" | "dead";

export interface RunEvents {
  onPower(kind: PowerUp["kind"], at: Vec): void;
  onGameOver(): void;
  onCoins(n: number): void;
  onGems(n: number): void;
}

/** One run of the game: world, team, physics, camera, slingshot input. */
export class Game {
  world: World;
  climbers: Climber[] = [];
  stats: ReturnType<typeof statsFor>;
  effects: ActiveEffects = { superMagnet: 0, slowmo: 0, reach: 0 };
  phase: Phase = "idle";
  camY = 0;
  floorY: number;
  startY = 0;
  highestY = 0;
  coins = 0;
  gems = 0;
  revivesLeft: number;
  time = 0;
  shake = 0;
  private nextId = 1;
  /** id of the climber the player will launch next */
  selectedId: number | null = null;
  drag: { start: Vec; cur: Vec } | null = null;
  /** fling = slingshot off a teammate; move = crawl hand-over-hand to a new spot */
  mode: "fling" | "move" = "fling";
  /** true after the player pans by hand; the camera stops following until recentered */
  freeCam = false;
  panning: { lastY: number } | null = null;
  /** solo = one climber that flings itself (arcade); crew = teammates fling each other */
  rules: "solo" | "crew" = "crew";
  reserves = 0;
  palette: string[];
  particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
  floats: { x: number; y: number; text: string; life: number; color: string }[] = [];
  viewH = 700;

  constructor(levels: Record<UpgradeKey, number>, private events: RunEvents, opts: { reserves?: number; palette?: string[]; seed?: number; rules?: "solo" | "crew" } = {}) {
    const seed = opts.seed ?? (Date.now() & 0xffffffff);
    this.rules = opts.rules ?? "crew";
    this.palette = opts.palette ?? CLIMBER_COLORS;
    this.reserves = opts.reserves ?? 0;
    this.stats = statsFor(levels);
    this.revivesLeft = this.stats.revives;
    this.startY = 0;
    this.world = new World(seed, 0);
    this.floorY = CFG.floorStartOffset;
    this.highestY = 0;
    this.camY = -this.viewH * 0.55;
    this.spawnTeam(this.rules === "solo" ? 1 : this.stats.teamSize, 0);
    this.world.ensure(-this.viewH * 2);
  }

  private spawnTeam(n: number, y: number) {
    // spawn bunched so everyone is within arm reach of a neighbour
    const gap = Math.min(46, this.stats.reach - 12);
    for (let i = 0; i < n; i++) {
      const x = W / 2 + (i - (n - 1) / 2) * gap;
      this.climbers.push(this.makeClimber(x, y - 40, "stuck"));
    }
    this.pickDefaultSelection();
  }

  private makeClimber(x: number, y: number, state: Climber["state"]): Climber {
    const id = this.nextId++;
    return {
      id, x, y, vx: 0, vy: 0, angle: 0, spin: 0, state,
      color: this.palette[(id - 1) % this.palette.length],
      parent: null, leftLauncher: true, launcherId: null, airTime: 0, squash: 0,
    };
  }

  get heightCm(): number {
    return Math.max(0, Math.round((this.startY - this.highestY) / CFG.pxPerCm));
  }

  get anchored(): Climber[] {
    return this.climbers.filter((c) => c.state === "stuck" || c.state === "linked");
  }

  get alive(): Climber[] {
    return this.climbers.filter((c) => c.state !== "lost");
  }

  byId(id: number | null): Climber | undefined {
    return id == null ? undefined : this.climbers.find((c) => c.id === id);
  }

  /** How many climbers hang off (transitively) this one. */
  chainDepthBelow(c: Climber): number {
    let d = 0;
    for (const o of this.climbers) if (o.parent === c.id && o.state === "linked") d = Math.max(d, 1 + this.chainDepthBelow(o));
    return d;
  }

  /** Number of links between this climber and the metal it ultimately rests on. */
  chainDepthAbove(c: Climber): number {
    let d = 0;
    let cur: Climber | undefined = c;
    while (cur && cur.state === "linked" && cur.parent != null) {
      cur = this.byId(cur.parent);
      d++;
      if (d > 20) break;
    }
    return d;
  }

  pickDefaultSelection() {
    // Prefer the lowest anchored climber nobody hangs on (leap-frog), else lowest anchored.
    const anchored = this.anchored;
    if (anchored.length === 0) { this.selectedId = null; return; }
    const free = anchored.filter((c) => !this.climbers.some((o) => o.parent === c.id && o.state === "linked"));
    const pool = free.length ? free : anchored;
    pool.sort((a, b) => b.y - a.y);
    this.selectedId = pool[0].id;
  }

  // ---------- input ----------

  pointerDown(p: Vec) {
    if (this.phase === "dead") return;
    // finger on an anchored climber → select it and start aiming; elsewhere → pan the camera
    let best: Climber | null = null;
    let bd = 48;
    for (const c of this.anchored) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) {
      this.selectedId = best.id;
      if (this.isLadder(best)) {
        this.floats.push({ x: best.x, y: best.y - 34, text: "someone's hanging on you", life: 1, color: "#ff6b6b" });
        return;
      }
      this.drag = { start: p, cur: p };
      return;
    }
    this.panning = { lastY: p.y };
  }

  pointerMove(p: Vec) {
    if (this.drag) { this.drag.cur = p; return; }
    if (this.panning) {
      const dy = p.y - this.panning.lastY;
      this.camY -= dy;
      this.freeCam = true;
      // p is in world space and moves with the camera, so re-anchor after the shift
      this.panning.lastY = p.y - dy;
    }
  }

  /** Select a climber by id (from the HUD dots) and bring the camera to it. */
  select(id: number) {
    const c = this.byId(id);
    if (!c || c.state === "lost") return;
    this.selectedId = id;
    this.freeCam = false;
  }

  recenter() {
    this.freeCam = false;
  }

  pointerUp() {
    this.panning = null;
    if (!this.drag) return;
    const drag = this.drag;
    const c = this.byId(this.selectedId);
    if (!c || (c.state !== "stuck" && c.state !== "linked")) { this.drag = null; return; }
    if (this.rules === "crew" && (this.mode === "move" || this.isStranded(c))) {
      this.drag = null;
      if (Math.hypot(drag.cur.x - drag.start.x, drag.cur.y - drag.start.y) < CFG.minDrag) return;
      // drop point is where the finger ended, relative to the climber
      this.move(c, { x: c.x + (drag.cur.x - drag.start.x), y: c.y + (drag.cur.y - drag.start.y) });
      return;
    }
    const v = this.launchVector();
    this.drag = null;
    if (!v) return;
    if (this.powerMult(c) === 0) {
      this.floats.push({ x: c.x, y: c.y - 30, text: "STRANDED — no one to fling you", life: 1.2, color: "#ff6b6b" });
      return;
    }
    this.launch(c, v);
  }

  /** Launch velocity implied by the current drag, or null if too short. */
  launchVector(): Vec | null {
    if (!this.drag) return null;
    let dx = this.drag.start.x - this.drag.cur.x;
    let dy = this.drag.start.y - this.drag.cur.y;
    const len = Math.hypot(dx, dy);
    if (len < CFG.minDrag) return null;
    const capped = Math.min(len, CFG.maxDrag);
    dx = (dx / len) * capped;
    dy = (dy / len) * capped;
    const c = this.byId(this.selectedId);
    const mult = c ? this.powerMult(c) : 1;
    const s = CFG.launchScale * this.stats.launchMult * (mult || 1);
    return { x: dx * s, y: dy * s };
  }

  launch(c: Climber, v: Vec) {
    if (this.isLadder(c)) return;
    if (this.phase === "idle") this.phase = "running";
    // anything hanging on this climber loses its grip
    for (const o of this.climbers) {
      if (o.parent === c.id && o.state === "linked") this.detach(o);
    }
    c.state = "flying";
    c.parent = null;
    c.vx = v.x;
    c.vy = v.y;
    c.spin = (Math.random() - 0.5) * 14;
    c.leftLauncher = false;
    c.launcherId = this.launcherFor(c)?.id ?? null;
    c.airTime = 0;
    c.squash = 1;
    sfx.launch();
    this.burst(c.x, c.y, c.color, 6);
    this.selectedId = c.id;
    this.freeCam = false;
  }

  private detach(o: Climber) {
    // try to grab another anchor first
    const other = this.nearestAnchor(o, o.parent);
    if (other) {
      o.parent = other.id;
      return;
    }
    o.state = "flying";
    o.parent = null;
    o.vx = 0;
    o.vy = 0;
    o.leftLauncher = true;
    o.launcherId = null;
    o.airTime = 0;
  }

  private nearestAnchor(c: Climber, excludeId: number | null): Climber | null {
    const reach = this.currentReach();
    let best: Climber | null = null;
    let bd = reach;
    for (const o of this.anchored) {
      if (o.id === c.id || o.id === excludeId) continue;
      if (this.chainDepthAbove(o) >= this.stats.maxLinks) continue;
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /** The anchored teammate that will do the stretching for this climber, if any. */
  launcherFor(c: Climber): Climber | null {
    const reach = this.currentReach();
    if (c.state === "linked") {
      const p = this.byId(c.parent);
      if (p && (p.state === "stuck" || p.state === "linked")) return p;
    }
    let best: Climber | null = null;
    let bd = reach + 4;
    for (const o of this.anchored) {
      if (o.id === c.id) continue;
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /** How many anchored teammates are braced within reach of the launcher (the launcher included). */
  braceCount(c: Climber): number {
    const l = this.launcherFor(c);
    if (!l) return 0;
    const reach = this.currentReach();
    let n = 0;
    for (const o of this.anchored) {
      if (o.id === c.id) continue;
      if (Math.hypot(o.x - l.x, o.y - l.y) <= reach + 4) n++;
    }
    return Math.min(3, n);
  }

  /** Everyone flings themselves now; kept as a hook for per-colour abilities. */
  powerMult(_c: Climber): number {
    return 1;
  }

  /** Someone is hanging off this climber, so it is a ladder rung and cannot fling. */
  isLadder(c: Climber): boolean {
    return this.climbers.some((o) => o.parent === c.id && o.state === "linked");
  }

  isStranded(_c: Climber): boolean {
    return false;
  }

  /** How far a climber can crawl hand-over-hand in one move. */
  pullRange(): number {
    return this.currentReach() * 2.6;
  }

  /** Where a move would land, or null if the drop is out of range / has nothing to hold. */
  moveTarget(c: Climber, p: Vec): { x: number; y: number; parent: number | null } | null {
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < 6) return null;
    const range = this.pullRange();
    let tx = p.x, ty = p.y;
    if (d > range) { tx = c.x + ((p.x - c.x) / d) * range; ty = c.y + ((p.y - c.y) / d) * range; }
    tx = Math.max(CFG.climberRadius, Math.min(W - CFG.climberRadius, tx));
    // short shuffle on bare metal
    if (Math.hypot(tx - c.x, ty - c.y) <= this.currentReach() * 1.1 && this.world.isMetal(tx, ty, this.stats.magnetRadius)) {
      return { x: tx, y: ty, parent: null };
    }
    // otherwise hang on an anchored teammate near the drop point
    const reach = this.currentReach();
    let best: Climber | null = null;
    let bd = reach;
    for (const o of this.anchored) {
      if (o.id === c.id) continue;
      if (this.chainDepthAbove(o) >= this.stats.maxLinks) continue;
      // cannot hang on someone who is hanging on you
      let q: Climber | undefined = o; let cyc = false;
      for (let i = 0; q && i < 20; i++) { if (q.parent === c.id) { cyc = true; break; } q = this.byId(q.parent); }
      if (cyc) continue;
      const dd = Math.hypot(o.x - tx, o.y - ty);
      if (dd < bd) { bd = dd; best = o; }
    }
    if (!best) return null;
    const dx = tx - best.x, dy = ty - best.y;
    const dd = Math.hypot(dx, dy) || 1;
    const r = Math.min(dd, reach - 4);
    return { x: best.x + (dx / dd) * r, y: best.y + (dy / dd) * r, parent: best.id };
  }

  /** Crawl / reel a climber to a new hold. */
  move(c: Climber, p: Vec) {
    const t = this.moveTarget(c, p);
    if (!t) { this.floats.push({ x: c.x, y: c.y - 30, text: "out of reach", life: 0.9, color: "#ff6b6b" }); return; }
    if (this.phase === "idle") this.phase = "running";
    for (const o of this.climbers) if (o.parent === c.id && o.state === "linked") this.detach(o);
    c.x = t.x; c.y = t.y;
    c.vx = 0; c.vy = 0;
    c.squash = 1;
    if (t.parent == null) { c.state = "stuck"; c.parent = null; c.angle = 0; sfx.stick(); }
    else {
      const a = this.byId(t.parent)!;
      c.state = "linked"; c.parent = a.id;
      c.angle = Math.atan2(c.y - a.y, c.x - a.x) + Math.PI / 2;
      sfx.link();
    }
    this.markHeight(c);
    this.pickDefaultSelection();
  }

  /** Spend a reserve to drop a fresh climber onto the highest anchor. */
  callReserve(): boolean {
    if (this.reserves <= 0) return false;
    const anchored = this.anchored;
    if (anchored.length === 0) return false;
    const top = anchored.reduce((m, c) => (c.y < m.y ? c : m));
    this.reserves--;
    const n = this.makeClimber(top.x, top.y - 120, "flying");
    n.vy = -60; n.leftLauncher = true; n.airTime = 0;
    this.climbers.push(n);
    sfx.power();
    this.floats.push({ x: top.x, y: top.y - 60, text: "RESERVE!", life: 1, color: n.color });
    return true;
  }

  /** Stepped ramp per 50cm, capped, with a catch-up nudge when the crew is far ahead. */
  wallSpeed(): number {
    const steps = Math.floor(this.heightCm / CFG.floorStepCm);
    let mult = Math.min(CFG.floorCapMult, 1 + steps * CFG.floorStepMult);
    const alive = this.alive;
    if (alive.length) {
      const lowest = Math.max(...alive.map((c) => c.y));
      if (this.floorY - lowest > CFG.floorCatchupGap) mult *= CFG.floorCatchupMult;
    }
    return CFG.floorBase * mult * this.stats.floorMult;
  }

  currentReach(): number {
    return this.stats.reach + (this.effects.reach > 0 ? 40 : 0);
  }

  // ---------- simulation ----------

  update(dt: number) {
    this.time += dt;
    const slow = this.effects.slowmo > 0 ? 0.45 : 1;
    const sdt = dt * slow;
    for (const k of Object.keys(this.effects) as (keyof ActiveEffects)[]) {
      if (this.effects[k] > 0) this.effects[k] = Math.max(0, this.effects[k] - dt);
    }

    if (this.phase === "running") this.floorY -= this.wallSpeed() * sdt;

    // bumpers
    for (const s of this.world.segments) {
      for (const b of s.bumpers) {
        b.x += b.vx * sdt;
        if (b.x < b.minX) { b.x = b.minX; b.vx = Math.abs(b.vx); }
        if (b.x > b.maxX) { b.x = b.maxX; b.vx = -Math.abs(b.vx); }
      }
    }

    for (const c of this.climbers) {
      if (c.state === "flying") this.stepFlying(c, sdt);
      else if (c.state === "stuck" || c.state === "linked") this.stepAnchored(c, sdt);
      c.squash = Math.max(0, c.squash - dt * 3);
    }

    // floor claims
    for (const c of this.climbers) {
      if (c.state !== "lost" && c.y > this.floorY + 10) this.lose(c);
      if (c.state === "flying" && c.y > this.camY + this.viewH + 200) this.lose(c);
    }
    // hanging chains whose parent vanished
    for (const c of this.climbers) {
      if (c.state === "linked") {
        const p = this.byId(c.parent);
        if (!p || (p.state !== "stuck" && p.state !== "linked")) this.detach(c);
      }
    }
    if (!this.byId(this.selectedId) || this.byId(this.selectedId)!.state === "lost") {
      this.pickDefaultSelection();
    }

    // camera follows the active climber unless the player has panned away
    const sel = this.byId(this.selectedId);
    if (sel && !this.freeCam) {
      const target = sel.y - this.viewH * 0.55;
      this.camY += (target - this.camY) * Math.min(1, dt * 5);
    }
    this.world.ensure(this.camY - this.viewH);

    // particles / floats
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floats) { f.y -= 40 * dt; f.life -= dt; }
    this.floats = this.floats.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt * 3);

    if (this.phase === "running" && this.alive.length === 0) {
      this.phase = "dead";
      sfx.over();
      this.events.onGameOver();
    }
  }

  private stepFlying(c: Climber, dt: number) {
    c.airTime += dt;
    c.vy += CFG.gravity * dt;
    // repel panels push
    const rz = this.world.repelAt(c.x, c.y);
    if (rz) {
      const cx = rz.x + rz.w / 2, cy = rz.y + rz.h / 2;
      const dx = c.x - cx, dy = c.y - cy;
      const d = Math.max(20, Math.hypot(dx, dy));
      c.vx += (dx / d) * 1400 * dt;
      c.vy += (dy / d) * 1400 * dt;
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.angle += c.spin * dt;
    // walls: bounce softly off the edges of the fridge
    if (c.x < CFG.climberRadius) { c.x = CFG.climberRadius; c.vx = Math.abs(c.vx) * 0.5; }
    if (c.x > W - CFG.climberRadius) { c.x = W - CFG.climberRadius; c.vx = -Math.abs(c.vx) * 0.5; }

    // bumpers knock
    for (const s of this.world.segments) {
      for (const b of s.bumpers) {
        if (inRect(c.x, c.y, b, CFG.climberRadius * 0.7)) {
          const bx = b.x + b.w / 2;
          c.vx = (c.x < bx ? -1 : 1) * CFG.bumperKnock + b.vx;
          c.vy = -Math.abs(c.vy) * 0.3 + 60;
          c.x += c.vx * 0.03;
          sfx.bump();
          this.shake = 0.6;
          this.burst(c.x, c.y, "#ffffff", 8);
        }
      }
    }

    // power-ups
    for (const s of this.world.segments) {
      for (const p of s.powerUps) {
        if (!p.taken && Math.hypot(p.x - c.x, p.y - c.y) < CFG.powerRadius) this.collect(p, c);
      }
    }

    // leave the launcher's reach before being allowed to re-grab teammates
    if (!c.leftLauncher) {
      const l = this.byId(c.launcherId);
      if (!l || Math.hypot(l.x - c.x, l.y - c.y) > this.currentReach() + 6) c.leftLauncher = true;
    }

    // magnet catch: on/after apex (or super magnet: any time) over metal
    const catchUp = this.effects.superMagnet > 0 ? 9999 : this.stats.magnetCatch;
    if (c.vy > -catchUp && c.airTime > 0.08) {
      const pad = this.stats.magnetRadius + (this.effects.superMagnet > 0 ? 30 : 0);
      if (this.world.isMetal(c.x, c.y, pad)) {
        this.stick(c);
        return;
      }
    }
    // teammate grab: after apex, within reach of an anchored teammate with chain room
    if (c.vy > -60 && c.leftLauncher && c.airTime > 0.15) {
      const a = this.nearestAnchor(c, null);
      if (a) {
        c.state = "linked";
        c.parent = a.id;
        c.vx = 0; c.vy = 0;
        // clamp to reach
        const dx = c.x - a.x, dy = c.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const r = Math.min(d, this.currentReach() - 4);
        c.x = a.x + (dx / d) * r;
        c.y = a.y + (dy / d) * r;
        c.angle = Math.atan2(dy, dx) + Math.PI / 2;
        c.squash = 1;
        sfx.link();
        this.burst(c.x, c.y, a.color, 5);
        this.markHeight(c);
        this.floats.push({ x: c.x, y: c.y - 30, text: "GRAB!", life: 0.8, color: "#fff" });
        return;
      }
    }
  }

  private stepAnchored(c: Climber, dt: number) {
    // a stuck climber hit by a bumper is knocked loose
    if (c.state === "stuck") {
      for (const s of this.world.segments) {
        for (const b of s.bumpers) {
          if (inRect(c.x, c.y, b, CFG.climberRadius * 0.5)) {
            c.state = "flying";
            c.vx = (b.vx > 0 ? 1 : -1) * 200;
            c.vy = 120;
            c.leftLauncher = true;
            c.airTime = 0;
            sfx.bump();
            this.shake = 0.5;
          }
        }
      }
    }
    // ease angle toward the resting pose
    const target = c.state === "stuck" ? 0 : c.angle;
    c.angle += (target - c.angle) * Math.min(1, dt * 8);
  }

  private stick(c: Climber) {
    c.state = "stuck";
    c.parent = null;
    c.vx = 0; c.vy = 0; c.spin = 0;
    c.squash = 1;
    sfx.stick();
    this.burst(c.x, c.y, "#dfe6ee", 5);
    this.markHeight(c);
  }

  private markHeight(c: Climber) {
    if (c.y < this.highestY) this.highestY = c.y;
  }

  private lose(c: Climber) {
    if (c.state === "lost") return;
    c.state = "lost";
    c.parent = null;
    sfx.lost();
    this.floats.push({ x: c.x, y: Math.min(c.y, this.camY + this.viewH - 40), text: "lost!", life: 1, color: "#ff6b6b" });
  }

  private collect(p: PowerUp, c: Climber) {
    p.taken = true;
    const d = CFG.effectDurations;
    switch (p.kind) {
      case "coin": this.coins += CFG.coinValue; sfx.coin(); this.events.onCoins(CFG.coinValue); this.floats.push({ x: p.x, y: p.y, text: `+${CFG.coinValue}`, life: 0.9, color: "#ffd23f" }); break;
      case "gem": this.gems += 1; sfx.coin(); this.events.onGems(1); this.floats.push({ x: p.x, y: p.y, text: "+1 gem", life: 1, color: "#7ef0ff" }); break;
      case "magnet": this.effects.superMagnet = d.superMagnet; sfx.power(); this.floats.push({ x: p.x, y: p.y, text: "SUPER MAGNET", life: 1.2, color: "#ff4d4d" }); break;
      case "slowmo": this.effects.slowmo = d.slowmo; sfx.power(); this.floats.push({ x: p.x, y: p.y, text: "SLOW-MO", life: 1.2, color: "#c77dff" }); break;
      case "reach": this.effects.reach = d.reach; sfx.power(); this.floats.push({ x: p.x, y: p.y, text: "LONG ARMS", life: 1.2, color: "#9be15d" }); break;
      case "extra": {
        const n = this.makeClimber(p.x, p.y, "flying");
        n.vx = (Math.random() - 0.5) * 100; n.vy = -80; n.airTime = 0; n.leftLauncher = true;
        this.climbers.push(n);
        sfx.power();
        this.floats.push({ x: p.x, y: p.y, text: "+1 FRIEND", life: 1.2, color: n.color });
        break;
      }
    }
    this.burst(p.x, p.y, "#ffffff", 8);
    this.events.onPower(p.kind, { x: p.x, y: p.y });
    void c;
  }

  private burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.4 + Math.random() * 0.4, color });
    }
  }

  /** Bring the team back at the highest point reached, after a game over. */
  revive(useToken: boolean) {
    if (useToken) this.revivesLeft = Math.max(0, this.revivesLeft - 1);
    const y = this.highestY;
    // find a metal spot near the highest point
    let sy = y;
    for (let tries = 0; tries < 40; tries++) {
      if (this.world.isMetal(W * 0.3, sy) || this.world.isMetal(W * 0.7, sy)) break;
      sy += 20;
    }
    const n = this.rules === "solo" ? 1 : Math.max(2, Math.min(this.stats.teamSize, 3));
    for (let i = 0; i < n; i++) {
      const x = this.world.isMetal(W * 0.3, sy) ? W * 0.3 + i * 30 : W * 0.7 - i * 30;
      const c = this.makeClimber(x, sy, "stuck");
      this.climbers.push(c);
    }
    this.floorY = sy + CFG.floorStartOffset;
    this.phase = "running";
    this.pickDefaultSelection();
    this.effects.slowmo = 2;
  }
}
