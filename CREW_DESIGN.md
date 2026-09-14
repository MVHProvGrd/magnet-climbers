# Crew mode: staged rollout

Crew today is solo with spare lives. This plan makes climbers need each other and do different
things, introduced one piece at a time the way Angry Birds introduced birds: each stage adds one
verb, ships with a fridge section that only that verb can solve, shows a two-panel card the first
time, then mixes into the normal generator.

Stats stay equal across creatures. Verbs are *crew* abilities, usable only in Crew mode.

## Gating

`save.crewStage` (0–7) advances when the stage's trigger fires; it never regresses and is
cloud-synced. World generation takes the stage as an input and only emits a stage's section types
once it is unlocked, so a seed plus a stage is still deterministic (stage goes in the run snapshot).
Every new section appears first as a "showcase": one clean instance with the intro card, then joins
the random pool at the normal rate.

| Stage | Name | Verb | Section that needs it | Trigger | Intro card |
|---|---|---|---|---|---|
| 0 | Fling | SYNC fling, spares as lives (today) | none | start | existing tutorial |
| 1 | **Stack** | CLIMB onto a teammate, then fling from the top of the stack | **Glass band**: a glass strip taller than a max fling. Only a 2-stack clears it | first Crew run ends ≥ 300 cm, or 3 runs | "Stack up. Land one, CLIMB the next onto it, fling from the top." |
| 2 | **Catch** | A climber knocked off by a bumper falls onto a teammate below and hangs instead of dying | **Bumper lane**: moving magnets across the only path, with a steel ledge below for the catcher | reach 600 cm in Crew | "Leave a catcher. A hit climber falls onto the one below." |
| 3 | **Octopus: wide hold** | Octopus holds two hangers, so stacks can fork | **Split shelf**: two glass columns needing a 3-wide base | own Octopus (chain of 3) | "Octopus holds two. Build wide." |
| 4 | **Gecko: wall kick** | Once per flight, tap while touching glass or plastic to kick off it | **Chimney**: two glass walls with a gap too wide for one fling | own Gecko (1000 cm solo) | "Gecko kicks off glass. Tap mid-flight." |
| 5 | **Pair fling** | SYNC-flung climbers that land within reach auto-link; the top one gets a slingshot bonus off the bottom one | **Twin gap**: two gaps in a row, second one out of range unless boosted | 5 SYNC flings that landed together | "Land together, link, boost." |
| 6 | **Robot: bumper feet** | Robot can grip a moving bumper without taking damage and ride it | **Conveyor**: the only steel is on a sliding bumper | own Robot (5 gadget rides) | "Robot rides the movers." |
| 7 | **Tether** | An elastic string joins the crew: a stuck climber anchors an overshooting flier and yanks it back to the door | **Overhang**: a ledge you must overshoot and get pulled back onto | buy "Crew rope" (gems); tether length is the upgrade | "Roped up. Overshoot on purpose." |

Frog (boost the climber flung *from* it) and Crab (shuffle sideways while stuck) follow as stages
8 and 9 once the above has settled. Dino stays cosmetic until it earns a verb.

## Rules that keep it learnable

- One verb per stage, never two. A stage does not unlock until the previous one has been *used* once
  (the trigger fires on use, not on time).
- The showcase section is generous: extra steel, no bumpers, wall speed frozen while the card is up.
- The Field Guide gets a "Crew tricks" tab that fills in as stages unlock, with the same two-panel
  diagrams.
- Solo mode is untouched. None of the sections above spawn in Solo.
- Creature verbs only work for that creature, so the crew tab lineup becomes a real decision. A crew
  with no Octopus never sees Split shelves; the generator checks the lineup, not just the stage.

## Build order

1. Stage plumbing: `crewStage` in the save and snapshot, stage-aware generator, intro card component,
   Field Guide tab. Ship with Stage 1 (Stack) since CLIMB and chains already exist.
2. Stage 2 (Catch): a fall-onto-teammate rule in `damage()` plus the Bumper lane section.
3. Stages 3 and 4: first two creature verbs. Octopus needs `maxLinks` per climber; Gecko needs a
   tap-in-flight input and a wall-contact check.
4. Stage 5 (Pair fling): landing-together detection plus the boost.
5. Stage 6, then 7. Tether is the only one that touches core physics; it goes last.

Each stage is its own issue and its own release. Play-test each on a phone before the next.
