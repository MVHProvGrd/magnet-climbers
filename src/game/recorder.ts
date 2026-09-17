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
}

/** A tape is capped so a long session cannot grow without limit; a run this long is not a ghost. */
export const MAX_EVENTS = 4000;

export class Recorder {
  readonly events: TapeEvent[] = [];
  private full = false;
  private broken = false;

  /**
   * A run picked up from a snapshot has already been climbed for a while with nothing recorded,
   * so its tape would replay into a different climb. Better no tape than a lying one.
   */
  invalidate(): void { this.broken = true; }

  fling(t: number, id: number, v: Vec): void {
    this.push({ t: round(t), k: "fling", id, v: { x: round(v.x), y: round(v.y) } });
  }
  move(t: number, id: number, to: Vec): void {
    this.push({ t: round(t), k: "move", id, to: { x: round(to.x), y: round(to.y) } });
  }
  private push(e: TapeEvent): void {
    if (this.full) return;
    this.events.push(e);
    if (this.events.length >= MAX_EVENTS) this.full = true;
  }

  /** Seal the tape. `null` when there is nothing worth keeping. */
  tape(meta: Omit<Tape, "v" | "events">): Tape | null {
    if (this.broken || !this.events.length) return null;
    return { v: 1, ...meta, events: this.events.slice() };
  }
}

/** Two decimal places is finer than any input and keeps a tape small. */
const round = (n: number): number => Math.round(n * 100) / 100;

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
  dt = 1 / 120,
): T {
  let t = 0;
  for (const e of tape.events) {
    // step up to the moment, then do the thing that happened at it
    let guard = 0;
    while (t + dt <= e.t && guard++ < 100_000) { step(game, dt); t += dt; }
    apply(game, e);
  }
  // and run out whatever was still in the air when the last input happened
  for (let i = 0; i < Math.ceil(Math.max(0, tape.seconds - t) / dt); i++) step(game, dt);
  return game;
}
