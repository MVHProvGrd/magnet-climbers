# Creature renderer integration

Codex renderer pass: six forms (`gecko`, `frog`, `crab`, `octopus`, `robot`,
`dino`) plus the existing `human` fallback. Rendering is implemented locally in
`src/game/climber-render.ts` and `src/game/creature-render.ts`.

## Calls for Claude's integration

```ts
import { drawClimber, drawClimberShadow, type CreatureAppearance } from "./climber-render";

// Resolve these values from your creature/pattern data, per crew member.
const appearance: CreatureAppearance = {
  creatureId: "gecko",
  color: "#76cb73",       // optional; omitted uses the creature's default
  accent: "#e7f5a7",      // optional
  marking: "spots",       // optional: plain | spots | stripes
};
drawClimberShadow(ctx, climber, game.time, appearance);
drawClimber(ctx, climber, selected, game.time, appearance);
```

The same calls work in collection canvases with a preview Climber. Supply the
same time and appearance to the shadow and body. Time drives decorative motion;
joint positions, angle, velocity and spin come from the supplied Climber. Freeze
the supplied time for a static preview or reduced-motion collection screen.

The renderer accepts resolved colors/markings rather than owning pattern IDs.
Claude owns the data IDs, save schema, unlock triggers and UI. Map a different
starter ID to `human` if needed. Missing/unknown creature IDs fall back to the
human toy; existing callers remain compatible. Missing human color uses the
Climber's existing color.

## Appearance and physics

- Gecko: broad head, toe pads, back spots and a curling tail.
- Frog: wide body, raised eyes, pale belly and toe pads.
- Crab: wide shell, eye stalks, two claws around the hand magnets, small side legs.
- Octopus: tall mantle, sucker rims and four additional decorative arms.
- Robot: box head/body, face display, indicator and flexible antenna.
- Dino: broad head, dorsal spikes and thick tail.

All six reuse the existing limb start/joint/tip geometry, magnetic centers,
landing flashes and selection ring. Decorative motion is bounded, deterministic,
and does not mutate the Climber. No extra contacts, stats, sounds, unlocks or
gameplay abilities are added. The shared LONG ARMS rendering behavior is retained.

## Verification and preview

Run `node tests/creature-visual.mjs` (optional Canvas setup in `tests/visual.mjs`).
It renders planted, tumbling, single-hand and recolored poses; checks distinct
forms, deterministic output, no Climber mutations and unknown-ID fallback.
Preview: `artifacts/creature-roster.png`.

The production build passes. Actual equipped-creature gameplay and collection
UI verification follows Claude's wiring; existing gameplay callers currently
use the human default. No save/UI/shop files were edited in this renderer pass.
