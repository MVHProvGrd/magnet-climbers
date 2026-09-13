export interface TrickState { score: number; combo: number; bestCombo: number; lastAt: number; frontierY: number; counts: Record<string, number> }
export function freshTricks(): TrickState { return { score: 0, combo: 0, bestCombo: 0, lastAt: -99, frontierY: -40, counts: {} }; }
export function cloneTricks(s: TrickState): TrickState { return { ...s, counts: { ...s.counts } }; }
export function registerTrick(s: TrickState, name: string, points: number, time: number) {
  s.combo = time - s.lastAt <= 4.5 ? Math.min(8, s.combo + 1) : 1;
  s.lastAt = time; s.bestCombo = Math.max(s.bestCombo, s.combo);
  const score = points * s.combo; s.score += score; s.counts[name] = (s.counts[name] ?? 0) + 1;
  return score;
}
