/** Lazy, bounded one-shot bank. Loading never queues a late collision sound. */
export class SamplePlayer {
  private buffers = new Map<string, AudioBuffer[]>();
  private loading = new Set<string>();
  private queued = new Set<string>();
  private retryAt = new Map<string, number>();
  private lastTake = new Map<string, number>();
  private lastHit = new Map<string, number>();
  private live = new Set<{ source: AudioBufferSourceNode; gain: GainNode; group: string }>();
  constructor(private c: AudioContext, private bus: GainNode, private base: string) {}

  preload(key: string) {
    if (this.buffers.has(key) || this.loading.has(key) || this.c.currentTime < (this.retryAt.get(key) ?? -1)) return;
    if (typeof fetch !== 'function' || typeof this.c.decodeAudioData !== 'function') return;
    if (this.loading.size >= 2) { this.queued.add(key); return; }
    this.queued.delete(key);
    this.loading.add(key);
    void Promise.all([1, 2, 3].map(async take => {
      const response = await fetch(`${this.base}audio/objects-v1/${key}-${take}.wav`);
      if (!response.ok) throw new Error(`sample HTTP ${response.status}`);
      return this.c.decodeAudioData(await response.arrayBuffer());
    })).then(buffers => { this.buffers.set(key, buffers); })
      .catch(() => { this.retryAt.set(key, this.c.currentTime + 30); })
      .finally(() => {
        this.loading.delete(key);
        const next = this.queued.values().next().value;
        if (next) { this.queued.delete(next); this.preload(next); }
      });
  }

  play(key: string, gain = .5, rate = 1, group = 'object', cooldown = .18): 'played' | 'pending' | 'limited' {
    const now = this.c.currentTime, hitKey = `${group}:${key}`;
    if (now - (this.lastHit.get(hitKey) ?? -10) < cooldown) return 'limited';
    this.lastHit.set(hitKey, now);
    const buffers = this.buffers.get(key);
    if (!buffers) { this.preload(key); return 'pending'; }
    if (group === 'object' && [...this.live].filter(v => v.group === 'object').length >= 4) return 'limited';
    if (group === 'pull') this.stopGroup('pull');
    if (this.live.size >= 6) return 'limited';
    const previous = this.lastTake.get(key) ?? -1;
    const candidates = [0, 1, 2].filter(i => i !== previous);
    const take = candidates[Math.floor(Math.random() * candidates.length)];
    this.lastTake.set(key, take);
    const source = this.c.createBufferSource(), volume = this.c.createGain();
    source.buffer = buffers[take]; source.playbackRate.value = Math.max(.65, Math.min(1.6, rate));
    volume.gain.value = Math.max(0, Math.min(1, gain));
    source.connect(volume).connect(this.bus);
    const voice = { source, gain: volume, group }; this.live.add(voice);
    source.onended = () => { source.disconnect(); volume.disconnect(); this.live.delete(voice); };
    source.start(now);
    return 'played';
  }

  stopGroup(group?: string) {
    for (const v of this.live) if (!group || v.group === group) {
      const now = this.c.currentTime;
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setTargetAtTime(0, now, .004);
      try { v.source.stop(now + .025); } catch { /* already ended */ }
      this.live.delete(v);
    }
  }
}
