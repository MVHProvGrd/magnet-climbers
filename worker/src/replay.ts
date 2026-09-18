/**
 * Check a daily score by climbing it again.
 *
 * A score used to be a number the client sent, and a console fetch took #1 on the daily board
 * in one line. Nothing about tokens fixes that - a token proves who you are, not what you
 * climbed. What fixes it is the thing the recorder was built for: the sim is deterministic,
 * a run is a tape of a few hundred inputs, and the Worker has the same sim. So the daily
 * post carries the tape, the Worker replays it on the day's fridge, and the height it gets is
 * the score. The number the client sent is only a claim to compare against.
 *
 * The sim is the game's own `Game`, headless: it never touches the DOM, `silent` swaps the
 * audio for a no-op, and everything it draws is simply never drawn. The same bundle the
 * tests run in Node runs here.
 *
 * Bounded on every axis a hostile tape could push on: event count, byte size, step count,
 * and CPU. A tape that fails a bound is refused before a single step runs.
 */
import { Game } from "../../src/game/game";
import { replay, stepOf, MAX_EVENTS, STEP, type Tape, type TapeEvent } from "../../src/game/recorder";
import type { UpgradeKey } from "../../src/game/config";
import type { Vec } from "../../src/game/types";

/** The daily's seed: the same FNV-1a over the day key the client uses. Pinned by a test. */
export function dailySeed(day: string): number {
  let hash = 2166136261;
  for (let i = 0; i < day.length; i++) hash = Math.imul(hash ^ day.charCodeAt(i), 16777619);
  return (hash >>> 0) || 1;
}

/** Longest run a tape may describe: ninety minutes of steps, ~9 s of CPU at the measured rate. */
export const MAX_STEPS = 90 * 60 * 120;
/** A replay gives up after this much wall time, well inside a Durable Object's budget. */
export const REPLAY_BUDGET_MS = 20_000;
/** A tape on the wire: MAX_EVENTS flings at ~60 bytes each, with headroom. */
export const MAX_TAPE_BYTES = 300_000;
/** The daily is climbed with an empty kit, so a tape claiming otherwise did not come from one. */
const DAILY_KIT: Record<UpgradeKey, number> = { magnet: 0, power: 0, floor: 0 };

export type Verdict =
  | { ok: true; cm: number; steps: number; ms: number }
  | { ok: false; reason: string; cm?: number; steps?: number; ms?: number };

/** Structural checks, cheap and first. Returns a reason or null. */
export function checkTape(raw: unknown, day: string, worldVersion: number): { tape: Tape } | { reason: string } {
  const t = raw as Partial<Tape> | null;
  if (t && typeof t === "object" && t.v === 1 && !t.daily) return { reason: "not a daily tape" };
  return checkTapeOn(raw, dailySeed(day), worldVersion, "wrong day");
}

/** A live race tape: the same shape, on the seed the room dealt rather than the day's. */
export function checkRaceTape(raw: unknown, seed: number, worldVersion: number): { tape: Tape } | { reason: string } {
  return checkTapeOn(raw, seed, worldVersion, "wrong fridge");
}

function checkTapeOn(raw: unknown, seed: number, worldVersion: number, wrongSeed: string): { tape: Tape } | { reason: string } {
  if (!raw || typeof raw !== "object") return { reason: "no tape" };
  const t = raw as Partial<Tape>;
  if (t.v !== 1) return { reason: "tape version" };
  if (!Array.isArray(t.events) || !t.events.length) return { reason: "no events" };
  if (t.events.length > MAX_EVENTS) return { reason: "too many events" };
  if (t.chill) return { reason: "chill tape" };
  if (t.seed !== seed) return { reason: wrongSeed };
  if (t.world !== worldVersion) return { reason: "wrong world" };
  const kit = t.kit ?? {};
  for (const k of Object.keys(DAILY_KIT) as UpgradeKey[]) if ((kit[k] ?? 0) !== 0) return { reason: "kit on a daily" };
  if (!Number.isFinite(t.cm) || !Number.isFinite(t.seconds)) return { reason: "bad totals" };
  let last = -1;
  for (const e of t.events as TapeEvent[]) {
    if (!e || typeof e.t !== "number" || !Number.isFinite(e.t) || e.t < 0) return { reason: "bad event time" };
    // on the grid, and in order: the recorder never writes anything else
    const n = stepOf(e.t);
    if (Math.abs(e.t - n * STEP) > 0.001) return { reason: "event off the step grid" };
    if (n < last) return { reason: "events out of order" };
    if (n > MAX_STEPS) return { reason: "run too long" };
    last = n;
    if (!Number.isInteger(e.id) || e.id < 0 || e.id > 16) return { reason: "bad climber id" };
    if (e.k === "fling") { if (!finiteVec(e.v)) return { reason: "bad fling" }; }
    else if (e.k === "move") { if (!finiteVec(e.to)) return { reason: "bad move" }; }
    else return { reason: "unknown event" };
  }
  return { tape: t as Tape };
}

const finiteVec = (v: unknown): v is Vec =>
  !!v && typeof v === "object" && Number.isFinite((v as Vec).x) && Number.isFinite((v as Vec).y)
  && Math.abs((v as Vec).x) < 1e5 && Math.abs((v as Vec).y) < 1e5;

const NO_EVENTS = { onPower: () => {}, onGameOver: () => {}, onCoins: () => {}, onGems: () => {} };

/**
 * Replay a checked tape and report the height the sim reaches. The run is stepped until it
 * ends (the climber is lost) or the recorded length runs out, whichever is first, and never
 * past MAX_STEPS.
 */
export const replayRace = (tape: Tape): Verdict => replayDaily(tape);

export function replayDaily(tape: Tape): Verdict {
  const game = new Game(DAILY_KIT, NO_EVENTS, {
    rules: "solo", seed: tape.seed, worldVersion: tape.world, chill: false, lineup: [], silent: true,
  });
  let steps = 0;
  const t0 = Date.now();
  const apply = (g: Game, e: TapeEvent) => {
    const c = g.climbers.find((x) => x.id === e.id);
    if (!c || c.state === "lost") return;
    if (e.k === "fling") g.launch(c, e.v); else g.move(c, e.to);
  };
  const step = (g: Game, dt: number) => { g.update(dt); steps++; };
  let overBudget = false;
  const done = (g: Game) => {
    if (g.phase === "dead" || steps >= MAX_STEPS) return true;
    // checked every second of run, not every step: the clock is dearer than a step
    if (steps % 120 === 0 && Date.now() - t0 > REPLAY_BUDGET_MS) { overBudget = true; return true; }
    return false;
  };
  try {
    replay(tape, game, apply, step, done);
  } catch (err) {
    return { ok: false, reason: `replay threw: ${String((err as Error)?.message ?? err).slice(0, 80)}`, steps, ms: Date.now() - t0 };
  }
  if (overBudget) return { ok: false, reason: "too long to verify", cm: game.heightCm, steps, ms: Date.now() - t0 };
  if (steps >= MAX_STEPS && game.phase !== "dead") return { ok: false, reason: "run too long", cm: game.heightCm, steps, ms: Date.now() - t0 };
  return { ok: true, cm: game.heightCm, steps, ms: Date.now() - t0 };
}

/**
 * The whole check: is the claimed height something this tape actually climbs to?
 *
 * The rule is `claimed <= replayed`. A claim below the replay is fine - the run may have been
 * quit before it died and the replay carried on - but the row keeps the claim, never more.
 * Replaying a stolen tape under your own name is the residual: a much higher bar than a
 * fetch, and the tape's day and world already stop it being reused tomorrow.
 */
export function verifyDaily(raw: unknown, claimedCm: number, day: string, worldVersion: number): Verdict {
  const checked = checkTape(raw, day, worldVersion);
  if ("reason" in checked) return { ok: false, reason: checked.reason };
  const v = replayDaily(checked.tape);
  if (!v.ok) return v;
  if (claimedCm > v.cm) return { ok: false, reason: "claim above replay", cm: v.cm, steps: v.steps, ms: v.ms };
  return v;
}
