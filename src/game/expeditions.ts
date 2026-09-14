/**
 * Expeditions: hand-built crew puzzles. No red line, a fling budget, three stars.
 * A level is a seed plus a recipe of sections (one per fridge segment above the start)
 * plus a goal height. Upgrades are ignored so every player solves the same puzzle.
 */

export type Section =
  | { kind: "steel" }
  /** full-width glass strip too tall for one fling; `lane` leaves a narrow steel lane, `island` a handle inside */
  | { kind: "band"; h: number; lane?: "left" | "right"; island?: boolean }
  /** a sliding bumper across the segment */
  | { kind: "bumper"; y: number; speed: number; w?: number };

export interface LevelDef {
  id: string;
  name: string;
  seed: number;
  /** climbers at the start */
  team: number;
  /** height of the goal line above the start, in cm (10 px per cm) */
  goalCm: number;
  /** flings available; running out with nobody moving ends the level */
  flings: number;
  /** flings for the second star */
  par: number;
  /** sections for segments 1..n above the solid start segment; segments past the end are plain steel */
  recipe: Section[];
  /** intro card shown the first time this level opens */
  intro?: keyof typeof INTROS;
}

/** Upgrade levels every expedition runs with, whatever the player owns: base stats, chains of two. */
export const EXPEDITION_LEVELS = { team: 0, magnet: 0, reach: 0, links: 1, power: 0, floor: 0, revive: 0 } as const;

export interface PackDef { id: string; name: string; blurb: string; levels: LevelDef[] }

export const INTROS = {
  flings: { title: "Flings are the budget", lines: ["No red line here. Take your time.", "Every fling counts. Finish under par for the second star, lose nobody for the third."] },
  stack: { title: "New trick: STACK", lines: ["Glass too tall for one fling? Land one climber below it.", "Switch to CLIMB, drag the other onto the first one's back, then FLING from up there."] },
  catch: { title: "New trick: CATCH", lines: ["A falling climber grabs any stuck teammate within arm's reach.", "Leave a catcher where a miss would fall."] },
} as const;

const steel: Section = { kind: "steel" };
const band = (h: number, extra: Partial<Extract<Section, { kind: "band" }>> = {}): Section => ({ kind: "band", h, ...extra });

export const PACKS: PackDef[] = [
  {
    id: "stack", name: "Stack Up", blurb: "Learn the fling budget, then climb each other over glass.",
    levels: [
      { id: "stack-1", name: "First Steps", seed: 1101, team: 2, goalCm: 45, flings: 5, par: 2, recipe: [steel, steel], intro: "flings" },
      { id: "stack-2", name: "Two of Us", seed: 1102, team: 2, goalCm: 80, flings: 9, par: 5, recipe: [steel, steel, steel] },
      { id: "stack-3", name: "Glass Ceiling", seed: 1103, team: 2, goalCm: 75, flings: 9, par: 5, recipe: [band(240), steel, steel], intro: "stack" },
      { id: "stack-4", name: "Double Glazing", seed: 1104, team: 2, goalCm: 110, flings: 13, par: 9, recipe: [band(240), steel, band(240), steel] },
      { id: "stack-5", name: "Three's a Ladder", seed: 1105, team: 3, goalCm: 110, flings: 13, par: 9, recipe: [steel, band(250), steel, steel] },
      { id: "stack-6", name: "Side Door", seed: 1106, team: 2, goalCm: 110, flings: 12, par: 8, recipe: [band(240, { lane: "right" }), steel, band(240, { lane: "left" }), steel] },
      { id: "stack-7", name: "Island Hop", seed: 1107, team: 2, goalCm: 110, flings: 12, par: 8, recipe: [band(260, { island: true }), steel, steel, steel] },
      { id: "stack-8", name: "Sliding Trouble", seed: 1108, team: 3, goalCm: 110, flings: 13, par: 8, recipe: [steel, { kind: "bumper", y: 150, speed: 70 }, band(240), steel], intro: "catch" },
      { id: "stack-9", name: "Long Way Up", seed: 1109, team: 3, goalCm: 150, flings: 18, par: 13, recipe: [band(240), steel, band(250), steel, steel] },
      { id: "stack-10", name: "No Room", seed: 1110, team: 3, goalCm: 145, flings: 18, par: 13, recipe: [band(250), band(240, { lane: "left" }), steel, steel, steel] },
      { id: "stack-11", name: "Bumpers Below", seed: 1111, team: 3, goalCm: 150, flings: 18, par: 13, recipe: [{ kind: "bumper", y: 120, speed: 90 }, band(250), steel, { kind: "bumper", y: 200, speed: 80 }, steel] },
      { id: "stack-12", name: "Summit", seed: 1112, team: 3, goalCm: 180, flings: 22, par: 16, recipe: [band(240), steel, band(260, { island: true }), steel, band(250), steel] },
    ],
  },
];

export const levelById = (id: string): LevelDef | undefined => PACKS.flatMap((p) => p.levels).find((l) => l.id === id);
export const nextLevel = (id: string): LevelDef | undefined => { const all = PACKS.flatMap((p) => p.levels); const i = all.findIndex((l) => l.id === id); return i >= 0 ? all[i + 1] : undefined; };

/** A level is playable once the previous one has at least one star (the first is always open). */
export function isUnlocked(id: string, stars: Record<string, number>): boolean {
  const all = PACKS.flatMap((p) => p.levels); const i = all.findIndex((l) => l.id === id);
  return i <= 0 || (stars[all[i - 1].id] ?? 0) > 0;
}

/** Stars for a finished level: finishing, under par, nobody lost. */
export function starsFor(level: LevelDef, flingsUsed: number, lost: number): number {
  return 1 + (flingsUsed <= level.par ? 1 : 0) + (lost === 0 ? 1 : 0);
}
