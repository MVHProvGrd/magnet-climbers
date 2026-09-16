import assert from "node:assert/strict";
import { test } from "node:test";
import { setSound, setMusic, unlockAudio, updateAudio, silenceAudio, sfx } from "../src/game/audio";
import { Game } from "../src/game/game";
import { UPGRADES, type UpgradeKey } from "../src/game/config";
import { loadSave } from "../src/game/save";

test("audio waits for gestures, separates music/SFX, mutes on pause and bounds scheduling", () => {
  let created = 0, starts = 0, automation = 0;
  const sources: FakeNode[] = [];
  class Param {
    value = 0;
    setValueAtTime(v: number, t: number) { assert.ok(Number.isFinite(v + t)); this.value = v; }
    exponentialRampToValueAtTime(v: number, t: number) { assert.ok(v > 0 && Number.isFinite(v + t)); }
    setTargetAtTime(v: number, t: number, speed: number) { assert.ok(Number.isFinite(v + t + speed)); this.value = v; automation++; }
    cancelScheduledValues(_t: number) {}
  }
  class FakeNode {
    gain = new Param(); frequency = new Param(); Q = new Param(); threshold = new Param(); ratio = new Param();
    onended?: () => void; end = Infinity; type = ""; buffer: unknown;
    connect(node: FakeNode) { return node; }
    disconnect() {}
    start(t: number) { assert.ok(t >= audio.currentTime - .001); starts++; sources.push(this); }
    stop(t: number) { this.end = t; }
  }
  let audio: FakeContext;
  class FakeContext {
    currentTime = 0; sampleRate = 8000; state = "suspended"; destination = new FakeNode(); buses: FakeNode[] = [];
    constructor() { created++; audio = this; }
    createGain() { const node = new FakeNode(); this.buses.push(node); return node; }
    createDynamicsCompressor() { return new FakeNode(); }
    createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
    createOscillator() { return new FakeNode(); }
    createBufferSource() { return new FakeNode(); }
    createBiquadFilter() { return new FakeNode(); }
    async resume() { this.state = "running"; }
    advance(dt: number) { this.currentTime += dt; for (const node of sources) if (node.onended && node.end <= this.currentTime) { node.onended(); node.onended = undefined; } }
  }
  const priorWindow = globalThis.window;
  Object.assign(globalThis, { window: { AudioContext: FakeContext } });
  try {
    setSound(true); setMusic(true); updateAudio(true); sfx.launch(); assert.equal(created, 0);
    unlockAudio(); assert.equal(created, 1); updateAudio(true); assert.ok(starts > 0);
    const scheduled = starts, changes = automation;
    for (let i = 0; i < 10; i++) updateAudio(true);
    assert.equal(starts, scheduled); assert.equal(automation, changes, "do not queue gain automation every frame");
    setMusic(false); const mutedMusic = starts; audio!.advance(1); updateAudio(true); assert.equal(starts, mutedMusic);
    assert.equal(audio!.buses[1].gain.value, 0);
    sfx.stick(); assert.ok(starts > mutedMusic); const fx = starts;
    setSound(false); sfx.launch(); assert.equal(starts, fx); assert.equal(audio!.buses[0].gain.value, 0);
    setMusic(true); audio!.advance(1); updateAudio(true, 1); assert.ok(starts > fx);
    updateAudio(false); const paused = starts; assert.equal(audio!.buses[2].gain.value, 0);
    audio!.advance(100); updateAudio(false); sfx.swipe(); assert.equal(starts, paused);
    updateAudio(true, 1); assert.ok(starts - paused < 10, "no backlog burst after suspension");
    silenceAudio(); assert.equal(audio!.buses[2].gain.value, 0);
    setSound(true); const hidden = starts; sfx.coin(); assert.equal(starts, hidden);
    for (let i = 0; i < 600; i++) { audio!.advance(1/60); updateAudio(true, i / 600); }
    assert.ok(sources.filter((s) => s.onended).length < 16);
    audio!.advance(2); setSound(false); setMusic(false); silenceAudio();
  } finally { if (priorWindow) globalThis.window = priorWindow; else Reflect.deleteProperty(globalThis, "window"); }
});

test("legacy muted profiles stay muted; separate music preference persists", () => {
  const prior = globalThis.localStorage;
  let data = { version: 1, sound: false } as Record<string, unknown>;
  Object.assign(globalThis, { localStorage: { getItem: () => JSON.stringify(data) } });
  try {
    assert.equal(loadSave().music, false);
    data = { version: 1, sound: false, music: true }; assert.equal(loadSave().music, true);
    data = { version: 1, sound: true, music: false }; assert.equal(loadSave().music, false);
    data = { version: 1 }; assert.equal(loadSave().music, true);
  } finally { if (prior) globalThis.localStorage = prior; else Reflect.deleteProperty(globalThis, "localStorage"); }
});

test("drawing the sling creaks: every notch of pull asks for the rubber", () => {
  const levels = Object.fromEntries(UPGRADES.map((u) => [u.key, 0])) as Record<UpgradeKey, number>;
  const g = new Game(levels, { onPower() {}, onGameOver() {}, onCoins() {}, onGems() {} }, { seed: 7, rules: "solo" });
  g.phase = "running";
  const c = g.climbers[0];
  g.pointerDown({ x: c.x, y: c.y });
  assert.ok(g.drag, "a press on a climber starts the draw");
  const rates: number[] = [];
  const real = sfx.stretch;
  sfx.stretch = (rate?: number) => { rates.push(rate ?? 1); };
  try {
    for (let i = 1; i <= 6; i++) g.pointerMove({ x: c.x, y: c.y + i * 18 });
  } finally { sfx.stretch = real; }
  assert.equal(rates.length, 6, "every notch of draw creaks");
  assert.ok(rates.every((r, i) => i === 0 || r >= rates[i - 1]), "and creaks higher as the band tightens");
  assert.ok(rates[rates.length - 1] > rates[0], "a long pull ends up above where it started");
  // a move with no drag, or in move mode, stays silent
  const quiet: number[] = [];
  sfx.stretch = (rate?: number) => { quiet.push(rate ?? 1); };
  try { g.mode = "move"; g.pointerMove({ x: c.x, y: c.y + 400 }); g.drag = null; g.pointerMove({ x: c.x, y: c.y + 500 }); }
  finally { sfx.stretch = real; g.mode = "fling"; }
  assert.equal(quiet.length, 0);
});
