/**
 * Pressure test: bot climbers racing each other live through the deployed room.
 *
 * Twenty testers with different reactions, aim and nerve; each of the first ten races each
 * of the second ten once, so a hundred races, ten at a time, at several times real speed.
 * Everything a phone would do is done here -- the sim, the ghost, the inputs and heartbeats
 * over the socket, the tape at the end -- and everything the room says back is checked
 * against what the bots know for certain, since both sides of every race live in this
 * process: wire latency, whether the room's replay agrees with the run, whether the ghost
 * kept pace, whether a decided race was called, what a dropped socket costs.
 *
 * Run with scripts/pressure-race.mjs; it writes a JSON of every race and prints a summary.
 */
import { Game, type DeathCause } from "../src/game/game";
import { World } from "../src/game/world";
import { CFG, W, type UpgradeKey } from "../src/game/config";
import { LiveGhost } from "../src/game/ghost";
import { stepOf, STEP, type TapeEvent } from "../src/game/recorder";
import { writeFileSync } from "node:fs";
import { replayRace } from "../worker/src/replay";

const API = process.env.API ?? "https://magnet-climbers-api.magnetclimbers.workers.dev";
const ROUNDS = Number(process.env.ROUNDS ?? 10);
const PAIRS = Number(process.env.PAIRS ?? 10);
const RACE_CAP_MS = Number(process.env.RACE_CAP_MS ?? 150_000);
const SPEED = Number(process.env.SPEED ?? 6);
const OUT = process.env.OUT ?? "pressure-report.json";
const WORLD = new World(1, 0).version;
console.log(`pressure: api ${API} world ${WORLD} rounds ${ROUNDS} pairs ${PAIRS} speed ${SPEED}`);
const KIT = { magnet: 0, power: 0, floor: 0 } as Record<UpgradeKey, number>;
const FULL = CFG.maxDrag * CFG.launchScale;

// ---------------------------------------------------------------- testers
interface Tester { id: string; name: string; reaction: number; aim: number; power: number; reach: number; nerve: number; seed: number }
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const testers: Tester[] = Array.from({ length: 20 }, (_, i) => {
  const r = rng(1000 + i);
  return {
    id: `bot-${String(i + 1).padStart(2, "0")}`, name: `T${String(i + 1).padStart(2, "0")}`,
    reaction: 0.3 + r() * 0.9,      // seconds between landing and the next fling
    aim: r() * 36,                  // px of aim scatter
    power: 0.7 + r() * 0.3,         // share of a full pull
    reach: 170 + r() * 220,         // how far up it looks for the next hold
    nerve: r(),                     // how often it flings without a hold in sight
    seed: 77 + i,
  };
});

// ---------------------------------------------------------------- telemetry
interface Hit { cause: DeathCause; cm: number; t: number }
interface RunLog {
  tester: string; side: 0 | 1; cm: number; seconds: number; flings: number; coins: number; gems: number;
  pickups: Record<string, number>; hits: Hit[]; cause: DeathCause | "ended-early" | null;
  decidedBy: "death" | "ended" | "timeout"; ghostDriftCm: number | null; roomCm: number | null; verified: boolean | null;
  inputLatencyMs: number[]; endedLatencyMs: number | null; reconnected: boolean; restartOk: boolean | null; endedReplayed: boolean | null;
  /** the tape replayed here, by the sim in this build, so the deployed room's verdict can be told from the sim's */
  localReplayCm: number | null;
}
interface RaceLog { round: number; room: string; seed: number; startMs: number; wallMs: number; winner: string | null; rows: unknown; fault: string | null; error: string | null; runs: RunLog[] }

// every hit, with its cause, from the private damage() -- patched, not forked
type GameWithHits = Game & { __hits?: Hit[] };
const proto = Game.prototype as unknown as { damage: (...a: unknown[]) => unknown };
const origDamage = proto.damage;
proto.damage = function (this: GameWithHits, c: unknown, quiet: unknown, cause: DeathCause = "fell", intensity: unknown) {
  this.__hits?.push({ cause, cm: this.heightCm, t: this.time });
  return origDamage.call(this, c, quiet, cause, intensity);
};

// ---------------------------------------------------------------- the bot
class Bot {
  game: GameWithHits;
  ghost: LiveGhost;
  log: RunLog;
  cool = 0;
  private readonly r: () => number;
  private beat = 0;
  constructor(readonly t: Tester, seed: number, world: number, side: 0 | 1, readonly send: (m: unknown) => void, raceSeed: number) {
    this.r = rng(t.seed * 31 + raceSeed);
    const pickups: Record<string, number> = {};
    this.log = { tester: t.name, side, cm: 0, seconds: 0, flings: 0, coins: 0, gems: 0, pickups, hits: [], cause: null, decidedBy: "death",
      ghostDriftCm: null, roomCm: null, verified: null, inputLatencyMs: [], endedLatencyMs: null, reconnected: false, restartOk: null, endedReplayed: null, localReplayCm: null };
    this.game = new Game(KIT, {
      onPower: (k) => { pickups[k] = (pickups[k] ?? 0) + 1; }, onGameOver: () => {},
      onCoins: (n) => { this.log.coins += n; }, onGems: (n) => { this.log.gems += n; },
    }, { rules: "solo", seed, worldVersion: world, chill: false, lineup: [], silent: true, side }) as GameWithHits;
    this.game.__hits = this.log.hits;
    this.game.tape.onEvent = (e) => send({ k: "in", e });
    this.ghost = new LiveGhost(seed, world, undefined, side ? 0 : 1);
  }
  get dead(): boolean { return this.game.phase === "dead"; }
  step(): void {
    const g = this.game;
    // the ghost goes on after this run ends, as on a phone: the friend is still climbing
    if (g.phase === "dead") { this.ghost.step(STEP); return; }
    const c = g.climbers[0];
    this.cool -= STEP;
    if (c && (c.state === "stuck" || c.state === "linked") && this.cool <= 0) {
      const v = this.aim(c.x, c.y);
      if (v && g.launch(c, v)) { this.log.flings++; this.cool = this.t.reaction * (0.7 + this.r() * 0.6); }
      else this.cool = 0.15;
    }
    g.update(STEP);
    this.ghost.step(STEP);
    if (++this.beat % 15 === 0) this.send({ k: "in", e: { k: "tick", t: g.time, cm: g.heightCm } });
  }
  /** Looks for bare steel above and flings for it; without a hold in sight, flings anyway when nervy. */
  private aim(x: number, y: number): { x: number; y: number } | null {
    const w = this.game.world;
    w.ensure(y - 900);
    let best: { x: number; y: number; d: number } | null = null;
    for (let dy = this.t.reach * 0.55; dy <= this.t.reach * 1.6; dy += 28) {
      for (let tx = 34; tx <= W - 34; tx += 22) {
        if (Math.abs(tx - W / 2) < 28) continue; // the seam never holds
        if (!w.isMetal(tx, y - dy)) continue;
        const d = Math.abs(tx - x) * 0.8 + Math.abs(dy - this.t.reach);
        if (!best || d < best.d) best = { x: tx, y: y - dy, d };
      }
    }
    if (!best && this.r() > this.t.nerve) return null;
    const tx = (best?.x ?? (x < W / 2 ? W * 0.72 : W * 0.28)) + (this.r() - 0.5) * this.t.aim;
    const dy = best ? y - best.y : this.t.reach;
    // a fling that clears the hold by a little: up hard, across in proportion
    let vx = (tx - x) * 1.7, vy = -(dy * 1.35 + 260);
    const len = Math.hypot(vx, vy), cap = FULL * this.t.power;
    if (len > cap) { vx *= cap / len; vy *= cap / len; }
    return { x: vx, y: vy };
  }
  finish(cause: RunLog["cause"], by: RunLog["decidedBy"]): void {
    const g = this.game;
    this.log.cm = g.heightCm; this.log.seconds = g.runTime; this.log.cause = cause; this.log.decidedBy = by;
    this.game.tape.onEvent = null;
    const tape = g.sealTape(false);
    if (tape) { const v = replayRace(tape, this.log.side); this.log.localReplayCm = v.ok ? Math.min(v.cm, g.heightCm) : -1; }
    this.send({ k: "done", tape, cm: g.heightCm });
  }
}

// ---------------------------------------------------------------- one race
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function newRoom(): Promise<string> {
  const r = await fetch(`${API}/match`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!r.ok) throw new Error(`POST /match ${r.status}`);
  return ((await r.json()) as { id: string }).id;
}

interface Seat { t: Tester; ws: WebSocket | null; bot: Bot | null; start: { seed: number; world: number; side: 0 | 1 } | null; msgs: unknown[]; sent: Map<string, number>; diedAt: number | null; restarts: number; endedSeen: number; flush?: () => void }

async function race(round: number, a: Tester, b: Tester, fault: string | null): Promise<RaceLog> {
  const t0 = Date.now();
  const log: RaceLog = { round, room: "", seed: 0, startMs: 0, wallMs: 0, winner: null, rows: null, fault, error: null, runs: [] };
  const seats: Seat[] = [a, b].map((t) => ({ t, ws: null, bot: null, start: null, msgs: [], sent: new Map(), diedAt: null, restarts: 0, endedSeen: 0 }));
  let result: { rows: { id: string; cm: number; verified: boolean }[]; winner: string | null } | null = null;
  const url = `${API.replace(/^http/, "ws")}/match/`;
  try {
    log.room = await newRoom();
    const connect = (s: Seat) => new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${url}${log.room}/ws`);
      s.ws = ws;
      const timer = setTimeout(() => reject(new Error("socket open timeout")), 10000);
      ws.onopen = () => { clearTimeout(timer); ws.send(JSON.stringify({ k: "hello", id: s.t.id, name: s.t.name, world: WORLD, look: { creature: "toy", pattern: "solid" } })); s.flush?.(); resolve(); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error("socket error")); };
      ws.onmessage = (ev) => {
        const m = JSON.parse(String(ev.data)) as { k: string } & Record<string, unknown>;
        s.msgs.push(m);
        const other = seats.find((o) => o !== s)!;
        if (m.k === "start") {
          const st = { seed: m.seed as number, world: m.world as number, side: (m.side === 1 ? 1 : 0) as 0 | 1 };
          if (s.start) { s.restarts++; if (s.bot) s.bot.log.restartOk = st.seed === s.start.seed; return; }
          s.start = st;
        } else if (m.k === "in") {
          const e = m.e as TapeEvent | { k: "tick"; t: number; cm: number };
          const key = `${other.t.id}:${e.k}:${e.t}`;
          const at = other.sent.get(key); if (at != null && s.bot) s.bot.log.inputLatencyMs.push(Date.now() - at);
          if (!s.bot) return;
          if (e.k === "tick") s.bot.ghost.hear(stepOf(e.t)); else s.bot.ghost.feed(e as TapeEvent);
        } else if (m.k === "ended") {
          s.endedSeen++;
          if (s.bot && other.diedAt != null && s.bot.log.endedLatencyMs == null) s.bot.log.endedLatencyMs = Date.now() - other.diedAt;
          if (s.bot && s.endedSeen > 1) s.bot.log.endedReplayed = true;
          if (s.bot && !s.bot.dead && s.bot.game.heightCm > (m.cm as number)) {
            s.bot.ghost.end();
            s.bot.log.ghostDriftCm = Math.round(s.bot.ghost.heightCm - (m.cm as number));
            s.bot.game.forceEnd(); s.bot.finish("ended-early", "ended"); s.diedAt = Date.now();
          }
        } else if (m.k === "result") {
          result = m as unknown as typeof result;
        }
      };
    });
    await Promise.all(seats.map(connect));
    // wait for both starts
    for (let i = 0; i < 300 && !(seats[0].start && seats[1].start); i++) await sleep(50);
    if (!(seats[0].start && seats[1].start)) throw new Error(`no start: ${JSON.stringify(seats.map((s) => s.msgs.map((m) => (m as { k: string }).k)))}`);
    log.seed = seats[0].start.seed; log.startMs = Date.now() - t0;
    for (const s of seats) {
      const st = s.start!;
      const outbox: string[] = [];
      const send = (m: unknown) => {
        const e = (m as { e?: { k: string; t: number } }).e;
        if (e) s.sent.set(`${s.t.id}:${e.k}:${e.t}`, Date.now());
        const text = JSON.stringify(m);
        if (s.ws?.readyState === WebSocket.OPEN) { for (const q of outbox.splice(0)) s.ws.send(q); s.ws.send(text); }
        else if ((m as { k: string }).k !== "in" || !((m as { e: { k: string } }).e.k === "tick")) outbox.push(text);
      };
      s.flush = () => { if (s.ws?.readyState === WebSocket.OPEN) for (const q of outbox.splice(0)) s.ws.send(q); };
      s.bot = new Bot(s.t, st.seed, st.world, st.side, send, st.seed);
      s.bot.game.phase = "running";
    }
    // the race, several times real speed, both bots in lockstep
    const perTick = Math.max(1, Math.round(SPEED * 120 * 0.02));
    let simSteps = 0;
    const faultAt = fault === "drop" ? 120 * 6 : -1; // six seconds in, seat B drops for two seconds
    let faultDone = false;
    while (Date.now() - t0 < RACE_CAP_MS) {
      for (let i = 0; i < perTick; i++) {
        for (const s of seats) {
          const bot = s.bot!;
          if (bot.dead) { bot.step(); continue; }
          bot.step();
          if (bot.dead) { bot.finish(bot.game.lastCause, "death"); s.diedAt = Date.now(); }
        }
        simSteps++;
        if (simSteps === faultAt && !faultDone) {
          faultDone = true;
          const s = seats[1]; s.bot!.log.reconnected = true;
          s.ws?.close(); s.ws = null;
          setTimeout(() => { void connect(s).catch(() => {}); }, 2000);
        }
      }
      if (seats.every((s) => s.bot!.dead)) break;
      await sleep(20);
    }
    for (const s of seats) if (!s.bot!.dead) { s.bot!.game.forceEnd(); s.bot!.finish(null, "timeout"); s.diedAt = Date.now(); }
    // the room settles once both tapes are in
    for (let i = 0; i < 600 && !result; i++) await sleep(50);
    if (!result) throw new Error("no result within 30s of both tapes");
    const res = result as NonNullable<typeof result>;
    log.winner = res.winner; log.rows = res.rows;
    for (const s of seats) {
      const row = res.rows.find((r) => r.id === s.t.id);
      s.bot!.log.roomCm = row?.cm ?? null; s.bot!.log.verified = row?.verified ?? null;
      if (s.bot!.log.ghostDriftCm == null) { s.bot!.ghost.end(); s.bot!.ghost.step(STEP); const otherRow = res.rows.find((r) => r.id !== s.t.id); if (otherRow) s.bot!.log.ghostDriftCm = Math.round(s.bot!.ghost.heightCm - otherRow.cm); }
    }
  } catch (e) {
    log.error = String((e as Error)?.message ?? e);
  } finally {
    console.log(`  ${a.name} v ${b.name} room ${log.room || "-"} ${log.error ? "ERR " + log.error : `winner ${log.winner ?? "draw"} · ${seats.map((s) => `${s.t.name} ${s.bot?.game.heightCm ?? "?"}cm/${s.bot?.log.roomCm ?? "?"} ${s.bot?.log.decidedBy ?? ""}`).join(" · ")}`} · ${Math.round(log.wallMs / 1000)}s${fault ? " · fault " + fault : ""}`);
    for (const s of seats) { try { s.ws?.close(); } catch { /* gone */ } if (s.bot) log.runs.push(s.bot.log); }
    log.wallMs = Date.now() - t0;
  }
  return log;
}

// ---------------------------------------------------------------- schedule
(async () => {
  const races: RaceLog[] = [];
  for (let round = 0; round < ROUNDS; round++) {
    const batch = Array.from({ length: PAIRS }, (_, i) => {
      const a = testers[i], b = testers[10 + ((i + round) % 10)];
      const fault = (round * 10 + i) % 7 === 3 ? "drop" : null;
      return race(round, a, b, fault);
    });
    const done = await Promise.all(batch);
    races.push(...done);
    const ok = done.filter((r) => !r.error).length;
    console.log(`round ${round + 1}/${ROUNDS}: ${ok}/${PAIRS} settled, ${Math.round(Math.max(...done.map((r) => r.wallMs)) / 1000)}s`);
  }
  writeFileSync(OUT, JSON.stringify({ api: API, world: WORLD, speed: SPEED, testers, races }, null, 1));
  console.log(`wrote ${OUT}`);
  process.exit(0);
})();
