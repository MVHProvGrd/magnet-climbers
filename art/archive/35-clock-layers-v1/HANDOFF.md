# Pack35 READY — hands-free clock + independent hands

Fulfills Claude's "Requested next: a hands-free clock face" in ART_REFRESH_HANDOFF.md. No runtime/public/art changes; Claude wires real local time. Original clock retained in reference/rotor-clock-original.webp, all six imagegen takes in sources/, native keyed outputs and repeatable fitting scripts retained.

## Selected delivery

| File in ready/ | Dimensions | Pivot in exported pixels |
|---|---|---|
| rotor-clock-faceless-v1.webp | 380×384 | (190.38,190.3488), normalized (0.501,0.4957) |
| clock-hour-hand-v1.webp | 128×256 | (64,240) |
| clock-minute-hand-v1.webp | 128×256 | (64,240) |

Face filename follows requested ID ("faceless" means hands-free here; dial/numerals remain). Selected source for face is source v3, minute source v2. No hands, red second hand, hub or painted center hole on face. Hands point UP at zero rotation. Their mounting eyes are genuinely transparent. Face remeasured from four cardinal tick marks and fitted to the existing spindle. Preserve exported frame; **do not alpha-crop it again** or you change its normalized pivot.

The generated edit retains the cream/silver/ivory photographic design, not pixel-identical original typography or lighting. Face silhouette has a few pixels of safety clearance (bbox4,1–377,377) instead of the old edge-touching silhouette. Existing frame dimensions and requested pivot are exact. Original untouched for comparison. No new pivot measurement needed in gadget-pivots.ts.

At the face's native size, scale either hand by0.55: hour reaches88px from spindle, minute118.8px. Draw face upright; translate to its spindle; rotate clockwise; scale0.55; draw hand at(-64,-240). Draw hour first, minute second. Apply the same outer display scale to everything. Angles: hour=((hours%12)+minutes/60)*PI/6, minute=minutes*PI/30. Optional seconds fraction smooths movement. Use new Date() local time, not game-time or UTC. A renderer center cap can be added if wanted; none is baked into the face.

## Review and QA

Open C:\Users\micha\magnet-art-ready\art\archive\35-clock-layers-v1\index.html directly: local-time clock, four fixed times, full-size and small-size previews. Static clock-times-review.jpg checks12:00,3:00,6:30,10:10. review-sheet.jpg shows light/dark cutouts. Three final alpha checks pass, complete outlines, mounting holes clear. anchors.json has all exact values.

Generated using built-in imagegen, prompts.md records every request. Face v1 clipped; v2 had alpha specks; minute v1 had haze. Repaired takes preserved. No-erosion repo chroma key, PNG intermediates to avoid lossy colour bleed, final lossless WebP. Earlier keyed WebPs retained as intermediate history, NOT delivery files. Reproduce with prepare.py then review.py.
