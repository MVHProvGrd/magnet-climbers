import { EFFECTS, MUSIC_STEP, musicStep, type Voice } from "./music-score";
import { TOY_VOICE } from "./music-score";
import { OBJECT_SAMPLES } from "./object-sound-map";
import { SamplePlayer } from "./sample-player";
let samples: SamplePlayer | null = null;
let ctx: AudioContext | null = null;
let fxBus: GainNode, musicBus: GainNode, master: GainNode, noise: AudioBuffer;
let enabled = true, musicEnabled = true, unlocked = false, active = true;
let nextNote = 0, step = 0, voices = 0;
let masterTarget = .8, musicTarget = 0;
function target(bus: GainNode, value: number, time: number, speed: number) {
  bus.gain.cancelScheduledValues(time); bus.gain.setTargetAtTime(value, time, speed);
}
const lastEffect = new Map<string, number>();
function context(): AudioContext | null {
  if (!unlocked || typeof window === "undefined" || (!ctx && !enabled && !musicEnabled)) return null;
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    fxBus = ctx.createGain(); musicBus = ctx.createGain(); master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -12; limiter.ratio.value = 8;
    fxBus.connect(master); musicBus.connect(master); master.connect(limiter).connect(ctx.destination);
    fxBus.gain.value = enabled ? 0.7 : 0; musicBus.gain.value = musicTarget; master.gain.value = masterTarget;
    const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
    samples = new SamplePlayer(ctx, fxBus, base);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    let seed = 1847; const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) { seed = Math.imul(seed, 1664525) + 1013904223 | 0; data[i] = (seed >>> 0) / 2147483648 - 1; }
    return ctx;
  } catch { ctx = null; return null; }
}
/**
 * iOS keeps Web Audio under the ring/silent switch until the page has played through a media
 * element; one silent clip on the first gesture moves the page to the playback session and
 * the game is heard with the switch down, like any other game.
 */
let sessionOpened = false;
function openMediaSession() {
  // typed loosely: this file is also compiled for the Worker, which has no media elements
  const AudioEl = (globalThis as { Audio?: new (src: string) => { setAttribute(n: string, v: string): void; volume: number; play(): Promise<void> } }).Audio;
  if (sessionOpened || !AudioEl) return;
  sessionOpened = true;
  try {
    const a = new AudioEl("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
    a.setAttribute("playsinline", ""); a.volume = 0.01;
    void a.play().catch(() => { sessionOpened = false; });
  } catch { sessionOpened = false; }
}
/** Called by user gestures only; no autoplay workarounds. */
export function unlockAudio() {
  unlocked = true;
  if (!enabled && !musicEnabled) return;
  openMediaSession();
  // "suspended" before the first gesture; "interrupted" on iOS after a call or another app
  const c = context(); if (c && c.state !== "running") void c.resume().catch(() => {});
  if (c && enabled) {
    // Gestures first, then warm object sounds in bounded batches, not 99 parallel fetches.
    for (const key of ['rubber-pull', 'rubber-release', ...new Set(Object.values(OBJECT_SAMPLES)), 'pop-in', 'pop-out']) samples?.preload(key);
  }
}
/** Back in the foreground: an iOS context left "interrupted" by another app is resumed. */
export function resumeAudio() { if (ctx && unlocked && ctx.state !== "running") void ctx.resume().catch(() => {}); }
export function setSound(on: boolean) { enabled = on; if (!on) samples?.stopGroup(); if (ctx) fxBus.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.015); }
export function setMusic(on: boolean) { musicEnabled = on; if (ctx && !on) { musicTarget = 0; target(musicBus, 0, ctx.currentTime, .02); } }
export function silenceAudio() { active = false; samples?.stopGroup(); masterTarget = 0; if (ctx) { target(master, 0, ctx.currentTime, .01); nextNote = ctx.currentTime; } }
function playVoice(c: AudioContext, voice: Voice, at: number, bus: GainNode) {
  if (voices >= 64) return;
  const t = at + (voice.delay ?? 0), gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, voice.gain), t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + voice.duration); gain.connect(bus);
  let source: OscillatorNode | AudioBufferSourceNode, filter: BiquadFilterNode | undefined;
  if (voice.type === "noise") {
    const n = c.createBufferSource(); n.buffer = noise; source = n;
    filter = c.createBiquadFilter(); filter.type = "bandpass"; filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(voice.frequency, t);
    if (voice.endFrequency) filter.frequency.exponentialRampToValueAtTime(voice.endFrequency, t + voice.duration);
    source.connect(filter).connect(gain);
  } else {
    const o = c.createOscillator(); o.type = voice.type; source = o; o.frequency.setValueAtTime(voice.frequency, t);
    if (voice.endFrequency) o.frequency.exponentialRampToValueAtTime(voice.endFrequency, t + voice.duration);
    source.connect(gain);
  }
  voices++;
  source.onended = () => { source.disconnect(); filter?.disconnect(); gain.disconnect(); voices--; };
  source.start(t); source.stop(t + voice.duration + 0.02);
}
/** `rate` pitches the whole effect: the sling uses it so the creak climbs with the draw.
 * `gainMul` scales its loudness, for effects like bump() where the impact itself varies. */
function effect(name: string, rate = 1, gainMul = 1) {
  if (!enabled || !active) return;
  const c = context(); if (!c || c.state !== "running") return;
  if (c.currentTime - (lastEffect.get(name) ?? -10) < (name === "stretch" ? 0.055 : 0.035)) return;
  lastEffect.set(name, c.currentTime);
  for (const voice of EFFECTS[name]) {
    const v = rate === 1 && gainMul === 1 ? voice : {
      ...voice, gain: voice.gain * gainMul,
      ...(rate !== 1 ? { frequency: voice.frequency * rate, ...(voice.endFrequency ? { endFrequency: voice.endFrequency * rate } : {}) } : {}),
    };
    playVoice(c, v, c.currentTime, fxBus);
  }
}

function sample(key: string, gain: number, rate = 1, group = 'object', cooldown = .18) {
  if (!enabled || !active) return 'limited';
  const c = context(); if (!c || c.state !== 'running') return 'limited';
  return samples?.play(key, gain, rate, group, cooldown) ?? 'pending';
}
/** Called only on the world's debounced contact event. Pending loads use the old sound,
 * but never replay the collision later when decoding completes. */
export function playObjectSound(itemId: string, strength = 1) {
  const key = OBJECT_SAMPLES[itemId];
  const voice = TOY_VOICE[itemId] ?? TOY_VOICE[itemId.replace(/^swing-toy-/, 'bumper-')];
  // no approved sample for this one yet: its written voice is the sound, not silence
  if (!key) { if (voice) effect(voice); return; }
  const power = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : .5;
  if (sample(key, .25 + .35 * power) === 'pending' && voice) effect(voice);
}
export function playBubbleSound(inward: boolean, index = 0) {
  if (sample(inward ? 'pop-in' : 'pop-out', .65, 1, 'bubble', .08) === 'pending') effect(inward ? 'popIn' : ['pop1', 'pop2', 'pop3'][index % 3]);
}
export function pullSound(tension: number) {
  const pull = Number.isFinite(tension) ? Math.max(0, Math.min(1, tension)) : 0;
  if (sample('rubber-pull', .45 + pull * .25, .85 + pull * .55, 'pull', .075) === 'pending') effect('stretch', 1 + pull * .8);
}
export function stopPullSound() { samples?.stopGroup('pull'); }
export function releaseSound(tension: number) {
  stopPullSound();
  const pull = Number.isFinite(tension) ? Math.max(0, Math.min(1, tension)) : 0;
  if (sample('rubber-release', .5 + pull * .35, .9 + pull * .2, 'release', .06) === 'pending') effect('twang', .85 + pull * .5);
}
/**
 * Looped music tracks (public/audio/*.mp3): "theme" under runs and the menu, "chill" in Chill mode.
 * Both loop continuously once decoded and are mixed by gain, so switching modes is a crossfade.
 * Until they load (or if they fail, e.g. offline before the first cache) the generative score plays.
 */
const TRACKS = { theme: "theme.mp3", chill: "chill.mp3" } as const;
const LOOP_SECONDS = 60 / 112 * 4 * 16, MP3_DELAY = 1105 / 48000;
const trackGain: Partial<Record<keyof typeof TRACKS, GainNode>> = {};
let tracksState: "idle" | "loading" | "ready" | "failed" = "idle", trackMix: keyof typeof TRACKS | null = null;
/**
 * Cut the loop out of the decoded MP3 once, and de-click its seam.
 *
 * The loop points were already sample-exact -- 34.2857 s is 64 beats at 112 BPM, with the
 * encoder's 23 ms of head padding and 16 ms of tail skipped -- but the waveform still steps
 * from +0.15 to +0.01 across the join, and a step in a waveform is a click. Every 34
 * seconds you hear the edit.
 *
 * A few milliseconds of fade at each end removes the step. It is far too short to hear as a
 * level change (this is how a sampler de-clicks a one-shot) and it cannot drift, because the
 * trimmed buffer loops on itself with no offsets left to get wrong.
 */
const DECLICK_MS = 4;
function loopTrim(c: AudioContext, decoded: AudioBuffer): AudioBuffer {
  const sr = decoded.sampleRate;
  const start = Math.round(MP3_DELAY * sr);
  const length = Math.min(Math.round(LOOP_SECONDS * sr), decoded.length - start);
  if (length <= 0 || typeof c.createBuffer !== "function") return decoded;
  const out = c.createBuffer(decoded.numberOfChannels, length, sr);
  const fade = Math.min(Math.round((DECLICK_MS / 1000) * sr), Math.floor(length / 2));
  for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
    const src = decoded.getChannelData(ch), dst = out.getChannelData(ch);
    dst.set(src.subarray(start, start + length));
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      dst[i] *= k;
      dst[length - 1 - i] *= k;
    }
  }
  return out;
}

function loadTracks(c: AudioContext) {
  if (tracksState !== "idle" || typeof fetch !== "function" || typeof c.decodeAudioData !== "function") return;
  tracksState = "loading";
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  Promise.all((Object.keys(TRACKS) as (keyof typeof TRACKS)[]).map(async (name) => {
    const res = await fetch(`${base}audio/${TRACKS[name]}`); if (!res.ok) throw new Error(String(res.status));
    const buffer = loopTrim(c, await c.decodeAudioData(await res.arrayBuffer()));
    const source = c.createBufferSource(); source.buffer = buffer; source.loop = true;
    source.loopStart = 0; source.loopEnd = buffer.duration;
    const gain = c.createGain(); gain.gain.value = 0; source.connect(gain).connect(musicBus);
    trackGain[name] = gain; return source;
  })).then((sources) => { const t = c.currentTime + 0.05; for (const s of sources) s.start(t); tracksState = "ready"; })
    .catch(() => { tracksState = "failed"; });
}
/** Existing render loop supplies a short scheduling horizon; no hidden timers. */
export function updateAudio(playing: boolean, danger = 0, chill = false) {
  if (!playing) samples?.stopGroup();
  active = playing; const c = context(); if (!c || c.state !== "running") return;
  const m = playing ? .8 : 0, music = playing && musicEnabled ? .6 : 0;
  if (m !== masterTarget) { target(master, m, c.currentTime, .025); masterTarget = m; }
  if (music !== musicTarget) { target(musicBus, music, c.currentTime, .05); musicTarget = music; }
  if (!playing || !musicEnabled) { nextNote = c.currentTime; return; }
  if (musicEnabled) loadTracks(c);
  if (tracksState === "ready") {
    const want: keyof typeof TRACKS = chill ? "chill" : "theme";
    if (want !== trackMix) {
      trackMix = want;
      for (const name of Object.keys(trackGain) as (keyof typeof TRACKS)[]) target(trackGain[name]!, name === want ? 0.9 : 0, c.currentTime, 0.4);
    }
    nextNote = c.currentTime; return;
  }
  if (nextNote < c.currentTime - 0.2) nextNote = c.currentTime;
  while (nextNote < c.currentTime + 0.12) {
    for (const voice of musicStep(step++, Math.max(0, Math.min(1, danger)), chill)) playVoice(c, voice, nextNote, musicBus);
    nextNote += MUSIC_STEP;
  }
}
export const sfx = Object.fromEntries(Object.keys(EFFECTS).map((name) => [name, (rate?: number) => effect(name, rate)])) as Record<keyof typeof EFFECTS, (rate?: number) => void>;
// Preserve the existing gesture API (and pitch parameters) while replacing its timbre.
sfx.stretch = (rate = 1) => pullSound((rate - 1) / .8);
sfx.twang = (rate = 1) => releaseSound((rate - .85) / .5);
// Every collision used to sound identical regardless of how hard it landed. `intensity` (0-1,
// impact speed vs. a reference) now scales the loudness only, same convention as playObjectSound:
// a graze stays a soft tock, a full-speed bumper hit lands like one.
sfx.bump = (intensity = 1) => {
  const power = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : .5;
  effect("bump", 1, 0.4 + 0.6 * power);
};
