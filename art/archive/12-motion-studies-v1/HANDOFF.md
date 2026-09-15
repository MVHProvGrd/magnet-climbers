# Motion studies — 2026-09-15

Owner instruction: Codex makes art and animations; Claude implements in game.

Full pack path: `C:\Users\micha\magnet-art-ready\art\archive\12-motion-studies-v1`
Interactive review: `C:\Users\micha\magnet-art-ready\public\art-archive\motion-v1\index.html`
Animation code: `C:\Users\micha\magnet-art-ready\public\art-archive\motion-v1\review.js`

## Delivered art

- ready/kid-arm-open-v1.webp — photographed back of a child's open hand and forearm, five fingers, teal sweatshirt sleeve. Single pose / rigid cutout, not an articulated rig. Sleeve intentionally continues to source bottom and must stay offscreen. Fingers and wrist are intact.
- ready/reach-enamel-v2.webp — physical blue enamel reach badge with dark navy double-headed arrow and nickel rim. Meaning follows Claude's current badge in pack 10. Alternative for review, not a replacement in public/art/.
- Sources preserved as generated on #FF00FF; keyed with existing pack-07 chroma-cut.py. Two successful image generations, no generation limit encountered this pass.

## Animations

1. Lemon bump response: damped pendulum with angular acceleration -9.8*sin(angle)-1.4*velocity, bump adds +/-1.5 radians/sec capped at +/-3. Source 1024x1536 from pack 10. Static hook source rows 0..299; lower moving assembly rows 300..1535. Rotate lower image around source point (510,285); source split is a review approximation, not production layer separation. Chain and lemon rotate together; independent link flex is future work. Paper/resin never become magnetic.
2. Side-entry hand: 4.6-second loop, .8s wind-up, 1.85s sweep, .75s withdrawal, 1.2s rest. Curved downward motion driven by rotation about an offscreen lower-left anchor.
3. Bottom-entry hand: same timing. Rises from below, sweeps horizontally, withdraws; direction alternates each cycle. Wide review view, no hitboxes or damage. Game warning route and collision must be designed and tested together by Claude.
4. Reach badge: quiet 3px idle bob, comparison with Claude's badge at enlarged and 46px scale.

The review page respects reduced-motion preference, has pause/play and directional lemon bump controls. All animations are isolated from src/game. No game physics, scheduling, collision, save data or live pickup assets changed. The new user request overrides older queue notes that excluded kid-hand/pickup exploration; implementation still belongs to Claude.

## Generation prompt record

Arm: photographic view of back of an eight-year-old child's open hand, exactly five fingers, natural nails and creases, warm light-brown skin, long forearm extending into teal cotton ribbed sweatshirt cuff. Fingers point up, thumb left, upper-left light, no face, jewelry, motion blur or external shadow. Vertical composition. Pure flat #FF00FF background in all negative space.

Reach: one real round sky-blue enamel badge, polished nickel rolled rim, subtle surface texture and tiny scuffs, large simple navy horizontal double-headed arrow, no text. Front view with slight tilt, no glare obscuring arrow, 46px readability. Pure flat #FF00FF background, no external shadow.

## Reproduce review exports

Optional QA dependency: `npm install --prefix node_modules/.cache/magnet-climbers-visual --no-package-lock --no-save @napi-rs/canvas`.
Run `node art/archive/12-motion-studies-v1/render-review.mjs --frames` to render a two-row sheet plus 92 frames at 20 fps. Frames are ignored by git. Export GIF from frames with ffmpeg; preserve sources and earlier variants.
