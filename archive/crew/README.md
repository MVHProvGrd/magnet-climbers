# Crew and Expeditions — archived

Pulled out of the shipping game in September 2026. The decision was the owner's:
either commit to one crew verb per release or take the dead paths out, because
half-built crew code was costing real bugs — the upgrade shop was selling team
size, arm reach and chain length to a game that has one climber, and the
Expeditions tile had been saying COMING SOON for months.

Nothing here is deleted from history. `git log` before this commit has every
line, and `CREW_DESIGN.md` at the repo root is still the plan for bringing it
back, one verb at a time.

## What is in this folder

- `expeditions.ts` — the level packs, section recipes, star rules and intro
  cards, exactly as they were wired. It no longer compiles against the current
  `World` (the recipe generator went with it), so treat it as the specification
  rather than as code to drop back in.

## What came out of the game

| Area | Gone |
|---|---|
| Modes | `rules: "crew"`, the crew lineup, SYNC flings, move mode, teammate selection |
| Expeditions | The menu tile, the level picker, the level result card, star counters, `save.expeditions`, the fling budget and the goal line |
| Stacking | Landing on a teammate, the human ladder and its crawl, `tryBridge`/`stepBridge` |
| Reserves | `RESERVE_COST`, `save.reserves`, `callReserve()` and the HUD button |
| Shop | The `team`, `reach`, `links` and `revive` upgrades; `statsFor` now returns fixed values for reach, links and revives |
| Boards | The crew board tab and crew challenge links (an old crew link still opens, as a solo target) |
| Collection | The crew dressing tab and `save.crew` |

## What deliberately stayed

- `linked` as a climber state, `parent`, `locked` and `chainDepth*`. They are
  woven through the grip, ragdoll and snapshot code that solo uses every frame,
  and with one climber nothing can ever create a link. Ripping them out is a
  second, riskier operation with no player-visible payoff.
- `bestCm` in the save and the `crew` rows already in D1. The data stays; only
  the way in is gone.
- The crew strings in `src/game/lang/*`. They cost nothing and they are exactly
  what a revival would need again.

## Bringing it back

Start from `CREW_DESIGN.md`, not from this folder. Stage 1 is Stack: a climber
that lands on a teammate stands on its shoulders. That one verb needs
`landOnTeammate`, a second climber at spawn and a way to choose who flings —
about a day of work, and it should ship behind a flag with a section that only
it can solve.
