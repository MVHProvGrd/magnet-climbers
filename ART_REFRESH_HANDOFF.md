# Art refresh handoff — 2026-09-14

## Pack25 COMPLETE — latest continuation

Image generation resumed. Five added: blueB, greenC, door-gap-v4, grip-bar-v1, pickup-candy-v1. All eight pack25 assets now ready, gallery updated. See25-hardware-pickup-v1/HANDOFF.md for exact sizes and strip edge exceptions. Next: four glass variants and six obstacle refreshes, then variety. No public/art writes.

## Codex checkpoint — 2026-09-16, generation quota reached

31 successful new image generations this continuation; then built-in429 usage_limit_reached while requesting blueB. Service reported reset1789551873 /14516sec after receipt. No promise of background auto-resume. All produced sources and cleaned exports archived and pushed to codex/art-ready-pack; no public/art writes.

Delivered this run: paint23; old papers12..19 (12 was prior source,13..19 newly generated); three story21 scenes plus retained climb-v1; twelve new papers24; cat22 contact candidate plus3 scratch decals; pack25 travel/star swings and redA rotor. Admin archive gallery regenerated. Paw needs alignment review, explicitly documented in22-cat-claws-v1/HANDOFF.md.

RESUME HERE: finish25-hardware-pickup-v1 with blueB, greenC, door-gap-v4, grip-bar-v1, pickup-candy-v1. Prompts already saved there. Then4 glass variants,6 obstacle refreshes. Then user v3 variety:12 hanging assemblies,4 rotors,7 clips,7 bumpers,8 business magnets,4S+4N destinations (pairs only). Keep current7S/7N balanced. Original and new paper sets are complete; do not regenerate.

Full archive: C:\Users\micha\magnet-art-ready\art\archive
Gallery: C:\Users\micha\magnet-art-ready\art\archive\index.html

## New paper set0..11 READY — 2026-09-16

All12 in `art/archive/24-new-papers-v1/ready`, exact title mapping in HANDOFF.md.12 successful generations, all alpha checks pass; review-sheet.jpg supplied. Claude wires. Next: cat22, keyrings, letters, trim, hardware, glass, candy, obstacle refresh and variety.

## Paper originals12..19 READY — 2026-09-16

`art/archive/21-paper-classics-v1/ready` contains all eight final old-set papers, alpha QC passed. All original paper indices now have realistic candidates. Original pack21-paper folder retained; story21 is a separate folder. Next: story scenes and v3 new papers, claws22, remaining v3 queue. Paint23 ready as recorded below.

## READY FOR CLAUDE — three story scenes (pack 21) — 2026-09-16

Three opaque768x512 exports in21-story-scenes-v1/ready; phone-review.jpg shows340px previews. Climb-v2 selected, all sources retained. Four generation calls. Original brief follows.

Owner request. The story is three slides and each one currently shows the player's own
creature rendered on a canvas, which is generic: the same toy three times, telling none of
the story. Replace it with three illustrated scenes, one per slide.

**These are SCENES, not cutouts.** Do not generate on flat #FF00FF and do not run
chroma-cut.py: these are opaque rectangular illustrations that sit inside a dark card. The
usual cutout rules in the queue below do not apply to this pack.

Pack `art/archive/21-story-scenes-v1/` with the usual `sources/`, `ready/`, `prompts.md`,
a README row, then `node scripts/art-archive-page.mjs`. Never write to `public/art/`;
Claude wires it.

### Format
- 768x512 (3:2), `.webp`, opaque, no alpha, no transparent margin.
- Shown at about 340x227 logical px on a phone, inside a dark slab (`rgba(20,22,28,.9)`)
  with white text directly beneath. Keep the important content in the middle; the bottom
  ~15% may be dimmed by the card. Nothing critical in the corners.
- Must read at that size on a phone: strong silhouettes, few subjects, no fine detail and
  no text anywhere in the image.
- Files: `story-1-life.webp`, `story-2-bedtime.webp`, `story-3-climb.webp`.

### The three scenes, matching the slide copy exactly

1. `story-1-life` — "Life on the fridge"
   > We are the magnet people. We hold up the pizza menu, the dentist card, the photo of
   > Cooper. Good job. Steady work.
   Daytime kitchen, stainless fridge door filling the frame, warm and calm. Several rubbery
   magnet toys posed proudly, each holding up a piece of paper: a pizza menu, a dentist
   appointment card, a child's photo. Everything tidy and in its place. This is the "before".

2. `story-2-bedtime` — "Then bedtime came"
   > Cooper "tidied up". Now we are on the floor, and the sock drawer is next. Anyone still
   > on the fridge by morning stays on the fridge.
   Evening, lights low. Looking down at the kitchen floor: the same toys scattered in a heap
   where they were swept off, papers fallen around them. The fridge looms above, bare and
   out of reach. An open sock drawer waits in the background. Slightly ominous, still toy-like
   and funny, not frightening. No child's face in frame.

3. `story-3-climb` — "So we climb"
   > Fling, stick, climb. Steel holds. Glass, plastic and stickers don't. The red line is
   > Cooper's reach. Stay above it.
   Low hero angle looking up the fridge door. A chain of magnet toys mid-climb, one flung
   through the air with its magnet hands reaching. Determined, upward, energetic. A red
   danger line low in the frame, well below them.

### Style
Match the existing title art (`public/art/title-fridge.webp`) and the photographed realism
of packs 19/20: real kitchen, real stainless steel, real lighting, with the toys as the one
stylised element. Consistent lighting, palette and camera character across all three so they
read as one set. The toys are the translucent rubbery magnet people already in the game.

## Claude: cat paw and POP! are WIRED (2026-09-15). Paw = third attack type from the top, three taps, pad-only hitbox, depth scaled to the view. POP! = ten bubble bits per toy, nearest bubble flips on contact (0.16 s debounce), three pop sounds + push-in sound.

## READY FOR CLAUDE — paint bucket pickup (pack 23) — 2026-09-16

Generated and keyed successfully. Requested256x256 export: `art/archive/23-paint-bucket-v1/ready/paint.png`. Full source cutout, prompt, QC and review included. Green spill, raised wire handle, no branding. No live file writes. Original request follows.

Owner request. Solo runs no longer spawn "+1 friend" pickups (a crew of one cannot gain a
teammate); those become paint buckets that repaint your climber mid-run, purely cosmetic.
It is drawn on canvas for now and wants a real photographed tin like the other pickups.

Cutout rules apply as usual: flat #FF00FF, keyed with chroma-cut.py. Pack
`art/archive/23-paint-bucket-v1/` with `sources/`, `ready/`, `prompts.md`, a README row,
then `node scripts/art-archive-page.mjs`. Never write to `public/art/`; Claude wires it.

- `paint.png`, **256x256**, transparent, to sit beside the existing pickups in
  `public/art/real-v1/pickups/` (coin, gem, heart, magnet, extra, slowmo, reach, candy) and
  match their scale, lighting and finish: it is drawn at about 46 px in game and 44 px in
  the guide tile.
- A small household paint tin, lid off, wire handle up, with a bright spill of colour over
  the lip and down one side. The spill is the read at 46 px, so make it generous.
- Keep the spill a single saturated colour that is not already a pickup: coin is yellow,
  gem is cyan, heart is red, candy is pink. A strong green or violet would be clear.
- No text or branding on the tin.

## GENERATED FOR CLAUDE — cat claws (pack 22) — 2026-09-16

Four assets in `art/archive/22-cat-claws-v1/`. Scratches ready; contact paw is a review candidate because generation shifted the silhouette, not a guaranteed pixel-perfect pose swap. See pack HANDOFF.md and export-review.jpg. No live writes.

Owner request. The cat currently strikes with one rigid paw cutout and leaves claw marks
that are hand-drawn strokes in `cat-paw.ts` (a 1.5 px grey curve with a 0.7 px white
highlight, about 20 px long, four per tap, fading over 1.6 s). Both want real art.

Unlike pack 21 these ARE cutouts: generate on flat #FF00FF and key with
`.claude/skills/chroma-cutout/scripts/chroma-cut.py` as usual. Pack
`art/archive/22-cat-claws-v1/` with `sources/`, `ready/`, `prompts.md`, a README row, then
`node scripts/art-archive-page.mjs`. Never write to `public/art/`; Claude wires it.

### 1. Claws-out paw — `cat-paw-claws-v1.webp`

A second pose of the SAME paw with the claws extended, for the moment of contact. The
existing paw stays as the approach and retreat pose.

**Geometry is a contract, not a suggestion.** `cat-paw.ts` locates the pad and the four
claw tips by fraction of the image, and the hitbox is pad-only, so the two poses must be
interchangeable frame-for-frame:
- identical canvas size to `public/art/real-v1/cat-paw.webp`: **362x1085**
- pad centre at the same place: x 365/725, y 1840/2170 of the frame
- paw width the same fraction: 454/725
- the leg above the pad unchanged in position and thickness, so a swap mid-strike does not
  make the limb jump
- only the toes change: claws out and forward, past the toe pads
- claws should read at the four existing tip offsets from the pad centre, which are
  (-38, 50), (-13, 64), (12, 64), (37, 50) at game scale

Same tabby, same lighting and same key as the existing paw: it is the same cat.

### 2. Claw marks left on the door — `claw-mark-1..3-v1.webp`

Three variations of a single fresh scratch on brushed stainless, to scatter so repeated
taps do not look stamped.
- about 64x256 each, transparent, the mark running top to bottom
- a bright metal gouge with a darker shadow edge, as if the coating is scored: it must read
  on both the light steel door and the darker panels
- slightly curved, tapering to nothing at the bottom, like a claw dragging down
- no cat, no paw, no background: the mark only
- each of the three a different length and curvature

Claude animates the growth and the fade; supply the finished mark at full extent.

## Plain-item realism batch 20 — 2026-09-15

Four more prepared papers in `art/archive/20-paper-notes-v1/ready`: indices7,9,10,11 (Stay Cool, You Got This, Don't Let Go, More Magnets). All pass alpha QC; original sources/prompts and light/dark review included. Combined this continuation:12 prepared assets,14 successful generation calls (two background corrections), no limit encountered. No game/live art changes. Claude wires; next old papers12..19, then rest of priority queue. Gallery includes both packs19/20.

## Plain-item realism batch 19 — 2026-09-15

Eight prepared assets in `art/archive/19-bumpers-paper-v1/ready`: robot bumper2 v2 (fixes prior chroma failure), COOL penguin bumper5, old paper indices0,2,3,4,5,6. All pass alpha QC, light/dark review supplied, ten successful generations including two backdrop corrections. Exact mapping and exclusions in pack HANDOFF.md. Paper remains nonmagnetic; these are base bumpers, chain versions still queued. No game/live files changed. Added to gallery, Claude wires.

## Extended cat/boy limbs — 2026-09-15

Owner reported floating cropped ends during camera movement. Pack `18-extended-limbs-v1` supplies TWO longer cutouts: cat-foreleg-long-v3.webp and kid-arm-long-v2.webp. Read its HANDOFF.md for new coordinates, root-clearance checks, world-space contact, reach caps, early retraction and camera-snap cancellation. More art alone is NOT a game fix. Claude implements; no game/live assets changed by this batch. Original versions retained, new versions added to archive gallery.

## Cat paw and POP! motion reviews — 2026-09-15

Cat paw generation retry succeeded: one realistic tabby cutout, transparent hard-key version preferred, three-tap GIF and standalone review in `public/art-archive/cat-paw-v1/index.html`. Pack `15-cat-paw-attack-v1/HANDOFF.md` gives timing, source coordinates and QC exceptions. Single rigid cutout, NOT an articulated rig. Original source and rejected soft cleanup preserved.

New owner request: POP! bubbles react individually to climber impacts with in/out states and varied sounds. Interactive photographic bubble-swap study in `public/art-archive/pop-it-v1/index.html`, ten toggles and synthesized review audio. Pack `16-pop-it-motion-v1/HANDOFF.md` gives bubble coordinates and proposed contact debounce. No new POP! generation; reuses pack 14. Both added to the existing admin-linked archive. No game or live art replacements; Claude handles implementation. Branch push does not mean deployed.

## Codex batch progress — section A2 / bumper keychains

User decision: all toy bumpers remain magnets with a small repulsive near-contact nudge. Donut, duck, robot, dino and POP! also become keychain-style hanging objects with a lemon-like swing pivot. Pack `14-toy-bumper-keychains-v1` contains five generated studies; COOL penguin is queued after the image limit. Robot has a chroma QC warning and must be regenerated before wiring. Full contract is in that pack's HANDOFF.md. No game files changed.

## Codex batch progress — section A1

Pack `13-business-magnets-v1`: PLUMBER, NOODLES, LIBRARY, SCHOOL BUS, BAKERY generated, versioned and keyed as `business-3..7-v1.webp`. All five pass check-cutout.py clean. Source prompts and exact ID mapping in pack prompts.md. Added to gallery; review only, Claude wires. Five successful calls; no limit. Next A2 toy bumpers. User's latest v2 queue below is authoritative.

## Claude status — 2026-09-15 (later)

Pack 10 hanging keepsakes are WIRED and LIVE (see archive README). Pack 12: kid arm and enamel reach badge are review-only pending owner choice; motion studies read, hand rigging stays with Claude. Codex: continue the variety queue below.

## Latest owner steering — 2026-09-15

Codex makes ART AND ANIMATION REVIEWS; Claude implements. New pack `12-motion-studies-v1`: realistic kid hand/forearm, enamel reach-badge alternative, interactive lemon bump-and-settle, side-swipe and bottom-entry left/right sweep previews. Review page `public/art-archive/motion-v1/index.html`; full instructions in pack HANDOFF.md. Single-pose hand and approximate source-rectangle lemon split are animation studies, not production articulated rigs. This supersedes older exclusions below for hand/reach art exploration only. No src/game changes. Hanging assets in `10-hanging-keepsakes-v1` remain available too.

## Codex queue v3 — 2026-09-15 (replaces v2; packs 19 and 20 are LIVE)

**Delivery, unchanged:** generate on flat #FF00FF, key with `.claude/skills/chroma-cutout/scripts/chroma-cut.py`, each batch in a new pack `art/archive/<nn>-<name>-v1/` (sources/ + ready/ + prompts.md + HANDOFF.md), add a README row, `node scripts/art-archive-page.mjs`, `git push origin codex/art-ready-pack`. Next free pack number is **21** (Claude took **22** for chat avatars; use 23 after 21). Never write to `public/art/`; Claude fits and wires every batch as it lands. Full source margins are fine, Claude crops to alpha bounds. 8 to 12 images per session.

### DONE (live in game, do not redo)
business-0..7, bumper-0..5 (robot v2 and COOL penguin from pack 19), paper-1, paper-8, paper-0/2/3/4/5/6 (pack 19), paper-7/9/10/11 (pack 20), lemon keychain (swing-snack), clip papers snack/travel/doodle, 7 S + 7 N destinations, kid arm long, cat paw long with claws, reach badge, six menu icons, glass-door + glass-wide (one design each).

### A. Still canvas-drawn, in priority order

| # | What | Count | Naming and spec |
|---|---|---|---|
| 1 | **Paper, old set, rest**: 12 Donut Worry (done in pack 21, uncommitted), 13 Avo Good Climb, 14 Tiny Dinosaur, 15 Rain Check, 16 Lucky Duck, 17 Sundae Summit, 18 Gone Fishing, 19 Beep Boop | 7 | `paper-13..19-v1`. Same as packs 19/20: one real object (postcard, kid drawing, sticker sheet, note, greeting card, cut-out), photographed flat, portrait or landscape or square, no magnet or clip on it. |
| 2 | **Paper, new set** (index order): 0 Midnight Pizza Menu, 1 Lost Sock Notice, 2 Moon Camp Postcard, 3 Tiny Chef Recipe, 4 School Aquarium Trip (letter), 5 Kitchen Gig Ticket, 6 Fridge Family Portrait, 7 Secret Treasure Map, 8 Plant Watering Rota, 9 Monster Math Homework, 10 Breakfast Blueprint, 11 Dog Ate My Shopping List | 12 | `paper-new-0..11-v1`. Same spec as row 1. |
| 3 | **Keyring swings**, lemon style: trail keyring (travel theme: compass/hiking boot/mountain charm), star keyring (doodle theme: glitter star or smiley) | 2 | `swing-travel-v1`, `swing-doodle-v1`. Whole assembly: round magnetic hook at top centre, split ring, short chain, charm below, 1024x1536 portrait like lemon. Note the hook pivot pixel in prompts.md. |
| 4 | **Rotor letters** as moulded plastic alphabet magnets, square-ish, centred: A (snack, red), B (travel, blue), C (doodle, green) | 3 | `rotor-snack-v1`, `rotor-travel-v1`, `rotor-doodle-v1`. Straight-on, glossy, 1024x1024. The letter spins in game, so no baked shadow direction. |
| 5 | **Door gap trim**: shallow horizontal plastic/rubber gasket strip between doors | 1 | `door-gap-v4`, 768x160 landscape, tileable left to right. |
| 6 | **Silver grip bar**: the brushed steel bar climbers hold on swings and clips | 1 | `grip-bar-v1`, 512x128, straight-on, tileable. |
| 7 | **Glass door variants**, same frame style as pack 07: tall 384x640 x2 (yoghurt jars and berries; sodas and pickles), wide 768x384 x2 (dairy row; sauces and jars). Windows repeat one door today. | 4 | `glass-door-v3`, `glass-door-v4`, `glass-wide-v3`, `glass-wide-v4`. Closed glass, contents behind it, frame edges complete. |
| 8 | **Candy Drop pickup** icon: wrapped hard candy, enamel-badge style matching coin/gem/reach badges | 1 | `pickup-candy-v1`, 1024x1024. |
| 9 | **Obstacle refresh** (older renders, not photoreal cutouts): water dispenser panel, paper calendar, ice tray (photo aspect, no handle), door handle, plastic drawer front, vent grille | 6 | `obstacle-<name>-v2`. Straight-on, flat fridge lighting. Sizes: dispenser 384x640, calendar 512x640, ice-tray 768x384, handle 768x160, plastic 768x384, vent 768x256. |

### B. New variety after A (pools grow; Claude adds items, cards, translations)
- Hanging assemblies (swing pool): keys on a ring with car fob, bottle opener on a chain, mini disco ball, rubber duck keychain, bead lanyard with ID badge, carabiner with whistle, wind chime, baby shoe on a ribbon, scissors by one loop, measuring spoons, souvenir spoon, fishing lure. `swing-<name>-v1`, lemon spec.
- Rotors: wall clock magnet, pinwheel, dial thermometer, fidget spinner. `rotor-<name>-v1`.
- Clip papers: concert ticket, report card, takeout receipt, birthday invite, lost cat poster, coupon sheet, polaroid of grandma. `clip-<name>-v1`, silver clip at top centre.
- Bumpers (keychain toys, no hardware baked in): toy taxi, race car, banana, space shuttle, letter block, plastic brick, gummy bear. `bumper-<name>-v1`.
- Business magnets (horizontal card like pack 08): taxi, locksmith, sushi, car wash, realtor with headshot, tax prep, pool cleaner, tattoo parlour. `business-<name>-v1`.
- Destinations, pairs only, 4 S + 4 N: Maldives, Zanzibar, Phuket, Cancun; Tromso, Banff, Hokkaido, Svalbard. Pack 09 spec.

## Codex queue — 2026-09-15 (v2, superseded by v3 above; kept for history)

Rules: generate on flat #FF00FF, key with `.claude/skills/chroma-cutout/scripts/chroma-cut.py`, put each batch in a new pack `art/archive/<nn>-<name>-v1/` (sources/ + ready/ + prompts.md), add a README row, run `node scripts/art-archive-page.mjs`, push with `git push origin HEAD`. Claude wires. Never overwrite `public/art/`.
Hanging assemblies (lemon style): whole object on its hook, hook at top centre, fingers/paper/chain complete, clear margins; note the hook pivot pixel in prompts.md. Clip papers: silver clip at top centre, paper below, portrait or landscape. Bumpers: wide chunky silhouette readable at 90x50. Business magnets: horizontal card like pack 08.

### A. Regenerate what is still canvas-drawn (priority order)

| # | What | Count | Naming |
|---|---|---|---|
| 1 | Business magnets: PLUMBER, NOODLES, LIBRARY, SCHOOL BUS, BAKERY | 5 | `business-3..7-v1` (order = `BUSINESS_MAGNETS`, `src/game/fridge-art.ts`) |
| 2 | Toy bumpers: donut, duck, robot, dino, POP! pop-it, COOL penguin | 6 | `bumper-0..5-v1` |
| 3 | Paper, old set (18, Cat Nap Club and Snack List done): pizza postcard, kid climbing drawing, scenic route, space cadet, home sweet fridge, seed packet, stay cool, you got this, don't let go, more magnets, donut, avocado, tiny dinosaur, rain check, lucky duck, sundae, gone fishing, beep boop | 18 | `paper-<index>-v1` (index in `paperNames`, `src/game/items.ts`) |
| 4 | Paper, new set: pizza menu, lost sock notice, moon camp postcard, tiny chef recipe, aquarium trip letter, gig ticket, family portrait, treasure map, watering rota, monster math homework, breakfast blueprint, dog-ate-list | 12 | `paper-new-<index>-v1` |
| 5 | Keyring swings, lemon style: trail keyring (travel), star keyring (doodle) | 2 | `swing-travel-v1`, `swing-doodle-v1` |
| 6 | Rotor letters as real moulded plastic alphabet magnets A, B, C, square-ish, centred | 3 | `rotor-snack-v1` (A), `rotor-travel-v1` (B), `rotor-doodle-v1` (C) |
| 7 | Door gap trim, shallow horizontal 768x160 | 1 | `door-gap-v4` |
| 8 | Silver grip bar (the steel hardware on swings and clips), 512x128, brushed | 1 | `grip-bar-v1` |
| 9 | Glass door variants, same frame style as pack 07: tall 384x640 x2 (different bottles/produce: yoghurt jars and berries; sodas and pickles), wide 768x384 x2 (dairy row; sauces and jars). Windows repeat the one door now | 4 | `glass-door-v3`, `glass-door-v4`, `glass-wide-v3`, `glass-wide-v4` |

### B. New variety (pools grow; Claude adds items, cards, translations)

- **Hanging assemblies (swing pool)**: keys on a ring with car fob, bottle opener on a chain, mini disco ball, rubber duck keychain, bead lanyard with ID badge, carabiner with whistle, three-tube wind chime, baby shoe on a ribbon, scissors by one loop, measuring spoons on a ring, souvenir spoon, fishing lure. Naming `swing-<name>-v1`.
- **Swing-pool gameplay rule from user**: keep every item as a physical fridge magnet with a small repulsive near-contact nudge. Decorations and payloads do not become grip points. The donut, duck, robot, dino and POP! bumper magnets also use keychain hardware and a top pivot so they swing like lemon; COOL penguin should follow the same rule when generated.
- **Rotors**: wall clock magnet, pinwheel, dial thermometer, fidget spinner. `rotor-<name>-v1`.
- **Clip papers**: concert ticket, report card, takeout receipt, birthday invite, lost cat poster, coupon sheet, polaroid of grandma. `clip-<name>-v1`.
- **Bumpers**: rubber ducky, toy taxi, race car, banana, space shuttle, letter block, plastic brick, gummy bear. `bumper-<name>-v1`.
- **Business magnets**: taxi, locksmith, sushi, car wash, realtor with headshot, tax prep, pool cleaner, tattoo parlour. `business-<name>-v1`.
- **Destinations**: pairs only, 4 S + 4 N: Maldives, Zanzibar, Phuket, Cancún; Tromsø, Banff, Hokkaido, Svalbard. Same spec as pack 09.

8 to 12 per session. Claude wires each batch as it lands.

## Status 2026-09-15: packs 08 and 09 are WIRED and LIVE (Claude). `art/archive/prepare-live.py` fits ready cutouts into `public/art/`. Destination pools are now 7 S / 7 N. Reach pickup done by Claude (pack 10).

## Request from Claude — 2026-09-15: "reach" pickup icon — DONE by Claude (pack `10-reach-badge-v1`, canvas-rendered, live). No action needed.

User wants the reach pickup (`public/art/real-v1/pickups/reach.png`, currently a tape measure) to go back to the ORIGINAL meaning: the blue double-headed arrow badge in `art/archive/01-canvas-drawn/pickups-badges/reach.png`, but as a physical object in the current photo-real fridge style.

Brief:
- One round button badge or round fridge magnet, roughly 256 px, centred, tilted slightly like the other pickups.
- Face: glossy sky-blue, with a bold dark-navy horizontal double-headed arrow (↔) printed on it. Arrow is the whole message; no text, no ruler marks, no tape measure.
- Keep it readable at 46 px in game: thick arrow, high contrast, simple silhouette.
- Generate on flat pure #FF00FF and key with `.claude/skills/chroma-cutout/scripts/chroma-cut.py` (same script as `07-souvenir-ready-v1/chroma-cut.py`). Run `check-cutout.py`. Avoid blue/cyan halos on the magenta edge.
- Do NOT overwrite `real-v1/pickups/reach.png`. Put source + keyed WebP in a new pack `art/archive/10-reach-badge-v1/`, add it to the archive README, run `node scripts/art-archive-page.mjs`, and note it here. Claude swaps it into the game after user approval.

---

## Current assignment

2026-09-15: New hanging-items batch in `art/archive/10-hanging-keepsakes-v1`: seaside postcard, cat snapshot, dinosaur crayon drawing, pancake recipe, lemon keychain. Five successful image generations, no limit. Preserved sources, transparent cutouts, dark/light review sheet and per-pack HANDOFF.md. These are review assemblies with baked-in hardware; rigging/pivots are not prepared. No game renderer changes. N/S balance unchanged at 7/7.

LATEST: Keep North and South destination counts EVEN. New pack `09-balanced-travel-v1` adds Tahiti, Seychelles, Cape Town, Rio (S) and Edinburgh, Lapland (N). Combined with existing 3 S / 5 N, the review collection is now **7 S / 7 N**. Future additions should be pairs. These additions are REVIEW ONLY, not wired into the game. Use Cape Town v2; v1 is preserved but magenta keying discolored its pink house/flower. All other new destinations use v1. Eight successful generation calls this continuation (vet + six destinations + Cape Town correction), no limit encountered. Vet bone-shaped magnet added to pack 08 as business-2 candidate. Existing game code remains Claude's implementation.

User wants Codex to focus on ART WORK: upgrade untouched art where it fits the realistic, tactile fridge style, then add each version to the existing admin-linked art archive. Preserve all prior art. This batch is review-only, with no game renderer or physics changes.

Claude's current destination obstacle / timed toy gadget implementation is authoritative. Worktree was fast-forwarded to `1d628b9` before creating this batch. Do not restore the superseded wiring described in `07-souvenir-ready-v1/HANDOFF.md`.

## Completed this pass

Three successful built-in image generations, no generation limit encountered:

| Asset | Intended eventual mapping | Review status |
|---|---|---|
| business-pizza-v1 | business-1 mover | Real printed pizza takeaway magnet; source and keyed WebP ready for review |
| business-dentist-v1 | business-0 mover | Raised ivory tooth / teal enamel advertising magnet; source and keyed WebP ready for review |
| paper-grocery-v1 | paper-8 Snack List candidate | Handwritten grocery list on real ruled paper; source and keyed WebP ready for review |

All use pure #FF00FF source backgrounds and the existing `07-souvenir-ready-v1/chroma-cut.py` (no erosion). Original generation files are preserved. Full-resolution cutouts retain source margins. Fit proportionally; do not stretch them or substitute them into gadgets. Paper remains non-magnetic. No asset has user approval for a game swap yet.

## Exact paths

- This note: `C:\Users\micha\magnet-art-ready\ART_REFRESH_HANDOFF.md`
- Pack: `C:\Users\micha\magnet-art-ready\art\archive\08-tactile-refresh-v1`
- Originals: pack `sources\` directory, `*-v1-magenta.png`
- Prepared cutouts: pack `ready\` directory, `*-v1.webp`
- Existing admin-linked gallery: `C:\Users\micha\magnet-art-ready\public\art-archive\index.html`
- Gallery section: `/art-archive/#08-tactile-refresh-v1`

The existing archive is a static noindex page linked from admin, not an authenticated private asset store. This pass uses that existing gallery, with no player-facing game art changes.

## Remaining queue

Prioritize the still-flat business movers: vet, plumber, noodles, library, school, bakery. Then tactile toy versions of donut, duck, robot, dino, ice-pop and penguin movers. Paper cards should become convincing photographs of paper prints, crayon drawings, postcards or notes; retain their non-stick behavior. Already refreshed pickups and destination souvenirs do not need redundant remakes. Glass/gap concepts already exist in pack 07 and need review rather than another blind replacement. Tahiti S remains an earlier queued concept, lower priority than untouched art.

## Continue safely

Use versioned sources, prepared assets and notes. Add to the archive README, then run `node scripts/art-archive-page.mjs`. Check cutout alpha and both light/dark backgrounds before proposing wiring. Keep the gameplay source files under Claude's ownership. Always give the user full absolute local paths.
