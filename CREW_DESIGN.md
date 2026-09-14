# Expeditions (crew puzzles)

Solo is the endless arcade: red line, scoreboards, chill mode, daily seed. Crew is **Expeditions**:
hand-built puzzle levels with no red line, a fling budget and three stars. Each pack introduces one
crew trick, Angry Birds style: a two-line card the first time, a level that only that trick solves,
then it mixes into later levels.

## A level

`src/game/expeditions.ts`: `{ id, name, seed, team, goalCm, flings, par, recipe, intro? }`.
The recipe is one section per fridge segment above the solid start segment: `steel`, `band` (full-width
glass strip; optional steel `lane` or a handle `island`), `bumper`. Segments past the recipe are plain
steel; the goal line sits at `goalCm`. Two coins per segment, no power-ups.

Every expedition runs with fixed stats (`EXPEDITION_LEVELS`: base upgrades, chains of two) so the puzzle
is the same for everyone. Levels open one at a time (one star on the previous). Runs are not saved for
resume and do not touch the scoreboards; coins collected bank, and each new star pays $25 once.

Stars: finished, at or under par, nobody lost.

## Numbers that shape puzzles (fixed stats, full pull straight up)

| | rise before the magnet catches |
|---|---|
| one climber from steel | 212 px |
| flung from a teammate's back (CLIMB up first) | 272 px |
| glass band a single fling cannot clear | ≥ 210 px |
| glass band a 2-stack still clears | ≤ 270 px |

A 3-high stack is not possible (chain length adds hangers side by side). Bands are 240–260 px.
Over glass the pull back to the door equals steel on purpose: a weaker pull would touch down later on
the way down, i.e. lower, and punish crossing glass.

`node tests/expedition-solve.mjs` random-searches every level with fling and CLIMB moves and fails if
any level is not beatable inside its budget. Par is the solver's best plus one.

## Tricks by pack

| Pack | Trick | Section that needs it |
|---|---|---|
| 1 Stack Up (shipped) | fling budget; **STACK**: CLIMB onto a teammate, fling from its back; **CATCH**: a falling climber grabs any stuck teammate within reach | glass bands; bumpers with a catcher below |
| 2 | Octopus: holds two hangers, so stacks fork | split shelf needing a wide base |
| 3 | Gecko: wall-kick off glass once per flight (tap) | chimney between glass walls |
| 4 | Pair fling: SYNC landings within reach auto-link, top one gets a slingshot bonus | twin gap |
| 5 | Robot: rides moving bumpers unharmed | conveyor |
| 6 | Tether: an anchor yanks an overshooting flier back | overhang |

Frog (boost the climber flung from it) and Crab (shuffle sideways while stuck) after these.
Endless crew mode is hidden from the menu for now; the code path still exists.

## Rules that keep it learnable

- One trick per pack. The first level using it is generous: extra steel, no bumpers.
- Each trick gets a Field Guide "Crew tricks" entry with the same two-panel card.
- Solo is untouched; none of these sections spawn there.
- A creature trick only works for that creature, so the crew tab lineup is a real decision.
