/** Original 96 BPM toy-box score; pure data also used by offline audio QA. */
export interface Voice { frequency: number; duration: number; gain: number; type: "sine" | "triangle" | "noise"; endFrequency?: number; delay?: number }
export const MUSIC_STEP = 60 / 96 / 2;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const melody = [12, 16, 19, -1, 16, 14, 12, -1, 19, 21, 19, 16, 14, -1, 16, 19];
export function musicStep(step: number, danger: number, chill = false): Voice[] {
  const root = [48, 45, 41, 43][Math.floor(step / 8) % 4], beat = step % 8;
  const notes: Voice[] = [];
  if (beat % 4 === 0) notes.push({ frequency: hz(root), duration: 0.45, gain: 0.25, type: "triangle" });
  const pitch = melody[step % 16];
  if (pitch >= 0) {
    notes.push({ frequency: hz(root + pitch), duration: 0.23, gain: 0.24, type: "sine" });
    notes.push({ frequency: hz(root + pitch + 12), duration: 0.055, gain: 0.035, type: "sine" });
  }
  if (!chill && danger > 0.3 && beat % 2 === 1) notes.push({ frequency: 3800, duration: 0.045, gain: 0.025 + danger * 0.025, type: "noise" });
  if (!chill && danger > 0.65 && beat % 2 === 0) notes.push({ frequency: 100, endFrequency: 45, duration: 0.11, gain: 0.18, type: "sine" });
  if (!chill && danger > 0.75 && beat === 7) notes.push({ frequency: hz(root + 31), duration: 0.1, gain: 0.07, type: "triangle" });
  return notes;
}
/**
 * What each hanging toy says when it is knocked. Ids are the world's item ids, so a toy
 * on a keyring (`swing-toy-N`) sounds like the same toy stuck straight on the door
 * (`bumper-N`). Anything not listed swings in silence.
 */
export const TOY_VOICE: Record<string, string> = {
  "bumper-0": "bell", "bumper-1": "squeak", "bumper-2": "blip", "bumper-3": "roar",
  "bumper-5": "bell", "bumper-6": "taxi", "bumper-7": "revv", "bumper-8": "boing",
  "bumper-9": "whoosh", "bumper-10": "clack", "bumper-11": "tick", "bumper-12": "boing",
  "rotor-fidget-spinner": "whirr", "rotor-pinwheel": "flutter",
  "rotor-snack": "clack", "rotor-travel": "clack", "rotor-doodle": "clack",
  "swing-keys": "keys", "swing-bottle-opener": "clink", "swing-disco-ball": "chime",
  "swing-rubber-duck": "squeak", "swing-bead-lanyard": "rattle", "swing-carabiner-whistle": "whistleToot",
  "swing-wind-chime": "chime", "swing-baby-shoe": "bell", "swing-scissors": "snip",
  "swing-measuring-spoons": "rattle", "swing-souvenir-spoon": "clink", "swing-fishing-lure": "rattle",
  "swing-snack": "clink", "swing-travel": "clink", "swing-doodle": "clink",
};
// the POP! toy (bumper-4) keeps its own bubble sounds, so it is deliberately absent above
export const EFFECTS: Record<string, readonly Voice[]> = {
  launch: [{ frequency: 145, endFrequency: 510, duration: 0.22, gain: 0.12, type: "triangle" }, { frequency: 900, endFrequency: 2400, duration: 0.12, gain: 0.035, type: "noise" }],
  // Drawing the sling: rubber creaking under tension. The whole effect is pitched
  // up as the draw grows (see sfx.stretch(rate)), so a full pull sings.
  // It lives in the mid band on purpose: the first version creaked at 150 Hz and
  // a phone speaker, which has nothing below about 400, simply did not play it.
  stretch: [
    { frequency: 300, endFrequency: 430, duration: 0.14, gain: 0.12, type: "triangle" },
    { frequency: 1250, endFrequency: 1900, duration: 0.12, gain: 0.055, type: "noise" },
    { frequency: 600, endFrequency: 860, duration: 0.1, gain: 0.035, type: "sine" },
  ],
  // Letting go: the band snaps back past its rest length and wobbles.
  twang: [
    { frequency: 420, endFrequency: 90, duration: 0.17, gain: 0.11, type: "triangle" },
    { frequency: 260, endFrequency: 150, duration: 0.12, delay: 0.04, gain: 0.05, type: "sine" },
    { frequency: 1500, endFrequency: 500, duration: 0.05, gain: 0.035, type: "noise" },
  ],
  // Landing on steel: the magnet's click plus the door's low boom. The other
  // materials are the same gesture voiced for what you actually hit.
  stick: [{ frequency: 1850, duration: 0.045, gain: 0.07, type: "sine" }, { frequency: 2700, duration: 0.065, gain: 0.025, type: "sine" }, { frequency: 130, endFrequency: 65, duration: 0.065, gain: 0.11, type: "triangle" }],
  /** glass: a bright ring with no magnet click under it */
  hitGlass: [{ frequency: 2950, duration: 0.19, gain: 0.05, type: "sine" }, { frequency: 4400, duration: 0.11, gain: 0.02, type: "sine" }, { frequency: 1200, endFrequency: 700, duration: 0.04, gain: 0.03, type: "noise" }],
  /** plastic trim and bins: a dull hollow tock */
  hitPlastic: [{ frequency: 360, endFrequency: 210, duration: 0.07, gain: 0.09, type: "triangle" }, { frequency: 900, endFrequency: 500, duration: 0.035, gain: 0.03, type: "noise" }],
  /** paper: a soft rustle, barely pitched */
  hitPaper: [{ frequency: 2600, endFrequency: 1500, duration: 0.07, gain: 0.05, type: "noise" }, { frequency: 1500, endFrequency: 900, duration: 0.05, delay: 0.04, gain: 0.035, type: "noise" }],
  /** ice tray: a cold tick and a little skid, since ice is what you slide on */
  hitIce: [{ frequency: 3300, duration: 0.05, gain: 0.05, type: "sine" }, { frequency: 2200, endFrequency: 3600, duration: 0.16, delay: 0.02, gain: 0.03, type: "noise" }],
  // A knocked taxi keychain honks: two short beeps a fourth apart, each with its harmonic
  // above it so it reads as a little brass horn rather than a sine tone.
  taxi: [
    { frequency: 622, duration: 0.11, gain: 0.09, type: "triangle" },
    { frequency: 1244, duration: 0.09, gain: 0.035, type: "sine" },
    { frequency: 830, duration: 0.15, delay: 0.14, gain: 0.09, type: "triangle" },
    { frequency: 1660, duration: 0.12, delay: 0.14, gain: 0.03, type: "sine" },
  ],
  // ---- toy voices -------------------------------------------------------------
  // What each hanging thing says when a climber brushes past it. Short, quiet and
  // distinct: several toys share a voice where they would really sound alike.
  /** rubber duck, and the duck keyring: a squeeze, up then down */
  squeak: [
    { frequency: 900, endFrequency: 1500, duration: 0.09, gain: 0.08, type: "sine" },
    { frequency: 1500, endFrequency: 760, duration: 0.11, delay: 0.09, gain: 0.07, type: "sine" },
    { frequency: 2400, duration: 0.05, gain: 0.02, type: "noise" },
  ],
  /** tin robot: two flat blips, the second a step up */
  blip: [
    { frequency: 520, duration: 0.07, gain: 0.07, type: "triangle" },
    { frequency: 780, duration: 0.09, delay: 0.1, gain: 0.07, type: "triangle" },
  ],
  /** plastic dinosaur: a small growl */
  roar: [
    { frequency: 150, endFrequency: 90, duration: 0.3, gain: 0.1, type: "triangle" },
    { frequency: 420, endFrequency: 220, duration: 0.26, gain: 0.05, type: "noise" },
  ],
  /** race car: a short rev */
  revv: [
    { frequency: 110, endFrequency: 320, duration: 0.22, gain: 0.09, type: "triangle" },
    { frequency: 600, endFrequency: 1500, duration: 0.2, gain: 0.035, type: "noise" },
  ],
  /** space shuttle: a rising rush of air */
  /** a fidget spinner let go: bearings singing, fading as it coasts down */
  whirr: [
    { frequency: 900, endFrequency: 1500, duration: 0.12, gain: 0.035, type: "noise" },
    { frequency: 1500, endFrequency: 600, duration: 0.5, delay: 0.1, gain: 0.03, type: "noise" },
    { frequency: 220, endFrequency: 150, duration: 0.45, delay: 0.08, gain: 0.025, type: "triangle" },
  ],
  /** a paper pinwheel: no bearing, just air in the vanes */
  flutter: [
    { frequency: 600, endFrequency: 1200, duration: 0.3, gain: 0.03, type: "noise" },
    { frequency: 1100, endFrequency: 500, duration: 0.3, delay: 0.22, gain: 0.022, type: "noise" },
  ],
  whoosh: [
    { frequency: 400, endFrequency: 2600, duration: 0.3, gain: 0.07, type: "noise" },
    { frequency: 180, endFrequency: 320, duration: 0.28, gain: 0.05, type: "sine" },
  ],
  /** wooden alphabet block: a dry knock */
  clack: [
    { frequency: 320, endFrequency: 190, duration: 0.06, gain: 0.1, type: "triangle" },
    { frequency: 1400, duration: 0.03, gain: 0.03, type: "noise" },
  ],
  /** plastic brick, and the pop toy's cousins: a hard tick */
  tick: [
    { frequency: 900, endFrequency: 600, duration: 0.04, gain: 0.08, type: "triangle" },
    { frequency: 2600, duration: 0.02, gain: 0.025, type: "noise" },
  ],
  /** gummy bear and banana: soft and rubbery */
  boing: [
    { frequency: 260, endFrequency: 520, duration: 0.1, gain: 0.08, type: "sine" },
    { frequency: 520, endFrequency: 300, duration: 0.14, delay: 0.09, gain: 0.05, type: "sine" },
  ],
  /** iced donut, and the penguin: one small round bell */
  bell: [
    { frequency: 1320, duration: 0.24, gain: 0.06, type: "sine" },
    { frequency: 1980, duration: 0.16, gain: 0.02, type: "sine" },
  ],
  /** house keys: a handful of metal on a ring */
  keys: [
    { frequency: 2600, duration: 0.05, gain: 0.05, type: "noise" },
    { frequency: 3100, duration: 0.05, delay: 0.05, gain: 0.045, type: "noise" },
    { frequency: 2300, duration: 0.07, delay: 0.11, gain: 0.04, type: "noise" },
    { frequency: 1800, duration: 0.09, delay: 0.18, gain: 0.03, type: "noise" },
  ],
  /** one piece of metal against another: bottle opener, spoon, carabiner */
  clink: [
    { frequency: 2100, duration: 0.09, gain: 0.06, type: "sine" },
    { frequency: 3150, duration: 0.06, gain: 0.025, type: "sine" },
  ],
  /** wind chime and disco ball: a little falling arpeggio */
  chime: [
    { frequency: 1568, duration: 0.3, gain: 0.05, type: "sine" },
    { frequency: 1319, duration: 0.3, delay: 0.09, gain: 0.045, type: "sine" },
    { frequency: 1047, duration: 0.34, delay: 0.19, gain: 0.04, type: "sine" },
  ],
  /** beads, measuring spoons, a lure's rattle: many small things at once */
  rattle: [
    { frequency: 1800, duration: 0.05, gain: 0.045, type: "noise" },
    { frequency: 2400, duration: 0.05, delay: 0.04, gain: 0.04, type: "noise" },
    { frequency: 1500, duration: 0.06, delay: 0.09, gain: 0.035, type: "noise" },
  ],
  /** the whistle on the carabiner, and the referee in every kid's pocket */
  whistleToot: [
    { frequency: 2093, duration: 0.16, gain: 0.05, type: "sine" },
    { frequency: 2217, duration: 0.16, gain: 0.025, type: "sine" },
    { frequency: 3000, duration: 0.1, gain: 0.02, type: "noise" },
  ],
  /** kitchen scissors: two quick snips */
  snip: [
    { frequency: 2800, duration: 0.03, gain: 0.05, type: "noise" },
    { frequency: 2400, duration: 0.04, delay: 0.07, gain: 0.045, type: "noise" },
  ],
  link: [{ frequency: 660, duration: 0.12, gain: 0.09, type: "sine" }, { frequency: 990, duration: 0.13, delay: 0.07, gain: 0.06, type: "sine" }],
  coin: [{ frequency: 1050, duration: 0.07, gain: 0.07, type: "sine" }, { frequency: 1575, duration: 0.16, delay: 0.055, gain: 0.055, type: "sine" }],
  power: [{ frequency: 523, duration: 0.15, gain: 0.08, type: "triangle" }, { frequency: 659, duration: 0.17, delay: 0.07, gain: 0.07, type: "sine" }, { frequency: 784, duration: 0.25, delay: 0.14, gain: 0.06, type: "sine" }],
  bump: [{ frequency: 115, endFrequency: 45, duration: 0.16, gain: 0.16, type: "sine" }, { frequency: 700, duration: 0.045, gain: 0.05, type: "noise" }],
  lost: [{ frequency: 390, endFrequency: 110, duration: 0.3, gain: 0.07, type: "triangle" }],
  over: [{ frequency: 330, duration: 0.25, gain: 0.07, type: "triangle" }, { frequency: 261, duration: 0.3, delay: 0.16, gain: 0.07, type: "triangle" }, { frequency: 196, duration: 0.45, delay: 0.33, gain: 0.07, type: "sine" }],
  warning: [{ frequency: 740, duration: 0.12, gain: 0.09, type: "sine" }, { frequency: 988, duration: 0.12, delay: 0.18, gain: 0.08, type: "sine" }],
  swipe: [{ frequency: 550, endFrequency: 3200, duration: 0.30, gain: 0.11, type: "noise" }],
  // POP! bubbles: short pitch-drop pops, three flavours, and a duller one for pushing a bubble back in
  pop1: [{ frequency: 1500, endFrequency: 600, duration: 0.07, gain: 0.09, type: "sine" }, { frequency: 2400, duration: 0.03, gain: 0.03, type: "noise" }],
  pop2: [{ frequency: 1900, endFrequency: 750, duration: 0.06, gain: 0.09, type: "sine" }, { frequency: 3000, duration: 0.03, gain: 0.03, type: "noise" }],
  pop3: [{ frequency: 1200, endFrequency: 480, duration: 0.08, gain: 0.09, type: "sine" }, { frequency: 2000, duration: 0.035, gain: 0.03, type: "noise" }],
  popIn: [{ frequency: 700, endFrequency: 330, duration: 0.09, gain: 0.08, type: "triangle" }],
  // the kid crunching a candy drop: three quick crunchy bites
  munch: [{ frequency: 1800, endFrequency: 500, duration: 0.07, gain: 0.11, type: "noise" }, { frequency: 1400, endFrequency: 450, duration: 0.07, delay: 0.13, gain: 0.1, type: "noise" }, { frequency: 2100, endFrequency: 600, duration: 0.06, delay: 0.26, gain: 0.09, type: "noise" }, { frequency: 160, endFrequency: 90, duration: 0.08, gain: 0.06, type: "sine" }],
  // cat paw tap: a soft thud with a brush of fur
  paw: [{ frequency: 170, endFrequency: 70, duration: 0.14, gain: 0.14, type: "sine" }, { frequency: 900, endFrequency: 400, duration: 0.09, gain: 0.04, type: "noise" }],
  trick: [{ frequency: 784, duration: 0.1, gain: 0.07, type: "sine" }, { frequency: 1175, duration: 0.16, delay: 0.08, gain: 0.06, type: "sine" }, { frequency: 1568, duration: 0.2, delay: 0.14, gain: 0.04, type: "sine" }],
};
