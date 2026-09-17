/**
 * A muted stand-in for the sound module.
 *
 * A ghost run is the whole simulation over again, stepped beside the real one so the ghost's
 * limbs, bounces and ragdoll are the real thing rather than a line interpolated through saved
 * positions. Everything it does, it does silently: those twangs and clicks were heard the day
 * the tape was recorded, and hearing them again over the live run would be two games playing
 * at once.
 *
 * So the sim takes its audio as a field rather than reaching for the module directly. That
 * also means the whole sim can now run somewhere with no sound at all — a Worker replaying a
 * daily tape to check a score, which is the next thing the tape is for.
 */
import type { sfx, playObjectSound, playBubbleSound, stopPullSound } from "./audio";

export interface GameAudio {
  sfx: typeof sfx;
  playObjectSound: typeof playObjectSound;
  playBubbleSound: typeof playBubbleSound;
  stopPullSound: typeof stopPullSound;
}

const nothing = (): void => { /* a ghost makes no sound */ };

/**
 * Every effect name answers, and answers with nothing. A Proxy rather than a hand-written
 * list so a new sound added to `sfx` cannot quietly throw inside a ghost months from now.
 */
const silentSfx = new Proxy({} as typeof sfx, {
  get: () => nothing,
  has: () => true,
});

export const silentAudio: GameAudio = {
  sfx: silentSfx,
  playObjectSound: nothing,
  playBubbleSound: nothing,
  stopPullSound: nothing,
};
