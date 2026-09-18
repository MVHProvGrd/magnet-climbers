import { CFG, CLIMBER_COLORS, statsFor, W, type UpgradeKey } from "./config";
import { sfx, playObjectSound, playBubbleSound, stopPullSound } from "./audio";
import { silentAudio, type GameAudio } from "./silent-audio";
import type { ActiveEffects, Climber, NoStickZone, PowerUp, Vec } from "./types";
import { World, DOOR_SEAM, inRect, makeRng } from "./world";
import { gadgetZone } from "./gadgets";
import { Recorder } from "./recorder";
import { attachGrip, braceLanding, cloneGrip, findContacts, limbTip, settleGrip, stepGrip } from "./magnetism";
import { cloneRagdoll, resetRagdoll, stepRagdoll } from "./ragdoll";
import { handTouches, handWorldPoint, RECOIL_DURATION, SWIPE_DURATION, type KidHand } from "./kid-hand";
import { pawPose, PAW_DURATION, PAW_TAPS, PAW_WARN, CLAW_TIPS, SCRATCH_LIFE, type CatPaw, type Scratch } from "./cat-paw";
import { cloneTricks, freshTricks, type TrickState } from "./tricks";
import { patternColors, type Look } from "./creatures";

export type Phase = "idle" | "running" | "dead";
/** How far a clip tips when a climber hangs off one end of its bar. */
const TIP_ANGLE = 0.22;
/** How a climber was lost. The lost card turns this into a line of prose. */
export type DeathCause = "redline" | "fell" | "paw" | "hand" | "bumper" | "flings";

/** Everything needed to resume a run after the page is closed or reloaded. */
export interface RunSnapshot {
  v: 1;
  rules: "solo" | "crew";
  chill?: boolean;
  seed: number;
  worldVersion?: number;
  gadgetTime?: number;
  /** the run-long pickup tally, so a resumed climb does not forget what it has found */
  runCoins?: number;
  runGems?: number;
  /**
   * What the door was doing, per gadget, at the moment it was put down. The world itself
   * rebuilds from the seed, but stepGadgets mutates each gadget as the run goes -- a toy
   * swinging, a spinner still coasting from a knock, a cooldown part way through -- and none
   * of that is derivable. Left out, every gadget snapped back to rest on resume, which threw
   * a climber riding one straight off it.
   */
  gadgetState?: { id: string; hitCool?: number; popCool?: number; needle?: number; pops?: number;
    swing?: { angle: number; vel: number; cool: number };
    spin?: { extra: number; vel: number; cool: number } }[];
  runTime?: number;
  feats?: RunFeats;
  tricks?: TrickState;
  hand?: Omit<KidHand, "hit"> & { hit: number[] };
  paw?: Omit<CatPaw, "hit"> & { hit: number[] };
  handCount?: number;
  nextHandAt?: number;
  generated: number;
  climbers: Climber[];
  nextId: number;
  floorY: number;
  highestY: number;
  camY: number;
  coins: number;
  gems: number;
  reserves: number;
  revivesLeft: number;
  effects: ActiveEffects;
  time: number;
  sync: boolean;
  selectedId: number | null;
  /** power-ups already taken, keyed by segment y and index */
  taken: string[];
  bumpers: { y: number; i: number; x: number; vx: number; by?: number; vy?: number }[];
  pendingLaunches?: { id: number; v: Vec; at: number }[];
}

/** Facts about the run that creature unlocks are checked against. Not gameplay. */
export interface RunFeats {
  maxChain: number; gadgetRides: number; hits: number; paints: number;
  /** the height reached before the first hit, which is what "without taking a hit" means: a hit later does not take it back */
  unhurtCm?: number;
}

export interface RunEvents {
  onPower(kind: PowerUp["kind"], at: Vec): void;
  onGameOver(): void;
  onCoins(n: number): void;
  onGems(n: number): void;
}

/** One run of the game: world, team, physics, camera, slingshot input. */
export class Game {
  tricks = freshTricks();
  world: World;
  climbers: Climber[] = [];
  stats: ReturnType<typeof statsFor>;
  effects: ActiveEffects = { superMagnet: 0, slowmo: 0, reach: 0, candy: 0 };
  phase: Phase = "idle";
  camY = 0;
  floorY: number;
  startY = 0;
  highestY = 0;
  coins = 0;
  gems = 0;
  revivesLeft: number;
  /**
   * Unscaled and counted from the first update, idle included. It is what the recorder stamps
   * events with, and both halves of that matter: `runTime` slows to 0.45 under a Kitchen Timer,
   * so its stamps drift off the step grid; and the steps taken before the first fling are not
   * inert - clips swing and gadgets turn while the player is still looking - so a replay that
   * skipped them would start from a different door and diverge on the first catch.
   */
  time = 0;
  shake = 0;
  nextId = 1;
  /** id of the climber the player will launch next */
  selectedId: number | null = null;
  drag: { start: Vec; cur: Vec } | null = null;
  /** fling = slingshot off a teammate; move = crawl hand-over-hand to a new spot */
  mode: "fling" | "move" = "fling";

  /** SYNC: one drag flings every free climber with the same vector */
  sync = true;
  /**
   * What took the last climber, so the lost card can say it. Set wherever a climber is
   * lost; the final one to go is the one the card reports, which is the one the player
   * just watched. "flings" is the expedition case: the budget ran out, nothing killed you.
   */
  lastCause: DeathCause | null = null;
  /** the cat's paw tapping down from the top of the screen (v13); null when idle */
  paw: CatPaw | null = null;
  /** claw marks left on the door by the paw; cosmetic, short-lived, bounded */
  scratches: Scratch[] = [];
  /** the kid's hand sweeping across the door; null when idle */
  hand: KidHand | null = null;
  nextHandAt = CFG.handFirstAfter;
  private handCount = 0;
  /** friend's height to beat, from a challenge link */
  target: { cm: number; name: string; beaten: boolean } | null = null;
  /** the player's own best in this mode, drawn as a line on the door; beaten once per run */
  best: { cm: number; beaten: boolean } | null = null;
  /** flying climbers latch onto teammates they pass; disabled, see stepFlying */
  autoGrab = false;
  private pendingLaunches: { id: number; v: Vec; at: number }[] = [];
  /** solo = one climber that flings itself (arcade); crew = teammates fling each other */
  rules: "solo" | "crew" = "crew";
  /** chill: no rising wall. Falling off the bottom still loses a climber. */
  chill = false;
  /** flings used this run (one per gesture; a SYNC fling counts once) */
  flings = 0;
  /** every fling and climb, in order, so a run can be drawn again or checked later */
  readonly tape = new Recorder();
  /** what each climber is currently sliding on, so a material only sounds on contact */
  private slideMaterial = new Map<number, string>();
  reserves = 0;
  palette: string[];
  /** per-slot looks (creature + pattern); climber i wears lineup[i % length] */
  lineup: Look[];
  feats: RunFeats = { maxChain: 0, gadgetRides: 0, hits: 0, paints: 0, unhurtCm: 0 };
  /** banked totals from the save, so the HUD can show wallet + this run */
  walletCoins = 0;
  walletGems = 0;
  particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
  /** a candy drop on its way down to the kid: cosmetic, it tumbles to the red line and vanishes */
  drops: { x: number; y: number; vx: number; vy: number; spin: number }[] = [];
  floats: { x: number; y: number; text: string; life: number; color: string }[] = [];
  viewH = 700;
  /**
   * A recorded climb running beside this one. The loop that owns the run steps it, so it
   * stays in lockstep through pauses and slow-motion; this field is only how the renderer
   * finds it. Structural, not the Ghost class, so the sim does not import its own replayer.
   */
  ghost: { climber: Climber | null; heightCm: number; done: boolean } | null = null;
  /**
   * What this climb has picked up in total, across every revive. `coins` and `gems` are the
   * part not yet paid into the wallet, and a death pays them in and clears them -- which left
   * the HUD reading "+0" for the rest of the run, as though a revive had confiscated the lot.
   * It never did: these are what the player actually earned, and what the HUD shows.
   */
  runCoins = 0;
  runGems = 0;
  /** where sound goes: the real module, or nothing at all for a ghost or a server replay */
  private readonly a: GameAudio;

  constructor(readonly levels: Record<UpgradeKey, number>, private events: RunEvents, opts: { reserves?: number; palette?: string[]; lineup?: Look[]; seed?: number; rules?: "solo" | "crew"; chill?: boolean; worldVersion?: number; silent?: boolean } = {}) {
    const seed = opts.seed ?? (Date.now() & 0xffffffff);
    // A ghost is a whole second run of the sim, stepped beside the real one. It must not be
    // heard: every effect it would fire has already been heard, or is about to be.
    this.a = opts.silent ? silentAudio : { sfx, playObjectSound, playBubbleSound, stopPullSound };
    this.rules = opts.rules ?? "crew";
    this.chill = opts.chill ?? false;
    this.palette = opts.palette ?? CLIMBER_COLORS;
    this.lineup = opts.lineup?.length ? opts.lineup : [];
    this.reserves = opts.reserves ?? 0;
    this.stats = statsFor(levels);
    this.revivesLeft = this.stats.revives;
    this.startY = 0;
    this.world = new World(seed, 0, opts.worldVersion);
    this.floorY = CFG.floorStartOffset;
    this.highestY = 0;
    this.camY = -this.viewH * 0.55;
    this.spawnTeam(1, 0);
    this.world.ensure(-this.viewH * 2);
    this.relabelSolo();
  }

  private spawnTeam(n: number, y: number) {
    // spawn bunched so everyone is within arm reach of a neighbour
    const gap = Math.min(46, this.stats.reach - 12);
    for (let i = 0; i < n; i++) {
      // start on the left door, clear of the non-stick seam down the middle
      const x = W * 0.27 + (i - (n - 1) / 2) * gap;
      this.climbers.push(this.makeClimber(x, y - 40, "stuck"));
    }
    this.pickDefaultSelection();
  }

  private makeClimber(x: number, y: number, state: Climber["state"]): Climber {
    const id = this.nextId++;
    const look = this.lineup.length ? this.lineup[(id - 1) % this.lineup.length] : null;
    const c: Climber = {
      id, x, y, vx: 0, vy: 0, angle: 0, spin: 0, state,
      color: look ? patternColors(look.pattern)[(id - 1) % 6] : this.palette[(id - 1) % this.palette.length],
      ...(look ? { creature: look.creature, pattern: look.pattern } : {}),
      parent: null, leftLauncher: true, launcherId: null, airTime: 0, squash: 0,
      hp: CFG.maxHp, iframes: 0,
      ragdoll: undefined,
    };
    if (state === "stuck" && !braceLanding(c, this.world)) attachGrip(c, findContacts(c, this.world, CFG.magnetism.snapDistance), true);
    // Revives can request a point beside an obstacle: fall until a real tip catches.
    if (state === "stuck" && !c.grip) c.state = "flying";
    return c;
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
    // finger on an anchored climber → select it and start aiming; elsewhere → nothing
    let best: Climber | null = null;
    let bd = 48;
    for (const c of this.anchored) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }
    // solo: one climber, so a drag anywhere aims it
    if (!best && this.rules === "solo") {
      const only = this.anchored[0];
      if (only) { this.selectedId = only.id; this.drag = { start: p, cur: p }; }
      return;
    }
    if (best) {
      // a ladder (someone hangs on it) cannot fling: hand the aim to the climber on top of it instead
      if (this.isLadder(best) && this.mode === "fling") {
        const top = this.climbers.find((o) => o.parent === best!.id && o.state === "linked" && o.locked);
        if (top) {
          best = top;
          this.floats.push({ x: top.x, y: top.y - 34, text: "flinging the top climber", life: 1, color: "#fff" });
        } else {
          this.floats.push({ x: best.x, y: best.y - 34, text: "someone's hanging on you: CLIMB them up", life: 1, color: "#ff6b6b" });
          return;
        }
      }
      this.selectedId = best.id;
      this.drag = { start: p, cur: p };
      return;
    }
  }

  pointerMove(p: Vec) {
    if (this.drag) {
      const distance = (v: Vec) => Math.hypot(v.x - this.drag!.start.x, v.y - this.drag!.start.y);
      // rubber under tension: each notch of draw creaks a little higher than the last
      if (this.mode === "fling" && Math.floor(distance(p) / 16) > Math.floor(distance(this.drag.cur) / 16)) {
        this.a.sfx.stretch(1 + Math.min(1, distance(p) / CFG.maxDrag) * .8);
      }
      this.drag.cur = p; return;
    }
  }

  /** Select a climber by id (from the HUD dots) and bring the camera to it. */
  select(id: number) {
    const c = this.byId(id);
    if (!c || c.state === "lost") return;
    this.selectedId = id;
  }

  pointerUp() {
    this.a.stopPullSound();
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
    if (this.sync && this.rules === "crew") {
      const targets = this.syncTargets();
      if (targets.length === 0) return;
      // the dragged one goes first; the rest follow, staggered
      targets.sort((a, b) => (a.id === c.id ? -1 : b.id === c.id ? 1 : a.y - b.y));
      // a gesture only counts once somebody actually leaves the door
      if (!this.launch(targets[0], v)) return;
      this.flings++;
      targets.slice(1).forEach((t, i) => this.pendingLaunches.push({ id: t.id, v, at: this.time + (i + 1) * 0.08 }));
      this.selectedId = c.id;
      return;
    }
    // a ladder rung or an unlocked hanger refuses the launch; that costs no fling
    if (this.launch(c, v)) this.flings++;
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

  /** Sends a climber flying. Returns false (and spends nothing) when it cannot go: a ladder rung or an unlocked hanger. */
  launch(c: Climber, v: Vec): boolean {
    // recorded before the refusals below, so a tape only ever holds flings that happened
    if (this.isLadder(c)) { this.floats.push({ x: c.x, y: c.y - 34, text: "someone's hanging on you: CLIMB them up", life: 1, color: "#ff6b6b" }); return false; }
    if (c.state === "linked" && !c.locked) { this.floats.push({ x: c.x, y: c.y - 34, text: "CLIMB up first", life: 1, color: "#ff6b6b" }); return false; }
    if (this.phase === "idle") this.phase = "running";
    // anything hanging on this climber loses its grip
    for (const o of this.climbers) {
      if (o.parent === c.id && o.state === "linked") this.detach(o);
    }
    // kicking off a hanging gadget swings it the other way
    for (const k of c.grip?.contacts ?? []) if (k.carrierId) this.world.bumpGadget(k.carrierId, -Math.sign(v.x), 0.7);
    this.tape.fling(this.time, c.id, v);
    // a fresh fling is a fresh landing: the last panel it slid on is forgotten, so coming
    // back down on the same board sounds again instead of counting as one long slide
    this.slideMaterial.delete(c.id);
    c.noStick = 0;
    c.state = "flying";
    c.grip = undefined;
    c.parent = null; c.locked = false;
    c.vx = v.x;
    c.vy = v.y;
    // Spin tracks the fling itself (sideways speed -> tumble); the noise term used to be
    // (simNoise - 0.5) * 8, which is keyed to this.time and so effectively random per release
    // frame -- up to ~4 rad/s of spin the player never chose and could not see coming, roughly
    // half of the controllable range from a full-width drag. A tiny jitter is kept for texture
    // (a real toy never leaves the hand spinning exactly true) but at a scale too small to fight.
    c.spin = v.x * 0.012 + (this.simNoise(c.id) - 0.5) * 0.6;
    // pop off the door in proportion to the pull; the magnet brings it back
    const full = CFG.maxDrag * CFG.launchScale * this.stats.launchMult;
    const pull = Math.max(0, Math.min(1, Math.hypot(v.x, v.y) / full));
    c.z = 0; c.vz = CFG.hop.liftMin + (CFG.hop.liftFull - CFG.hop.liftMin) * pull;
    resetRagdoll(c);
    c.leftLauncher = false;
    c.launchY = c.y; c.fell = false;
    c.launcherId = this.launcherFor(c)?.id ?? null;
    c.airTime = 0;
    c.squash = 1;
    // the band snapping back past its rest length, pitched by how hard it was pulled
    this.a.sfx.twang(.85 + pull * .5);
    // twang is the band letting go (falling pitch, right at the release); launch is the toy
    // actually taking off (rising pitch + a rising noise sweep). They are two different halves
    // of the same instant, not the same sound twice, so both fire -- pitched up together by pull
    // so a hard fling reads as a bigger departure, not just a louder snap.
    this.a.sfx.launch(.9 + pull * .4);
    this.burst(c.x, c.y, c.color, 6);
    this.selectedId = c.id;
    return true;
  }

  private detach(o: Climber) {
    // try to grab another anchor first
    const other = this.nearestAnchor(o, o.parent);
    if (other) {
      o.parent = other.id;
      return;
    }
    o.state = "flying";
    o.grip = undefined;
    o.parent = null; o.locked = false;
    o.vx = 0;
    o.vy = 0;
    o.leftLauncher = true;
    o.launcherId = null;
    o.airTime = 0;
    o.z = 0; o.vz = 0;
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

  /** Climbers a SYNC fling moves: anchored on steel, nobody hanging on them, not hanging themselves. */
  syncTargets(): Climber[] {
    return this.climbers.filter((c) => c.state === "stuck" && !this.isLadder(c));
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
    // dropped onto a teammate: climb to the top of whatever it is part of and stand there, whatever
    // the steel underneath. Anything anchored counts, as long as the structure holds metal somewhere.
    const onto = this.stackTarget(c, tx, ty);
    if (onto) return { x: onto.x, y: onto.y - CFG.stackHeight, parent: onto.id };
    // short shuffle on bare metal: needs three of four tips on steel, so nobody inches across glass on one toe
    if (Math.hypot(tx - c.x, ty - c.y) <= this.currentReach() * 1.1 && findContacts(
      { ...c, x: tx, y: ty, angle: 0, state: "flying", grip: undefined },
      this.world, CFG.magnetism.snapDistance + this.stats.magnetRadius,
    ).length >= 3) {
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
    // stack: stand upright on the teammate's shoulders; one climber per set of shoulders, stacks up to stackMax
    if (this.climbers.some((o) => o.parent === best!.id && o.state === "linked" && o.locked && o.id !== c.id)) return null;
    if (this.stackDepth(best) >= CFG.stackMax) return null;
    return { x: best.x, y: best.y - CFG.stackHeight, parent: best.id };
  }

  /** How many climbers stand in the stack that ends at `c` (c included). */
  /** The teammate c would end up standing on if dropped near (tx, ty): the top of that stack, if it has room
   * and c is not already holding it up. Null when nobody is there. */
  stackTarget(c: Climber, tx: number, ty: number): Climber | null {
    const near = this.anchored.filter((o) => o.id !== c.id && Math.hypot(o.x - tx, o.y - ty) < CFG.stackSnap)
      .sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
    for (const o of near) {
      const top = this.stackTop(o);
      if (top.id === c.id) continue;
      let q: Climber | undefined = top; let cyc = false;
      for (let i = 0; q && i < 20; i++) { if (q.parent === c.id) { cyc = true; break; } q = this.byId(q.parent); }
      if (cyc || this.stackDepth(top) >= CFG.stackMax) continue;
      if (Math.hypot(top.x - c.x, top.y - c.y) > this.pullRange()) continue;
      return top;
    }
    return null;
  }

  /** Teammates the selected climber could climb onto right now: shown as targets in CLIMB mode. */
  climbTargets(c: Climber): Climber[] {
    const out: Climber[] = [];
    for (const o of this.anchored) {
      if (o.id === c.id) continue;
      const top = this.stackTop(o);
      if (top.id === c.id || out.includes(top)) continue;
      if (this.stackTarget(c, top.x, top.y) === top) out.push(top);
    }
    return out;
  }

  /** The climber standing highest in the stack that o belongs to. */
  stackTop(o: Climber): Climber {
    let top = o;
    for (let i = 0; i < 20; i++) {
      const above = this.climbers.find((k) => k.parent === top.id && k.state === "linked" && k.locked);
      if (!above) break; top = above;
    }
    return top;
  }

  /** A crew climber that comes down on a teammate lands on its shoulders and locks in: no CLIMB needed to stack. */
  private landOnTeammate(c: Climber): boolean {
    if (this.rules !== "crew") return false;
    const onto = this.anchored.find((o) => o.id !== c.id && (o.state === "stuck" || o.locked) && Math.hypot(o.x - c.x, o.y - c.y) < CFG.stackSnap);
    if (!onto) return false;
    if (c.state === "linked" || this.climbers.some((k) => k.parent === c.id && k.state === "linked")) return false;
    const top = this.stackTop(onto);
    if (top.id === c.id || this.stackDepth(top) >= CFG.stackMax) return false;
    c.state = "linked"; c.locked = true; c.parent = top.id; c.grip = undefined;
    c.x = top.x; c.y = top.y - CFG.stackHeight; c.angle = 0; c.vx = 0; c.vy = 0; c.spin = 0; c.squash = 1;
    this.a.sfx.link();
    this.burst(c.x, c.y, top.color, 5);
    this.floats.push({ x: c.x, y: c.y - 30, text: "STACKED", life: 0.9, color: "#fff" });
    this.feats.maxChain = Math.max(this.feats.maxChain, this.stackDepth(c));
    this.markHeight(c);
    return true;
  }

  stackDepth(c: Climber): number {
    let d = 1; let cur: Climber | undefined = c;
    while (cur && cur.state === "linked" && cur.locked && cur.parent != null && d < 20) { cur = this.byId(cur.parent); d++; }
    return d;
  }

  /** The stack under a climber, bottom first (excluding the climber itself). */


  /** Crawl / reel a climber to a new hold. */
  move(c: Climber, p: Vec) {
    const t = this.moveTarget(c, p);
    if (!t) { this.floats.push({ x: c.x, y: c.y - 30, text: "out of reach", life: 0.9, color: "#ff6b6b" }); return; }
    this.tape.move(this.time, c.id, { x: t.x, y: t.y });
    if (this.phase === "idle") this.phase = "running";
    const was = { x: c.x, y: c.y, grip: c.grip, state: c.state, parent: c.parent, locked: c.locked, angle: c.angle };
    if (t.parent == null) {
      // a shuffle that finds no grip at the new spot stays put instead of dropping the climber
      c.x = t.x; c.y = t.y; c.vx = 0; c.vy = 0; c.squash = 1; c.grip = undefined; c.angle = 0;
      if (!this.stick(c, true)) {
        Object.assign(c, was); c.vx = 0; c.vy = 0;
        this.floats.push({ x: c.x, y: c.y - 30, text: "no grip there", life: 0.9, color: "#ff6b6b" });
        return;
      }
      for (const o of this.climbers) if (o.parent === c.id && o.state === "linked") this.detach(o);
    }
    else {
      for (const o of this.climbers) if (o.parent === c.id && o.state === "linked") this.detach(o);
      const a = this.byId(t.parent)!;
      c.x = t.x; c.y = t.y; c.vx = 0; c.vy = 0; c.squash = 1; c.grip = undefined;
      c.state = "linked"; c.parent = a.id; c.locked = true;
      c.angle = 0;
      this.a.sfx.link();
      this.feats.maxChain = Math.max(this.feats.maxChain, this.chainDepthAbove(c) + this.chainDepthBelow(c) + 1);
      this.awardNewHeight(c, "CHAIN BUILDER", 25);
    }
    this.markHeight(c);
    this.pickDefaultSelection();
  }

  /** Stepped ramp per 50cm, capped, with a catch-up nudge when the crew is far ahead. */
  /** seconds the run has actually been running (idle aiming before the first fling does not count) */
  runTime = 0;
  wallSpeed(): number {
    if (this.chill) return 0;
    const steps = Math.floor(this.heightCm / CFG.floorStepCm);
    let mult = Math.min(CFG.floorCapMult, 1 + steps * CFG.floorStepMult);
    mult *= Math.min(CFG.floorCreepCap, 1 + CFG.floorCreepPer10s * (this.runTime / 10));
    if (this.effects.candy > 0) mult *= CFG.candySlow;
    const alive = this.alive;
    if (alive.length) {
      const lowest = Math.max(...alive.map((c) => c.y));
      if (this.floorY - lowest > CFG.floorCatchupGap) mult *= CFG.floorCatchupMult;
    }
    // each factor above is capped on its own, but the ramp, creep and catch-up can all land at once;
    // cap their combined product so a climber meets one escalation, not an ~11x spike (candy's slowdown is exempt).
    mult = Math.min(mult, CFG.floorMultCap);
    return CFG.floorBase * mult * this.stats.floorMult;
  }

  /** Seal this run's tape: everything a replay needs to build the same climb again. */
  sealTape(daily = false) {
    return this.tape.tape({
      seed: this.world.seed, world: this.world.version, kit: { ...this.levels },
      chill: this.chill, daily, cm: this.heightCm, seconds: Math.round(this.runTime),
    });
  }

  snapshot(): RunSnapshot | null {
    if (this.phase !== "running") return null;
    const taken: string[] = [];
    const bumpers: RunSnapshot["bumpers"] = [];
    for (const seg of this.world.segments) {
      seg.powerUps.forEach((p, i) => { if (p.taken) taken.push(`${seg.y}:${i}`); });
      seg.bumpers.forEach((b, i) => bumpers.push({ y: seg.y, i, x: b.x, vx: b.vx, by: b.y, vy: b.vy }));
    }
    return {
      v: 1, rules: this.rules, chill: this.chill, seed: this.world.seed, worldVersion: this.world.version, generated: this.world.generated, runTime: this.runTime,
      climbers: this.climbers.map((c) => ({ ...c, grip: cloneGrip(c.grip), ragdoll: cloneRagdoll(c.ragdoll) })), nextId: this.nextId,
      floorY: this.floorY, highestY: this.highestY, camY: this.camY,
      coins: this.coins, gems: this.gems, reserves: this.reserves, revivesLeft: this.revivesLeft,
      effects: { ...this.effects }, time: this.time, sync: this.sync, selectedId: this.selectedId,
      taken, bumpers, pendingLaunches: this.pendingLaunches.map((p) => ({ ...p, v: { ...p.v } })),
      hand: this.hand ? { ...this.hand, hit: [...this.hand.hit], ...(this.hand.near ? { near: [...this.hand.near] } : {}) } : undefined,
      paw: this.paw ? { ...this.paw, hit: [...this.paw.hit] } : undefined,
      handCount: this.handCount, nextHandAt: this.nextHandAt,
      gadgetTime: this.world.gadgetTime, tricks: cloneTricks(this.tricks), feats: { ...this.feats },
      runCoins: this.runCoins, runGems: this.runGems,
      // only gadgets actually away from rest, so a quiet door costs a snapshot nothing
      gadgetState: this.world.gadgets.flatMap((g) => {
        const moved = g.hitCool || g.popCool || g.needle || g.pops != null
          || (g.swing && (g.swing.angle || g.swing.vel || g.swing.cool))
          || (g.spin && (g.spin.extra || g.spin.vel || g.spin.cool));
        return moved ? [{ id: g.id, ...(g.hitCool ? { hitCool: g.hitCool } : {}), ...(g.popCool ? { popCool: g.popCool } : {}),
          ...(g.needle ? { needle: g.needle } : {}), ...(g.pops != null ? { pops: g.pops } : {}), ...(g.swing ? { swing: { ...g.swing } } : {}),
          ...(g.spin ? { spin: { ...g.spin } } : {}) }] : [];
      }),
    };
  }

  static restore(levels: Record<UpgradeKey, number>, events: RunEvents, snap: RunSnapshot, palette?: string[], lineup?: Look[]): Game {
    const legacyVersion = snap.climbers.some((c) => c.hp != null) ? 1 : 0;
    const g = new Game(levels, events, { rules: snap.rules, seed: snap.seed, palette, lineup, chill: snap.chill ?? false, worldVersion: snap.worldVersion ?? legacyVersion });
    if (snap.feats) g.feats = { ...g.feats, ...snap.feats };
    // the climb up to this point was never recorded, so this run can no longer be replayed
    g.tape.invalidate();
    g.world.generateTo(snap.generated);
    g.world.gadgetTime = snap.gadgetTime ?? 0; g.runTime = snap.runTime ?? 0;
    g.runCoins = snap.runCoins ?? 0; g.runGems = snap.runGems ?? 0;
    // put the door back the way it was left, before any climber tries to take hold of it
    if (snap.gadgetState?.length) {
      const by = new Map(snap.gadgetState.map((s) => [s.id, s]));
      for (const gd of g.world.gadgets) {
        const was = by.get(gd.id); if (!was) continue;
        if (was.hitCool != null) gd.hitCool = was.hitCool;
        if (was.popCool != null) gd.popCool = was.popCool;
        if (was.needle != null) gd.needle = was.needle;
        if (was.pops != null) gd.pops = was.pops;
        if (was.swing && gd.swing) gd.swing = { ...was.swing };
        if (was.spin && gd.spin) gd.spin = { ...was.spin };
      }
    }
    g.tricks = snap.tricks ? cloneTricks(snap.tricks) : freshTricks();
    if (!snap.tricks) g.tricks.frontierY = snap.highestY;
    for (const seg of g.world.segments) {
      seg.powerUps.forEach((p, i) => { if (snap.taken.includes(`${seg.y}:${i}`)) p.taken = true; });
      for (const b of snap.bumpers) if (b.y === seg.y && seg.bumpers[b.i]) { const t = seg.bumpers[b.i]; t.x = b.x; t.vx = b.vx; if (b.by != null) t.y = b.by; if (b.vy != null) t.vy = b.vy; }
    }
    g.climbers = snap.climbers.map((c) => {
      const restored = { ...c, grip: cloneGrip(c.grip), ragdoll: cloneRagdoll(c.ragdoll) };
      restored.hp ??= CFG.maxHp; restored.iframes ??= 0;
      if (restored.state === "stuck" && !restored.grip) {
        attachGrip(restored, findContacts(restored, g.world, CFG.magnetism.snapDistance), true);
        if (!restored.grip) { restored.state = "flying"; restored.airTime = 0; }
      }
      return restored;
    });
    g.pendingLaunches = (snap.pendingLaunches ?? []).map((p) => ({ ...p, v: { ...p.v } }));
    g.nextId = snap.nextId;
    g.hand = snap.hand ? { ...snap.hand, hit: new Set(snap.hand.hit), ...(snap.hand.near ? { near: [...snap.hand.near] } : {}) } : null;
    g.paw = snap.paw ? { ...snap.paw, hit: new Set(snap.paw.hit) } : null;
    g.handCount = snap.handCount ?? 0;
    g.nextHandAt = snap.nextHandAt ?? snap.time + CFG.handFirstAfter;
    g.floorY = snap.floorY; g.highestY = snap.highestY; g.camY = snap.camY;
    g.coins = snap.coins; g.gems = snap.gems; g.reserves = snap.reserves; g.revivesLeft = snap.revivesLeft;
    g.effects = { ...snap.effects, candy: snap.effects.candy ?? 0 }; g.time = snap.time; g.sync = snap.sync; g.selectedId = snap.selectedId;
    g.phase = "running";
    g.world.ensure(g.camY - g.viewH);
    return g;
  }

  currentReach(): number {
    return this.stats.reach + (this.effects.reach > 0 ? 40 : 0);
  }

  // ---------- simulation ----------

  update(dt: number) {
    this.time += dt;
    const slow = this.effects.slowmo > 0 ? 0.45 : 1;
    const sdt = dt * slow;
    if (this.phase === "running") { this.world.gadgetTime += sdt; this.world.stepGadgets(sdt); }
    this.tipClips(sdt);
    this.swingNeedles(sdt);
    this.world.superGrip = this.effects.superMagnet > 0;
    for (const k of Object.keys(this.effects) as (keyof ActiveEffects)[]) {
      if (this.effects[k] > 0) this.effects[k] = Math.max(0, this.effects[k] - dt);
    }

    if (this.phase === "running") { this.runTime += sdt; this.floorY -= this.wallSpeed() * sdt; }
    if (this.chill) this.floorY = this.camY + this.viewH + 1e6;

    if (this.pendingLaunches.length) {
      const due = this.pendingLaunches.filter((p) => p.at <= this.time);
      this.pendingLaunches = this.pendingLaunches.filter((p) => p.at > this.time);
      const keep = this.selectedId;
      for (const p of due) {
        const c = this.byId(p.id);
        if (c && c.state === "stuck" && !this.isLadder(c)) this.launch(c, p.v);
      }
      this.selectedId = keep;
    }

    // bumpers: slide, lift or zig-zag inside their box
    for (const s of this.world.segments) {
      for (const b of s.bumpers) {
        b.x += b.vx * sdt;
        if (b.x < b.minX) { b.x = b.minX; b.vx = Math.abs(b.vx); }
        if (b.x > b.maxX) { b.x = b.maxX; b.vx = -Math.abs(b.vx); }
        if (b.vy) {
          b.y += b.vy * sdt;
          if (b.y < b.minY) { b.y = b.minY; b.vy = Math.abs(b.vy); }
          if (b.y > b.maxY) { b.y = b.maxY; b.vy = -Math.abs(b.vy); }
        }
      }
    }
    for (const c of this.climbers) if (c.iframes > 0) c.iframes = Math.max(0, c.iframes - dt);
    this.stepHand(sdt);
    if (this.feats.hits === 0) this.feats.unhurtCm = Math.max(this.feats.unhurtCm ?? 0, this.heightCm);

    for (const c of this.climbers) c.handsAt = undefined;
    // a toy that is holding on, or gone, is not sliding: forget the panel it last slid on, so
    // however it next takes to the air (a fling, a swat, a bumper knocking it loose, a lost
    // grip) coming down on that same panel sounds again
    for (const c of this.climbers) if (c.state !== "flying") this.slideMaterial.delete(c.id);
    for (const c of this.climbers) {
      if (c.state === "flying") {
        this.stepFlying(c, sdt); this.world.knockSwings(c, c.vx);
        const pop = this.world.popped; if (pop) { this.world.popped = null; this.a.playBubbleSound(pop.inward, pop.index); }
        // a swung toy that has a voice uses it: the taxi honks, the keys jangle, the duck squeaks
        const hit = this.world.knocked;
        if (hit) {
          this.world.knocked = null;
          this.a.playObjectSound(hit, Math.min(1, Math.abs(c.vx) / 300));
        }
      }
      else if (c.state === "stuck" || c.state === "linked") this.stepAnchored(c, sdt);
      c.squash = Math.max(0, c.squash - dt * 3);
    }

    // joined magnets: a stack's base holds the feet of the climber standing on it; a hanger holds its catcher's feet
    for (const c of this.climbers) {
      if (c.state !== "linked" || c.parent == null) continue;
      const p = this.byId(c.parent); if (!p || (p.state !== "stuck" && p.state !== "linked")) continue;
      if (c.locked) p.handsAt = [limbTip(c, 2), limbTip(c, 3)];
      else c.handsAt = [limbTip(p, 2), limbTip(p, 3)];
    }

    // floor claims
    for (const c of this.climbers) {
      if (c.state !== "lost" && c.y > this.floorY + 10) this.lose(c, "redline");
      if (c.state === "flying" && c.y > this.camY + this.viewH + 200) this.lose(c, "fell");
      // chill has no wall, so a long fall below the high point is the only way to lose one
      if (this.chill && c.state === "flying" && c.y > this.highestY + this.viewH * 1.6 + 300) this.lose(c);
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

    // the camera always follows the active climber; there is no hand-panning to escape it
    const sel = this.byId(this.selectedId);
    if (sel) {
      const target = sel.y - this.viewH * 0.55;
      this.camY += (target - this.camY) * Math.min(1, dt * 5);
    }
    this.world.ensure(this.camY - this.viewH);
    this.relabelSolo();

    // particles / floats
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.life -= dt; }
    // the candy tumbles down to the red line (the kid), bouncing off the door edges on the way
    for (const d of this.drops) {
      d.x += d.vx * dt; d.y += d.vy * dt; d.vy = Math.min(900, d.vy + 900 * dt); d.spin += (d.vx > 0 ? 6 : -6) * dt;
      if (d.x < 16 || d.x > W - 16) { d.vx = -d.vx * 0.7; d.x = Math.max(16, Math.min(W - 16, d.x)); }
    }
    for (const d of this.drops) if (d.y >= this.floorY + 20) this.a.sfx.munch(); // the kid gets the sweet
    this.drops = this.drops.filter((d) => d.y < this.floorY + 20 && d.y < this.camY + this.viewH + 200);
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floats) { f.y -= 40 * dt; f.life -= dt; }
    this.floats = this.floats.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt * 3);

    if (this.phase === "running" && this.alive.length === 0) {
      this.phase = "dead";
      this.a.sfx.over();
      this.events.onGameOver();
    }
  }

  /** Pull toward the door at this spot: the fridge's own steel, upgrades, plates and power-ups. */
  private zPull(c: Climber, attract: NoStickZone | null): number {
    let g = CFG.hop.zGravity * (1 + this.levels.magnet * CFG.hop.magnetPerLevel);
    if (!this.world.isMetal(c.x, c.y, 6)) g *= CFG.hop.offMetal;
    if (attract) g += CFG.hop.attractPull;
    if (this.effects.superMagnet > 0) g *= CFG.hop.superMagnet;
    return g;
  }

  private stepFlying(c: Climber, dt: number) {
    c.airTime += dt;
    c.vy += CFG.gravity * dt;
    // field magnets: red plates push out (strong ones are slingshots), blue plates pull in and catch you
    // (a toy just knocked off ignores blue plates for a moment, so it is not yanked straight back)
    const field = this.world.fieldAt(c.x, c.y, !(c.noStick && c.noStick > 0));
    const az = field.attract;
    c.vx += field.ax * dt; c.vy += field.ay * dt;
    // height off the door: only a toy back at z = 0 can be caught
    c.vz = (c.vz ?? 0) - this.zPull(c, az) * dt;
    c.z = Math.max(0, (c.z ?? 0) + (c.vz ?? 0) * dt);
    if (c.z === 0 && (c.vz ?? 0) < 0) c.vz = 0;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.angle += c.spin * dt;
    // walls: bounce softly off the edges of the fridge
    if (c.x < CFG.climberRadius) { c.x = CFG.climberRadius; c.vx = Math.abs(c.vx) * 0.5; }
    if (c.x > W - CFG.climberRadius) { c.x = W - CFG.climberRadius; c.vx = -Math.abs(c.vx) * 0.5; }

    // bumpers knock
    for (const s of this.world.segments) {
      for (const b of s.bumpers) {
        if (c.iframes <= 0 && inRect(c.x, c.y, b, CFG.climberRadius * 0.7)) {
          // speed going into the hit, before the knockback below overwrites it
          const impact = Math.min(1, Math.hypot(c.vx, c.vy) / 300);
          const bx = b.x + b.w / 2;
          c.vx = (c.x < bx ? -1 : 1) * CFG.bumperKnock + b.vx;
          c.vy = -Math.abs(c.vy) * 0.3 + 60 + (b.vy < 0 ? b.vy : 0);
          c.x += c.vx * 0.03;
          c.noStick = 0.25;
          c.fell = true; // knocked out of the air is a fall, catchable like every other knock
          this.damage(c, false, "bumper", impact);
          if (c.state === "lost") return;
        }
      }
    }

    stepRagdoll(c, dt);

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

    // magnet catch: only once the toy is back on the door (z = 0) over metal
    if ((c.noStick ?? 0) > 0) c.noStick = Math.max(0, (c.noStick ?? 0) - dt);
    // a short hop that comes straight back down on its own slingshot still counts as landing on it
    const canStack = c.leftLauncher || (c.airTime > 0.35 && c.vy > 0);
    // low over a teammate: land on its shoulders even before touching the door
    if ((c.z ?? 0) <= 15 && c.airTime > 0.15 && canStack && !(c.noStick && c.noStick > 0) && this.landOnTeammate(c)) return;
    if ((c.z ?? 0) <= 0 && c.airTime > 0.08 && !(c.noStick && c.noStick > 0)) {
      // A toy that came down well inside a glass, plastic or paper panel is ON the panel: nothing
      // magnetic is under it and its magnets cannot feel a rim through the sheet. It lands where it
      // hit and slides from there. Without this it was tugged to whichever edge was nearest and
      // stuck to it, which is not what anyone aimed at and not what the panel looks like.
      const onPanel = !this.world.isMetal(c.x, c.y, CFG.magnetism.panelInset);
      if (!onPanel && this.stick(c)) {
        // caught steel right next to a teammate: that is a stack, not two climbers sharing a spot
        if (canStack) this.landOnTeammate(c);
        return;
      }
      // Gentle edge attraction near the apex. No force reaches across a broad glass panel.
      const candidates = onPanel ? [] : findContacts(c, this.world, CFG.magnetism.attractionRange + this.stats.magnetRadius);
      const closest = candidates.map((p) => {
        const tip = limbTip(c, p.limb);
        return { dx: p.x - tip.x, dy: p.y - tip.y };
      }).sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy))[0];
      if (closest) {
        const distance = Math.hypot(closest.dx, closest.dy) || 1;
        const force = CFG.magnetism.attractionAccel * dt;
        c.vx += closest.dx / distance * force;
        c.vy += closest.dy / distance * force;
      }
      // v13: no steel under the toy, so it slides down whatever it is on. Each material drags differently:
      // ice lets it shoot, glass squeaks, plastic scrubs, paper nearly stops it.
      const k = this.world.version >= 13 ? this.world.slideFriction(c.x, c.y) : undefined;
      // first frame against a material: glass rings, plastic tocks, paper rustles, ice ticks
      // and skids. Coming down out of the air onto it always sounds, however slow the toy
      // is moving across the door: the hit is the drop, and a fling that lands at its apex
      // in the middle of a window arrives with almost no pace at all. Only a change from one
      // material to the next mid-slide needs some speed behind it to be worth a sound.
      // asked on its own, not through the friction value: paper stopped dragging in v15 (a
      // sticker is not something to slide on) and its rustle went silent with it
      const material = this.world.version >= 13 ? this.world.materialAt(c.x, c.y) : undefined;
      const before = this.slideMaterial.get(c.id);
      if (material !== before) {
        if (material && (before === undefined || Math.hypot(c.vx, c.vy) > 120)) {
          const hit = { glass: this.a.sfx.hitGlass, plastic: this.a.sfx.hitPlastic, paper: this.a.sfx.hitPaper, ice: this.a.sfx.hitIce }[material];
          hit(0.94 + this.simNoise(c.id + Math.round(c.y)) * 0.12);
        }
        if (material) this.slideMaterial.set(c.id, material); else this.slideMaterial.delete(c.id);
      }
      if (k != null) {
        const f = Math.min(1, k * dt);
        c.vx -= c.vx * f; if (c.vy > 0) c.vy -= c.vy * f * 0.75; c.spin -= c.spin * f;
        if (k >= 1.8 && c.vy > 0) c.vy = Math.min(c.vy, k >= 3 ? 110 : 260); // paper and plastic cap the slide speed
      }
    }
    // teammate grab: after apex, within reach of an anchored teammate with chain room.
    // Off by default: it made flings unpredictable. CLIMB is the deliberate way to chain.
    // CATCH: in crew, a climber that was knocked off or has fallen back past where its fling
    // started grabs any anchored teammate within arm's reach. A normal fling on its way down is not a fall.
    if (c.vy > 0 && c.launchY != null && c.y > c.launchY - 10) c.fell = true;
    const falling = this.rules === "crew" && !!c.fell && c.vy > 220 && c.leftLauncher && c.airTime > 0.25 && !(c.noStick && c.noStick > 0);
    if ((this.autoGrab && c.vy > -60 && c.leftLauncher && c.airTime > 0.15) || falling) {
      // coming down onto a teammate is a landing, not a fall: stand on the shoulders instead of hanging beside them
      if (falling && this.landOnTeammate(c)) return;
      const a = this.nearestAnchor(c, null);
      if (a) {
        c.state = "linked"; c.locked = false;
        c.grip = undefined;
        c.parent = a.id;
        c.vx = 0; c.vy = 0;
        // clamp to reach
        const dx = c.x - a.x, dy = c.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        // pulled in until the hands actually hold the catcher's feet, not left dangling at arm's reach
        const r = Math.min(d, falling ? CFG.stackHeight - 8 : this.currentReach() - 4);
        c.x = a.x + (dx / d) * r;
        c.y = a.y + (dy / d) * r;
        c.angle = Math.atan2(dy, dx) + Math.PI / 2;
        c.squash = 1;
        this.a.sfx.link();
        this.awardNewHeight(c, "CHAIN CATCH", 40);
        this.burst(c.x, c.y, a.color, 5);
        this.markHeight(c);
        this.floats.push({ x: c.x, y: c.y - 30, text: "GRAB!", life: 0.8, color: "#fff" });
        return;
      }
    }
  }

  private stepAnchored(c: Climber, dt: number) {
    const oldX = c.x, oldY = c.y;
    if (c.state === "stuck" && c.grip) {
      const moving = c.grip.contacts.filter((p) => p.carrierId && p.carrierOffset);
      let dx = 0, dy = 0, released = false;
      for (const p of moving) {
        const next = this.world.carrierPoint(p.carrierId!, p.carrierOffset!);
        if (!next) { released = true; break; }
        dx += next.x - p.x; dy += next.y - p.y; p.x = next.x; p.y = next.y;
      }
      if (moving.length && !released) {
        c.x += dx / c.grip.contacts.length; c.y += dy / c.grip.contacts.length;
        released = c.grip.contacts.some((p) => Math.hypot(p.x - c.x, p.y - c.y) > 65);
      }
      if (released) {
        c.state = "flying"; c.grip = undefined; c.vx = dx / Math.max(dt, 0.001); c.vy = 35; c.fell = true;
        c.airTime = 0; c.noStick = 0.18; resetRagdoll(c); return;
      }
    }
    // a stuck climber hit by a bumper is knocked loose
    if (c.state === "stuck") {
      for (const s of this.world.segments) {
        for (const b of s.bumpers) {
          if (c.iframes <= 0 && inRect(c.x, c.y, b, CFG.climberRadius * 0.5)) {
            c.state = "flying";
            c.grip = undefined;
            // a stuck climber isn't moving; what it feels is the bumper swinging into it
            const impact = Math.min(1, Math.hypot(b.vx, b.vy) / 300);
            // Knock clear of the bumper, retaining Claude's no-stick grace window.
            const away = c.x < b.x + b.w / 2 ? -1 : 1;
            c.vx = away * 260 + b.vx * 0.6;
            c.vy = (c.y < b.y + b.h / 2 ? -180 : 180) + b.vy * 0.6;
            resetRagdoll(c);
            c.leftLauncher = true; c.fell = true;
            c.airTime = 0;
            c.noStick = 0.35;
            this.damage(c, false, "bumper", impact);
          }
        }
      }
    }
    if (c.state === "stuck") {
      stepGrip(c, dt);
      // A moving grip carries the whole hanging chain, not only its root climber.
      const dx = c.x - oldX, dy = c.y - oldY;
      if (dx || dy) {
        const pending = [c.id], seen = new Set<number>();
        while (pending.length) {
          const id = pending.pop()!; if (seen.has(id)) continue; seen.add(id);
          for (const child of this.climbers) if (child.state === "linked" && child.parent === id && !seen.has(child.id)) {
            child.x += dx; child.y += dy; pending.push(child.id);
          }
        }
      }
    }
  }

  private stick(c: Climber, flat = false): boolean {
    const radius = CFG.magnetism.snapDistance + this.stats.magnetRadius + (this.effects.superMagnet > 0 ? 30 : 0);
    const contacts = findContacts(c, this.world, radius);
    if (!contacts.length) return false;
    if ((flat || !braceLanding(c, this.world)) && !attachGrip(c, contacts, flat)) return false;
    settleGrip(c, this.world);
    // grabbing a hanging gadget swings it in the direction you arrived
    for (const k of c.grip!.contacts) if (k.carrierId) this.world.bumpGadget(k.carrierId, Math.sign(c.vx), Math.min(1, Math.abs(c.vx) / 300));
    c.state = "stuck";
    c.parent = null;
    c.vx = 0; c.vy = 0; c.spin = 0;
    c.squash = 1;
    this.a.sfx.stick();
    if (c.grip?.contacts.some((k) => k.carrierId)) this.feats.gadgetRides++;
    if (!flat && c.airTime > 0.18) {
      const pose = c.grip!.pose;
      const name = pose === "single" ? (c.grip!.contacts[0].limb < 2 ? "ONE-HAND SAVE" : "ONE-FOOT SAVE") : pose === "hands" ? "HANDSTAND" : pose === "mixed" ? "TWIST CATCH" : pose === "feet" ? "STOOD IT!" : "SPLAT!";
      this.awardNewHeight(c, name, pose === "single" ? 50 : pose === "hands" ? 35 : 20);
    }
    this.burst(c.x, c.y, "#dfe6ee", 5);
    this.markHeight(c);
    return true;
  }

  private markHeight(c: Climber) {
    if (c.y < this.highestY) this.highestY = c.y;
    if (this.best && !this.best.beaten && this.heightCm > this.best.cm) {
      this.best.beaten = true;
      this.a.sfx.power();
      this.floats.push({ x: c.x, y: c.y - 40, text: "NEW BEST!", life: 1.6, color: "#9be15d" });
      this.burst(c.x, c.y, "#9be15d", 14);
    }
    if (this.target && !this.target.beaten && this.heightCm > this.target.cm) {
      this.target.beaten = true;
      this.a.sfx.power();
      this.floats.push({ x: c.x, y: c.y - 40, text: `BEAT ${this.target.name.toUpperCase()}!`, life: 1.6, color: "#ffd23f" });
      this.burst(c.x, c.y, "#ffd23f", 14);
    }
  }

  /**
   * Style points are gone: the tester could not control how a climber lands, so scoring it
   * was noise. No score, no coin bonus, no float. The trick state stays in the save so old
   * snapshots still load, and the detection below still marks new height, which is what
   * stops landing on the same ledge from paying out.
   */
  private awardTrick(_c: Climber, _name: string, _points: number) { /* scoring removed */ }

  private awardNewHeight(c: Climber, name: string, points: number) {
    if (c.y >= this.tricks.frontierY - 45) return;
    this.tricks.frontierY = c.y;
    this.awardTrick(c, name, points);
  }

  private lose(c: Climber, cause: DeathCause = "fell") {
    if (c.state === "lost") return;
    this.lastCause = cause;
    c.state = "lost";
    c.grip = undefined;
    c.parent = null;
    this.a.sfx.lost();
    this.floats.push({ x: c.x, y: Math.min(c.y, this.camY + this.viewH - 40), text: "lost!", life: 1, color: "#ff6b6b" });
  }

  /** Warn on a fixed curved route, reach across the door, then recoil to the same edge. */
  /**
   * A clip hangs level until someone hooks it near one end, and then their weight tips it.
   * Catch the bar near the middle and nothing moves, which is most of the time: only the
   * outer third of a 36 px bar counts, so this is a reward for a precise landing rather
   * than something that happens on every grab. Cosmetic: the hold does not move with it.
   */
  /**
   * A brass compass points at the nearest climber inside its range and swings back to north once
   * everyone has gone. It is a real magnet on the door doing what a compass does near one: no
   * field, no pole flipping, nothing to time -- it just notices you.
   */
  private swingNeedles(dt: number) {
    const RANGE = 190;
    for (const g of this.world.gadgets) {
      if (g.itemId !== "rotor-compass") continue;
      let near: Climber | null = null, best = RANGE;
      for (const c of this.climbers) {
        if (c.state === "lost") continue;
        const d = Math.hypot(c.x - g.x, c.y - g.y);
        if (d < best) { best = d; near = c; }
      }
      // the needle art points north at 0, so a bearing of atan2 turns a quarter further
      const want = near ? Math.atan2(near.y - g.y, near.x - g.x) + Math.PI / 2 : 0;
      const at = g.needle ?? 0;
      // take the short way round, and lag behind a fast climber the way a real needle does
      let diff = (want - at + Math.PI) % (Math.PI * 2);
      if (diff < 0) diff += Math.PI * 2;
      diff -= Math.PI;
      g.needle = at + diff * Math.min(1, dt * (near ? 6 : 2));
    }
  }

  private tipClips(dt: number) {
    for (const g of this.world.gadgets) {
      if (g.kind !== "clip") continue;
      const z = gadgetZone(g, this.world.gadgetTime), mid = z.x + z.w / 2, half = z.w / 2;
      let sum = 0, held = 0;
      for (const c of this.climbers) {
        if (c.state !== "stuck" && c.state !== "linked") continue;
        for (const p of c.grip?.contacts ?? []) {
          if (p.x < z.x - 2 || p.x > z.x + z.w + 2 || p.y < z.y - 8 || p.y > z.y + z.h + 8) continue;
          sum += (p.x - mid) / half; held++;
        }
      }
      // gripped right of centre, the right side drops: the sheet's foot swings left
      const off = held ? sum / held : 0;
      const target = Math.abs(off) > 0.62 ? Math.sign(off) * TIP_ANGLE : 0;
      g.lean = (g.lean ?? 0) + (target - (g.lean ?? 0)) * Math.min(1, dt * 7);
      if (Math.abs(g.lean) < 0.001) g.lean = 0;
    }
  }

  /** Cat paw: warn, three taps (the second deepest), retreat. Only the pad and toes hit; the foreleg is decorative. */
  private stepPaw(dt: number) {
    const paw = this.paw; if (!paw) return;
    paw.t += dt;
    const pose = pawPose(paw, this.camY, this.viewH);
    // each tap leaves four claw marks where it landed (fixed to the door, off the seam), fading on their own
    const marked = paw.marked ?? 0;
    // paw.t includes the warning hold, so the tap times are offset by it
    if (marked < PAW_TAPS.length && paw.t - PAW_WARN >= PAW_TAPS[marked]) {
      paw.marked = marked + 1;
      for (const [dx, dy] of CLAW_TIPS) {
        const x = pose.x + dx; if (x > DOOR_SEAM.x - 4 && x < DOOR_SEAM.x + DOOR_SEAM.w + 4) continue;
        this.scratches.push({ x, y: pose.y + dy, born: this.time });
      }
      while (this.scratches.length > 24) this.scratches.shift();
    }
    this.scratches = this.scratches.filter((m) => this.time - m.born <= SCRATCH_LIFE);
    // The pad hurts whenever it is on the door, not only at the bottom of a tap: flying up
    // into a paw on its way down is a collision, and it used to pass straight through.
    // One hit per paw either way, so a climber caught between taps is not hit twice.
    const live = paw.t > PAW_WARN && pose.y > this.camY - 10;
    if (live) for (const c of this.climbers) {
      if (c.state === "lost" || paw.hit.has(c.id) || c.iframes > 0) continue;
      const dx = (c.x - pose.x) / 46, dy = (c.y - pose.y) / 36;
      if (dx * dx + dy * dy > 1) continue;
      paw.hit.add(c.id); this.a.sfx.paw();
      if (this.effects.superMagnet > 0 && c.state !== "flying") { c.squash = 1; this.floats.push({ x: c.x, y: c.y - 50, text: "HELD ON!", life: 1, color: "#ff4d4d" }); continue; }
      c.state = "flying"; c.grip = undefined; c.parent = null; c.leftLauncher = true; c.airTime = 0; c.fell = true;
      // A paw comes straight down, so it drives you down the door rather than sideways,
      // and holds you off the steel long enough to actually lose ground: at 0.3s a climber
      // could catch the very next panel and the swat cost nothing but a heart.
      c.vx = (c.x < pose.x ? -1 : 1) * 90; c.vy = CFG.handShove; c.spin = 6; c.noStick = CFG.attackNoStick; resetRagdoll(c);
      this.damage(c, true, "paw");
      if (c.hp > 0) this.floats.push({ x: c.x, y: c.y - 50, text: "PAWED  -1 ♥", life: 1, color: "#ffd23f" });
    }
    if (paw.t >= PAW_DURATION + PAW_WARN) {
      this.paw = null;
      const climbed = Math.max(0, this.startY - this.highestY) / 1000;
      const interval = Math.max(CFG.handIntervalMin, CFG.handIntervalBase - climbed * 3);
      const random = makeRng(this.world.seed ^ Math.imul(this.handCount, 1274126177));
      this.nextHandAt = this.time + interval * (0.75 + random() * 0.5);
    }
  }
  /**
   * Solo has no crew, so "+1 friend" is meaningless there. Those pickups become paint
   * buckets instead.
   *
   * Done after generation rather than in the spawn table on purpose: the world keeps the
   * same seeded draws and the same positions, only the label changes, so terrain is
   * untouched and no world version bump is needed.
   */
  private relabelSolo() {
    if (this.rules !== "solo") return;
    for (const seg of this.world.segments) {
      if (seg.soloPainted) continue;
      seg.soloPainted = true;
      for (const p of seg.powerUps) if (p.kind === "extra") p.kind = "paint";
    }
  }

  private stepHand(dt: number) {
    if (this.phase !== "running" || this.chill) return;
    // no early return: during the rare double both are live at once
    if (this.paw) this.stepPaw(dt);
    if (!this.hand) {
      // a lone paw owns the attack slot; only the combo below ever spawns a hand beside one
      if (this.paw) return;
      if (this.time < this.nextHandAt) return;
      const anchored = this.anchored;
      const focus = anchored.length ? anchored.reduce((m, c) => (c.y < m.y ? c : m)) : this.alive[0];
      if (!focus) return;
      const random = makeRng(this.world.seed ^ Math.imul(++this.handCount, 0x9e3779b9));
      // v13: about a third of the attacks are the cat, tapping down from the top of the screen
      if (this.world.version >= 13 && random() < 0.35) { this.paw = { x: 60 + random() * (W - 120), t: 0, hit: new Set() }; this.a.sfx.warning(); return; }
      // Rare: Cooper and the cat go for the same climber together. No timing work needed --
      // the hand's 1.1 s warning and the paw's 0.75 s hold plus its 0.48 s first tap land
      // 0.13 s apart, so they converge on their own. The paw drops on the focus climber and
      // the hand sweeps across them, so the two threats cross where the player is standing.
      if (this.world.version >= 13 && random() < CFG.comboChance) {
        const comboSide: -1 | 1 = random() < 0.5 ? -1 : 1;
        this.hand = { side: comboSide, y: focus.y + (random() - 0.5) * 40, x: comboSide < 0 ? -80 : W + 80, phase: "warn", t: 0, hit: new Set() };
        this.paw = { x: Math.max(60, Math.min(W - 60, focus.x)), t: 0, hit: new Set() };
        this.a.sfx.warning();
        return;
      }
      const side: -1 | 1 = random() < 0.5 ? -1 : 1;
      this.hand = { side, y: focus.y + (random() - 0.5) * 80, x: side < 0 ? -80 : W + 80, phase: "warn", t: 0, hit: new Set() };
      // v12 worlds: about two in five swipes come up from the bottom of the door instead of the side
      if (this.world.version >= 12 && random() < 0.4) this.hand.entry = "bottom";
      this.a.sfx.warning();
      return;
    }
    const h = this.hand, previousT = h.t;
    h.t += dt;
    if (h.phase === "warn") {
      if (h.t >= CFG.handWarn) { h.phase = "sweep"; h.t = 0; this.a.sfx.swipe(); }
      return;
    }
    if (h.phase === "sweep") {
      const point = handWorldPoint(h, { x: 0, y: 0 }); h.x = point.x;
      for (const c of this.climbers) {
        if (c.state === "lost" || h.hit.has(c.id) || c.iframes > 0) continue;
        // Sweep samples avoid tunnelling if a caller uses a coarser step.
        const samples = Math.max(1, Math.ceil(dt / (1 / 120)));
        let touched = false;
        for (let i = 0; i <= samples; i++) {
          if (handTouches({ ...h, t: previousT + dt * i / samples }, c)) { touched = true; break; }
        }
        if (!touched) {
          if (handTouches(h, c, 27) && !(h.near ?? []).includes(c.id)) (h.near ??= []).push(c.id);
          continue;
        }
        h.hit.add(c.id);
        // super magnet: too strong for the kid. Stuck climbers hold on, take no damage.
        if (this.effects.superMagnet > 0 && c.state !== "flying") {
          c.squash = 1;
          this.burst(c.x, c.y, "#ff4d4d", 6);
          this.floats.push({ x: c.x, y: c.y - 50, text: "HELD ON!", life: 1, color: "#ff4d4d" });
          continue;
        }
        c.state = "flying"; c.grip = undefined; c.parent = null;
        c.leftLauncher = true; c.airTime = 0; c.fell = true;
        c.vx = -h.side * 260; c.vy = CFG.handShove; c.spin = -h.side * 7;
        c.noStick = CFG.attackNoStick;
        resetRagdoll(c);
        this.damage(c, true, "hand");
        if (c.hp > 0) this.floats.push({ x: c.x, y: c.y - 50, text: "SWATTED  -1 ♥", life: 1, color: "#ffd23f" });
      }
      if (h.t >= SWIPE_DURATION) {
        for (const id of h.near ?? []) { const c = this.byId(id); if (c && c.state !== "lost" && !h.hit.has(id)) this.awardTrick(c, "CLOSE CALL", 60); }
        h.phase = "retract"; h.t = 0;
      }
    } else if (h.t >= RECOIL_DURATION) {
      this.hand = null;
      const climbed = Math.max(0, this.startY - this.highestY) / 1000;
      const interval = Math.max(CFG.handIntervalMin, CFG.handIntervalBase - climbed * 3);
      const random = makeRng(this.world.seed ^ Math.imul(this.handCount, 1274126177));
      this.nextHandAt = this.time + interval * (0.75 + random() * 0.5);
    }
  }

  /** Wall speed as a multiple of the base, for the HUD. */
  wallMult(): number {
    return CFG.floorBase > 0 ? this.wallSpeed() / (CFG.floorBase * this.stats.floorMult) : 0;
  }

  /** One hit point off, a grace window, and a loss at zero.
   * `intensity` (0-1) is the impact speed against a reference, same convention as
   * playObjectSound; call sites with a real collision speed pass it, everything else
   * (a fixed-force swat or paw) keeps the old full-strength thud. */
  private damage(c: Climber, quiet = false, cause: DeathCause = "fell", intensity = 1) {
    c.hp = Math.max(0, c.hp - 1);
    c.iframes = CFG.hitIframes;
    if (this.feats.hits === 0) this.feats.unhurtCm = Math.max(this.feats.unhurtCm ?? 0, this.heightCm);
    this.feats.hits++;
    this.a.sfx.bump(intensity);
    this.shake = 0.6;
    this.burst(c.x, c.y, "#ffffff", 8);
    if (!quiet || c.hp <= 0) this.floats.push({ x: c.x, y: c.y - 34, text: c.hp > 0 ? "-1 ♥" : "KO!", life: 0.9, color: "#ff6b6b" });
    if (c.hp <= 0) this.lose(c, cause);
  }

  private collect(p: PowerUp, c: Climber) {
    p.taken = true;
    const d = CFG.effectDurations;
    /** Stack the timer rather than restart it, never past the effect's ceiling. */
    const add = (k: keyof ActiveEffects) => {
      this.effects[k] = Math.min(CFG.effectCaps[k], this.effects[k] + d[k]);
    };
    switch (p.kind) {
      case "coin": this.coins += CFG.coinValue; this.runCoins += CFG.coinValue; this.a.sfx.coin(); this.events.onCoins(CFG.coinValue); this.floats.push({ x: p.x, y: p.y, text: `+${CFG.coinValue}`, life: 0.9, color: "#ffd23f" }); break;
      case "gem": this.gems += 1; this.runGems += 1; this.a.sfx.coin(); this.events.onGems(1); this.floats.push({ x: p.x, y: p.y, text: "+1 gem", life: 1, color: "#7ef0ff" }); break;
      case "magnet": add("superMagnet"); this.a.sfx.power(); this.floats.push({ x: p.x, y: p.y, text: "SUPER MAGNET", life: 1.2, color: "#ff4d4d" }); break;
      case "slowmo": add("slowmo"); this.a.sfx.power(); this.floats.push({ x: p.x, y: p.y, text: "SLOW-MO", life: 1.2, color: "#c77dff" }); break;
      case "candy": add("candy"); this.a.sfx.power(); this.floats.push({ x: p.x, y: p.y - 30, text: "CANDY DROP", life: 1.2, color: "#ff8fb0" });
        this.drops.push({ x: p.x, y: p.y, vx: (this.simNoise(p.x) - 0.5) * 120, vy: -120, spin: 0 }); break;
      case "heart": {
        const healed = c.hp < CFG.maxHp;
        c.hp = Math.min(CFG.maxHp, c.hp + 1);
        this.a.sfx.power();
        this.floats.push({ x: p.x, y: p.y, text: healed ? "+1 ♥" : "FULL ♥", life: 1, color: "#ff5c8a" });
        break;
      }
      case "reach": add("reach"); this.a.sfx.power(); this.floats.push({ x: p.x, y: p.y, text: "LONG ARMS", life: 1.2, color: "#9be15d" }); break;
      case "paint": {
        this.feats.paints++;
        // cosmetic only, and off the sim RNG so a replay of the same seed repaints the same
        const palette = this.palette.filter((col) => col !== c.color);
        c.color = palette[Math.floor(this.simNoise(p.x + p.y) * palette.length) % palette.length] ?? c.color;
        c.pattern = undefined;
        this.a.sfx.power();
        this.burst(p.x, p.y, c.color, 14);
        this.floats.push({ x: p.x, y: p.y, text: "NEW COAT", life: 1.2, color: c.color });
        break;
      }
      case "extra": {
        const n = this.makeClimber(p.x, p.y, "flying");
        n.vx = (this.simNoise(n.id) - 0.5) * 100; n.vy = -80; n.airTime = 0; n.leftLauncher = true;
        this.climbers.push(n);
        this.a.sfx.power();
        this.floats.push({ x: p.x, y: p.y, text: "+1 FRIEND", life: 1.2, color: n.color });
        break;
      }
    }
    this.burst(p.x, p.y, "#ffffff", 8);
    this.events.onPower(p.kind, { x: p.x, y: p.y });
    void c;
  }

  /** Stateless seeded noise: independent of rendering and preserved by run snapshots. */
  private simNoise(id: number): number {
    let n = (this.world.seed ^ Math.imul(id, 374761393) ^ Math.round(this.time * 120)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  private burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.4 + Math.random() * 0.4, color });
    }
  }

  /** Player chose to stop: the run counts, no revive. */
  ended = false;
  forceEnd() {
    if (this.phase === "dead") return;
    this.ended = true;
    this.phase = "dead";
    this.drag = null;
    this.events.onGameOver();
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
    const n = 1;
    for (let i = 0; i < n; i++) {
      const x = this.world.isMetal(W * 0.3, sy) ? W * 0.3 + i * 30 : W * 0.7 - i * 30;
      const c = this.makeClimber(x, sy, "stuck");
      this.climbers.push(c);
    }
    this.floorY = sy + CFG.floorStartOffset;
    this.phase = "running";
    this.pickDefaultSelection();
    this.effects.slowmo = 2;
    this.a.sfx.chime();
  }
}
