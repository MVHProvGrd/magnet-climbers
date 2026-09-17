import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { SamplePlayer } from '../src/game/sample-player';
import { OBJECT_SAMPLES } from '../src/game/object-sound-map';

test('object samples cover every approved non-POP alias and shipped files', () => {
  const map = JSON.parse(readFileSync('art/archive/33-object-audio-v1/item-map.json', 'utf8'));
  for (const [id, key] of Object.entries(map.items)) {
    if (id === 'bumper-4' || id === 'swing-toy-4') { assert.equal(OBJECT_SAMPLES[id], undefined); continue; }
    assert.equal(OBJECT_SAMPLES[id], key);
  }
  for (const key of [...new Set(Object.values(OBJECT_SAMPLES)), 'pop-in', 'pop-out', 'rubber-pull', 'rubber-release']) {
    for (let take = 1; take <= 3; take++) assert.ok(existsSync(`public/audio/objects-v1/${key}-${take}.mp3`));
  }
});

test('sample playback: lazy loading, no delayed replay, variants, limits, fades, retry', async () => {
  let requests = 0, starts = 0, stops = 0;
  const played: unknown[] = [];
  class Param { value = 1; cancelScheduledValues() {} setTargetAtTime() {} }
  class Node {
    buffer: unknown; gain = new Param(); playbackRate = new Param(); onended?: () => void;
    connect(n: Node) { return n; } disconnect() {}
    start() { starts++; played.push(this.buffer); } stop() { stops++; this.onended?.(); }
  }
  let decoded = 0;
  const c = { currentTime: 0, createGain: () => new Node(), createBufferSource: () => new Node(),
    decodeAudioData: async () => ({ duration: .4, id: ++decoded }) };
  const prior = globalThis.fetch;
  globalThis.fetch = (async () => { requests++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) }; }) as typeof fetch;
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    const p = new SamplePlayer(c as unknown as AudioContext, new Node() as unknown as GainNode, '/');
    assert.equal(requests, 0);
    assert.equal(p.play('keys'), 'pending');
    p.preload('keys'); assert.equal(requests, 3, 'coalesce concurrent loads');
    await flush(); assert.equal(starts, 0, 'decoding never replays stale hits');
    c.currentTime += .2;
    assert.equal(p.play('keys'), 'played');
    assert.equal(p.play('keys'), 'limited');
    c.currentTime += .2; p.play('keys'); assert.notEqual(played[0], played[1]);
    c.currentTime += .2; p.play('keys'); c.currentTime += .2; p.play('keys');
    c.currentTime += .2; assert.equal(p.play('keys'), 'limited', 'four simultaneous object sounds maximum');
    p.stopGroup(); assert.equal(stops, 4);
    c.currentTime += .2; assert.equal(p.play('keys'), 'played');
    p.stopGroup();
    p.preload('rubber-pull'); await flush();
    c.currentTime += .2; p.play('rubber-pull', .6, 1, 'pull', .075);
    c.currentTime += .1; p.play('rubber-pull', .6, 1.3, 'pull', .075);
    assert.equal(stops, 6, 'new pull fades previous pull');
    p.stopGroup();
    globalThis.fetch = (async () => { requests++; throw Error('offline'); }) as typeof fetch;
    p.preload('missing'); await flush(); const failed = requests;
    p.preload('missing'); assert.equal(requests, failed, 'failed requests back off');
    c.currentTime += 31; p.preload('missing'); await flush(); assert.equal(requests, failed + 3);
  } finally { globalThis.fetch = prior; }
});
