# Extended limbs: avoid floating hands/paws — 2026-09-15

Owner approved longer art plus early retraction; Claude owns production implementation. No game files or live art replaced in this batch. Prior generations preserved. Two successful built-in imagegen edits.

## Art coordinates (source pixels)

| Asset | Size | Alpha bbox inclusive | Entry/root |
|---|---|---|---|
| ready/cat-foreleg-long-v3.webp | 725x2170 | [149,0,602,2089] | TOP, root approximately (360,0) |
| ready/kid-arm-long-v2.webp | 724x2172 | [135,58,564,2171] | BOTTOM, root approximately (350,2171) |

Approximate landmarks: cat paw center(365,1840), claw tips near y2080; boy wrist(365,560), hand center(350,325), highest fingertip y58. Refine against final render. Do NOT reuse older anchor pixels or source rectangles. Preserve native aspect ratio. Cat has four permanently extended claws and correct furry back view. Boy shows back of five-finger hand, thumb left. Single-pose cutouts, NOT jointed rigs.

Hard chroma key, no erosion. QC flags ONLY intentional root frame contact. Boy zero magenta-tinted opaque pixels; cat26. Opposite edges and lateral margins clear. Light/dark review supplied. More limb texture provides room to withdraw, but cannot cover arbitrary camera jumps.

## Claude: camera-safe contract

1. Active paw/hand trajectory and hitbox share WORLD coordinates; apply camera transform once. Do not independently clamp sprite to screen and leave collision behind. Scratches stay in fridge/world coordinates and fade, as in pack17.
2. Before attacking, compute transformed endpoints of the cropped root edge at chosen uniform scale/rotation. Cat: entire root edge remains above viewport. Boy: entire root edge stays below viewport. Check both endpoints, not just center. Suggested guard margin48 game/CSS pixels minimum, increased by projected camera travel during withdrawal.
3. Cap reach to available art. If target is unsafe, shorten/skip attack before warning/contact. Do not stretch hands, claws, skin or fur. More sleeve/foreleg is not infinite reach.
4. Predict camera movement each frame. If root clearance will fail, transition ATTACK to RETRACT early, stop new taps/swipes and further damage from the cancelled attack. Withdraw toward original entry edge over roughly120–220ms. Exact gameplay/collision policy is Claude's responsibility.
5. Cat exits UP, bottom boy exits DOWN. Normal contact stays world-based; withdrawal is an explicit phase adapted to current camera. Do not chase the climber by silently screen-locking an active hitbox. For teleport/resize too large to hide naturally: cancel and hide the whole hazard immediately, never show one floating frame.
6. Clip at viewport. Rotate only within tested safe limits. If an elbow bend is needed later, use separate rig parts, not elastic whole-photo scaling. No full cat/boy torso required now.

## Acceptance checks before shipping

Rapid ascent with cat, rapid fall with boy, camera reversals at each attack phase, portrait/landscape, smallest viewport, zoom/DPR, maximum sweep angle, resize and camera snap. No visible root, no detached cutout, no damage after cancellation, no sprite/hitbox separation. Scratches remain on fridge and fade with bounded effect storage. Honor reduced motion.

This batch is art plus instructions, NOT a verified fix to the running game. Pack17 animation has older source coordinates and is not updated to this art. Read Claude's latest wired status in the main handoff independently.

Review: C:\Users\micha\magnet-art-ready\art\archive\18-extended-limbs-v1\cutout-review.png
