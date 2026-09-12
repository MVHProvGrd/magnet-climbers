/** Tiny synth so the game has feedback without shipping audio files. */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSound(on: boolean) {
  enabled = on;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.08, slide = 0) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

export const sfx = {
  launch: () => tone(220, 0.18, "triangle", 0.09, 300),
  stick: () => tone(160, 0.08, "square", 0.06, -60),
  link: () => { tone(440, 0.07, "sine", 0.07); setTimeout(() => tone(660, 0.09, "sine", 0.07), 60); },
  coin: () => { tone(880, 0.06, "square", 0.05); setTimeout(() => tone(1320, 0.1, "square", 0.05), 50); },
  power: () => { tone(520, 0.1, "sawtooth", 0.05, 400); },
  bump: () => tone(90, 0.15, "sawtooth", 0.1, -40),
  lost: () => tone(300, 0.35, "sawtooth", 0.06, -250),
  over: () => { tone(200, 0.3, "triangle", 0.08, -120); setTimeout(() => tone(150, 0.5, "triangle", 0.08, -100), 250); },
};
