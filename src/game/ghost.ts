/**
 * The ghost: a climb that already happened, running beside the one happening now.
 *
 * A line on the fridge tells you how far you got last time. It does not tell you that you
 * wasted eleven seconds on the third door, or that the run you are so pleased with is
 * already behind the one you beat last week. A ghost does, continuously, without a word.
 *
 * It is not an interpolation through saved positions. It is the whole simulation again:
 * a second `Game`, built from the tape's seed, kit and world version, stepped at the same
 * fixed 1/120 as the live run, fed the tape's flings and moves at the run times they
 * happened. Determinism is what makes this cheap — the tape is a few hundred numbers and
 * the sim rebuilds the rest — and it is what makes the ghost honest: it bounces off the
 * same bumper, takes the same hit, and ragdolls the same way it did on the day.
 *
 * Which is also why a ghost only means anything on the door it was recorded on. Racing a
 * tape and generating a fresh fridge are the same decision, so whoever starts the run hands
 * the seed to the world and the tape to this.
 */
import { Game, type RunEvents } from "./game";
import { stepOf, type Tape, type TapeEvent } from "./recorder";
import type { Climber, Vec } from "./types";
import type { Look } from "./creatures";
import type { UpgradeKey } from "./config";

/** A ghost changes nothing outside itself: no coins, no gems, no scores, no saving. */
const NO_EVENTS: RunEvents = {
  onPower: () => {}, onGameOver: () => {}, onCoins: () => {}, onGems: () => {},
};

export class Ghost {
  private readonly game: Game;
  private readonly events: TapeEvent[];
  /** how far down the event list we have got */
  private at = 0;
  /** steps taken, which is what the tape counts in - not seconds, which drift */
  private n = 0;

  constructor(readonly tape: Tape, look?: Look) {
    this.events = tape.events;
    this.game = new Game(tape.kit as Record<UpgradeKey, number>, NO_EVENTS, {
      rules: "solo",
      seed: tape.seed,
      worldVersion: tape.world,
      chill: tape.chill,
      lineup: look ? [look] : [],
      silent: true,
    });
    // The tape counts steps from the moment the door appeared, so the wait before the first
    // fling is part of it - and it is not dead time, the door was moving. Take those steps
    // now, in one go, so the ghost starts climbing when the live run does instead of standing
    // there for as long as the recorded player did.
    const first = this.events.length ? stepOf(this.events[0].t) : 0;
    while (this.n < first) { this.game.update(1 / 120); this.n++; }
  }

  /** The ghost's climber, or null once the recorded run is over. */
  get climber(): Climber | null {
    const c = this.game.climbers[0];
    return c && !this.done ? c : null;
  }

  /** How high the ghost is, in the same centimetres the HUD counts. */
  get heightCm(): number { return this.game.heightCm; }

  /** The recorded run has played out; there is nothing further to draw. */
  get done(): boolean { return this.at >= this.events.length && this.n >= this.tape.seconds * 120; }

  /**
   * One step of the live run is one step of the ghost. An input stamped with step N was
   * played after N updates and before the next, so it is applied when the ghost has taken
   * exactly N steps, then the step runs - the order the recorder wrote it in.
   */
  step(dt: number): void {
    if (this.done) return;
    while (this.at < this.events.length && stepOf(this.events[this.at].t) <= this.n) {
      this.apply(this.events[this.at]);
      this.at++;
    }
    this.game.update(dt);
    this.n++;
  }

  private apply(e: TapeEvent): void {
    const c = this.game.climbers.find((x) => x.id === e.id);
    if (!c || c.state === "lost") return;
    if (e.k === "fling") this.game.launch(c, e.v as Vec);
    else this.game.move(c, e.to as Vec);
  }
}

/**
 * The tape of the best climb on this device. Kept under its own key rather than inside the
 * save, because it is a few kilobytes of numbers nobody needs when the save is synced.
 */
export const TAPE_KEY = "magnet-climbers:tape:v1";

export function loadBestTape(): Tape | null {
  try {
    const raw = localStorage.getItem(TAPE_KEY);
    if (!raw) return null;
    const tape = JSON.parse(raw) as Tape;
    // a tape from another shape of recorder, or another fridge, is not this run's ghost
    return tape && tape.v === 1 && Array.isArray(tape.events) && tape.events.length ? tape : null;
  } catch { return null; }
}

export function saveBestTape(tape: Tape): void {
  try { localStorage.setItem(TAPE_KEY, JSON.stringify(tape)); } catch { /* full, or a private window */ }
}
