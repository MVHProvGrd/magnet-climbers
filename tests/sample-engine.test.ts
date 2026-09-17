import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setSound, setMusic, unlockAudio, updateAudio, silenceAudio, playObjectSound, playBubbleSound, pullSound, releaseSound } from '../src/game/audio';

test('approved samples obey unlock, FX mute, pause, POP exclusions and gesture release', async () => {
  let requests = 0, starts = 0, stopped = 0;
  class Param { value = 0; setValueAtTime(v: number) { this.value = v; } exponentialRampToValueAtTime() {} setTargetAtTime() {} cancelScheduledValues() {} }
  class Node {
    gain = new Param(); playbackRate = new Param(); frequency = new Param(); Q = new Param(); threshold = new Param(); ratio = new Param();
    buffer: unknown; onended?: () => void;
    connect(n: Node) { return n; } disconnect() {} start() { starts++; } stop() { stopped++; this.onended?.(); }
  }
  let ctx: Context;
  class Context {
    currentTime = 0; sampleRate = 48000; state = 'suspended'; destination = new Node();
    constructor() { ctx = this; }
    createGain() { return new Node(); } createDynamicsCompressor() { return new Node(); }
    createBuffer(_n: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { return new Node(); } createOscillator() { return new Node(); } createBiquadFilter() { return new Node(); }
    async resume() { this.state = 'running'; } async decodeAudioData() { return { duration: .4 }; }
  }
  const priorWindow = globalThis.window, priorFetch = globalThis.fetch;
  Object.assign(globalThis, { window: { AudioContext: Context } });
  globalThis.fetch = (async () => { requests++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; }) as typeof fetch;
  try {
    setMusic(false); setSound(true);
    playObjectSound('swing-keys'); pullSound(.5); assert.equal(requests, 0); assert.equal(starts, 0);
    unlockAudio(); assert.ok(requests <= 6, 'at most two three-take banks fetching concurrently');
    await new Promise(resolve => setTimeout(resolve, 0)); updateAudio(true);
    assert.equal(requests, 105, 'all 35 banks warm after unlock');
    assert.equal(starts, 0, 'warming does not play sounds');
    playObjectSound('swing-keys'); assert.equal(starts, 1);
    playObjectSound('swing-toy-4'); playObjectSound('bumper-4'); assert.equal(starts, 1);
    playBubbleSound(true); assert.equal(starts, 2);
    pullSound(.7); assert.equal(starts, 3);
    releaseSound(.7); assert.equal(starts, 4); assert.ok(stopped >= 1, 'release stops pull tail');
    setSound(false); const muted = starts; assert.ok(stopped >= 4);
    ctx!.currentTime += 1; playObjectSound('swing-keys'); releaseSound(1); assert.equal(starts, muted);
    setSound(true); ctx!.currentTime += 1; playObjectSound('rotor-fidget-spinner'); assert.equal(starts, muted + 1);
    updateAudio(false); const paused = starts; ctx!.currentTime += 2; playObjectSound('swing-keys'); assert.equal(starts, paused);
    updateAudio(true); playObjectSound('swing-keys'); assert.equal(starts, paused + 1);
    silenceAudio(); const hidden = starts; ctx!.currentTime += 2; releaseSound(1); assert.equal(starts, hidden);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorWindow) globalThis.window = priorWindow; else Reflect.deleteProperty(globalThis, 'window');
  }
});
