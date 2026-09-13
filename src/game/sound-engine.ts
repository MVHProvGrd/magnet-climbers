import { EFFECTS, MUSIC_STEP, musicStep, type Voice } from "./music-score";
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
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    let seed = 1847; const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) { seed = Math.imul(seed, 1664525) + 1013904223 | 0; data[i] = (seed >>> 0) / 2147483648 - 1; }
    return ctx;
  } catch { ctx = null; return null; }
}
/** Called by user gestures only; no autoplay workarounds. */
export function unlockAudio() {
  unlocked = true;
  if (!enabled && !musicEnabled) return;
  const c = context(); if (c?.state === "suspended") void c.resume().catch(() => {});
}
export function setSound(on: boolean) { enabled = on; if (ctx) fxBus.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.015); }
export function setMusic(on: boolean) { musicEnabled = on; if (ctx && !on) { musicTarget = 0; target(musicBus, 0, ctx.currentTime, .02); } }
export function silenceAudio() { active = false; masterTarget = 0; if (ctx) { target(master, 0, ctx.currentTime, .01); nextNote = ctx.currentTime; } }
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
function effect(name: string) {
  if (!enabled || !active) return;
  const c = context(); if (!c || c.state !== "running") return;
  if (c.currentTime - (lastEffect.get(name) ?? -10) < (name === "stretch" ? 0.12 : 0.035)) return;
  lastEffect.set(name, c.currentTime);
  for (const voice of EFFECTS[name]) playVoice(c, voice, c.currentTime, fxBus);
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
function loadTracks(c: AudioContext) {
  if (tracksState !== "idle" || typeof fetch !== "function" || typeof c.decodeAudioData !== "function") return;
  tracksState = "loading";
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  Promise.all((Object.keys(TRACKS) as (keyof typeof TRACKS)[]).map(async (name) => {
    const res = await fetch(`${base}audio/${TRACKS[name]}`); if (!res.ok) throw new Error(String(res.status));
    const buffer = await c.decodeAudioData(await res.arrayBuffer());
    const source = c.createBufferSource(); source.buffer = buffer; source.loop = true;
    source.loopStart = Math.min(MP3_DELAY, buffer.duration); source.loopEnd = Math.min(buffer.duration, MP3_DELAY + LOOP_SECONDS);
    const gain = c.createGain(); gain.gain.value = 0; source.connect(gain).connect(musicBus);
    trackGain[name] = gain; return source;
  })).then((sources) => { const t = c.currentTime + 0.05; for (const s of sources) s.start(t, MP3_DELAY); tracksState = "ready"; })
    .catch(() => { tracksState = "failed"; });
}
/** Existing render loop supplies a short scheduling horizon; no hidden timers. */
export function updateAudio(playing: boolean, danger = 0, chill = false) {
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
export const sfx = Object.fromEntries(Object.keys(EFFECTS).map((name) => [name, () => effect(name)])) as Record<keyof typeof EFFECTS, () => void>;
