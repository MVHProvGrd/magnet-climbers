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
export const EFFECTS: Record<string, readonly Voice[]> = {
  launch: [{ frequency: 145, endFrequency: 510, duration: 0.22, gain: 0.12, type: "triangle" }, { frequency: 900, endFrequency: 2400, duration: 0.12, gain: 0.035, type: "noise" }],
  // Drawing the sling: rubber creaking under tension. The whole effect is pitched
  // up as the draw grows (see sfx.stretch(rate)), so a full pull sings.
  stretch: [
    { frequency: 150, endFrequency: 215, duration: 0.13, gain: 0.045, type: "triangle" },
    { frequency: 460, endFrequency: 700, duration: 0.1, gain: 0.02, type: "noise" },
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
