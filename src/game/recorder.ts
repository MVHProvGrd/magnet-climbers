/**
 * The input recorder.
 *
 * A run is deterministic: the same seed, the same world version and the same inputs in the same
 * order always produce the same climb. So a tape is just the seed and a list of moments —
 * `{ t, id, v }` for a fling, `{ t, id, to }` for a climb — and everything else can be rebuilt.
 *
 * Nothing in the game shows a tape yet. It exists because three things want it and none of them
 * can start without it: a ghost of your own best run, racing a friend's recording from a share
 * link, and a server that can check a score by replaying it rather than trusting the number.
 *
 * It is written to be cheap enough to leave on: a fling is a handful of numbers, a long run is a
 * few hundred of them, and a full tape of a five-minute climb is a couple of kilobytes of JSON.
 */
import type { Vec } from "./types";

/** One thing the player did, at the run time it happened. */
export type TapeEvent =
  | { t: number; k: "fling"; id: number; v: Vec }
  | { t: number; k: "move"; id: number; to: Vec };

export interface Tape {
  /** bumped when the shape of a tape changes, so an old one is not replayed as a new one */
  v: 1;
  seed: number;
  /** the world generator's version: terrain from another version is a different climb */
  world: number;
  /** the upgrade levels the run was played with, because they change the physics */
  kit: Record<string, number>;
  chill: boolean;
  /** true for the daily climb, which is the one worth checking */
  daily: boolean;
  events: TapeEvent[];
  /** what the run finished at, for a quick check before anyone replays it */
  cm: number;
  seconds: number;
  /** the creature and pattern the run was climbed in, so a ghost of it wears them */
  look?: { creature: string; pattern: string };
}

/** A tape is capped so a long session cannot grow without limit; a run this long is not a ghost. */
export const MAX_EVENTS = 4000;

export class Recorder {
  readonly events: TapeEvent[] = [];
  private full = false;
  private broken = false;
  /** the live race listens here: every event goes out the moment it is written */
  onEvent: ((e: TapeEvent) => void) | null = null;

  /**
   * A run picked up from a snapshot has already been climbed for a while with nothing recorded,
   * so its tape would replay into a different climb. Better no tape than a lying one.
   */
  invalidate(): void { this.broken = true; }

  fling(t: number, id: number, v: Vec): void {
    this.push({ t: snap(t), k: "fling", id, v: { x: round(v.x), y: round(v.y) } });
  }
  move(t: number, id: number, to: Vec): void {
    this.push({ t: snap(t), k: "move", id, to: { x: round(to.x), y: round(to.y) } });
  }
  private push(e: TapeEvent): void {
    if (this.full) return;
    this.events.push(e);
    this.onEvent?.(e);
    if (this.events.length >= MAX_EVENTS) this.full = true;
  }

  /** Seal the tape. `null` when there is nothing worth keeping. */
  tape(meta: Omit<Tape, "v" | "events">): Tape | null {
    if (this.broken || !this.events.length) return null;
    return { v: 1, ...meta, events: this.events.slice() };
  }
}

/**
 * Positions to two decimal places: finer than any input, and it keeps a tape small. The sim
 * quantises every fling and move to this before using it, so the run a phone plays and the
 * run its tape replays into are fed the very same numbers -- with the raw float used live
 * and the rounded one on replay, a long climb drifted apart by a hold or two.
 */
export const quantize = (n: number): number => Math.round(n * 100) / 100;
const round = quantize;
/** The fixed step the sim runs at. A tape's clock is counted in these, never in wall time. */
export const STEP = 1 / 120;
/**
 * Times are snapped onto the step grid and stored to four places. Two places was not enough:
 * the step is 8.33 ms, so steps 3 and 4 both rounded to 0.03 and a replay could not tell
 * which one a fling belonged to - it applied it a step early and the climb diverged. Four
 * places keeps every step distinct (the closest pair differ by 0.0083), so `stepOf` gets the
 * exact step back, and a Worker replaying the tape lands each input on the same step it
 * was played on.
 */
const snap = (t: number): number => Math.round(Math.round(t / STEP) * STEP * 10000) / 10000;
/** The step index an event belongs to. Inverse of `snap`. */
export const stepOf = (t: number): number => Math.round(t / STEP);

/** Rough size of a tape on the wire, for deciding whether to keep or send one. */
export const tapeBytes = (tape: Tape): number => JSON.stringify(tape).length;

/**
 * Replay a tape into a game. The caller owns the Game (this module knows nothing about it), so
 * it hands in a stepper and a way to apply one event; that keeps the recorder free of the sim
 * and lets the Worker replay with a headless build later.
 */
export function replay<T>(
  tape: Tape,
  game: T,
  apply: (game: T, e: TapeEvent) => void,
  step: (game: T, dt: number) => void,
  /** stop early once this says so - a verifier stops at the death it is checking for */
  done: (game: T) => boolean = () => false,
  dt = STEP,
): T {
  // Counted in whole steps, not accumulated seconds: `t += dt` a few thousand times drifts
  // off the grid and lands an input a step early or late, and one step is enough to turn
  // a catch into a miss. The live run played each input before the step it is stamped
  // with, so the replay does the same: run up to that step, apply, then keep stepping.
  let n = 0;
  for (const e of tape.events) {
    const at = stepOf(e.t);
    while (n < at) { if (done(game)) return game; step(game, dt); n++; }
    apply(game, e);
  }
  // and run out whatever was still in the air when the last input happened
  const end = Math.max(n, Math.ceil(tape.seconds / dt));
  while (n < end) { if (done(game)) return game; step(game, dt); n++; }
  return game;
}
