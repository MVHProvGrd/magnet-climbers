# Art archive

Every art style the game has used, kept here so any of them can come back. Each folder is a
complete set. Git history has the code that drew or loaded each one; the commit is listed.

| Folder | What | Where it came from | Live in |
|---|---|---|---|
| `26-glass-obstacles-v1/` | Four stocked glass variants and six realistic obstacle refreshes; exact-size exports and native sources | Codex built-in imagegen | Ready for Claude wiring; ten alpha checks pass |
| `25-hardware-pickup-v1/` | Travel/star swings, plasticABC rotors, tileable gasket/gripbar, enamel candy; eight complete | Codex built-in imagegen | Ready for Claude wiring; source/native/fit exports retained |
| `22-cat-claws-v1/` | Extended-claw contact candidate and three64x256 scratch decals; full source, native key, fit exports | Codex built-in imagegen | Scratches ready; paw needs renderer alignment review |
| `24-new-papers-v1/` | All12 new paper objects, paper-new-0..11; sources, prompts, alpha QC and review | Codex built-in imagegen | Ready for Claude wiring |
| `21-story-scenes-v1/` | Life, bedtime and climb story scenes; opaque768x512, phone review, consistent toys | Codex built-in imagegen | Ready for Claude review/wiring |
| `21-paper-classics-v1/` | Final eight original papers12..19, all alpha QC passed, original sources and light/dark sheet | Codex built-in imagegen | Ready for Claude wiring; distinct from21-story-scenes |
| `23-paint-bucket-v1/` | Green paint tin pickup, full source cutout plus transparent256x256 paint.png, alpha QC and review | Codex built-in imagegen | Ready for Claude wiring |
| `22-avatars-v1/` | 83 cartoon sticker avatars for chat and the profile (fridge crew, snacks, creatures, whimsical people). `gen.py` (Gemini, magenta), `key.py` (rim-only despill so reds survive), `sheet.py` packs the sprite sheet. | Claude via Gemini 2.5 Flash Image | LIVE: `public/art/avatars/sheet.webp`, picker in Settings, shown in chat and the menu ticker |
| `20-paper-notes-v1/` | Four realistic papers: Stay Cool, You Got This, Don't Let Go, More Magnets (7,9,10,11). Sources, alpha manifest and light/dark sheet. | Codex built-in imagegen + hard chroma key | LIVE: `public/art/paper/paper-7/9/10/11.webp` via `prepare-live.py`, photo-shaped cards (world v13) |
| `19-bumpers-paper-v1/` | Clean robot replacement, COOL penguin and six realistic paper objects (0,2,3,4,5,6). Sources, corrections, alpha manifest and review sheet. | Codex built-in imagegen + hard chroma key | LIVE: robot replaces `bumper-2.webp`, penguin is `bumper-5.webp` (no canvas fallback left), papers 0/2/3/4/5/6 as `public/art/paper/paper-N.webp` |
| `18-extended-limbs-v1/` | Longer cat foreleg and boy teal sleeve, sources, cutouts and light/dark review. Camera-safe root/retraction handoff. | Codex built-in imagegen edits | Review only; Claude wires new source coordinates and withdrawal |
| `15-cat-paw-attack-v1/` | Realistic tabby paw, source, hard/soft cleanup history, light/dark QC and three-tap GIF. Prefer hard cutout; soft rejected. | Codex built-in imagegen and isolated animation review | LIVE: cat paw attack (a third of attacks in v13 worlds), `real-v1/cat-paw.webp` |
| `16-pop-it-motion-v1/` | Ten independently toggled photographic bubbles and synthesized pop audio; reuses pack 14 | Codex isolated interaction review, no new generation | LIVE: POP! bubbles flip on contact with pop sounds |
| `01-canvas-drawn/` | Hand-drawn Canvas 2D art rendered to PNG at 4x: badge pickups (`pickups-badges`, the first style), object pickups (`pickups-objects`), obstacles (glass, plastic, gap, vent, attract, repel, handles, dispenser, calendar, ice tray), 24 sticker prints, bumpers | Claude, `src/game/fridge-art.ts`, `item-art.ts`, `scenery.ts` (`drawLegacyPower`) | 75f276c (scenery pass) → still the fallback when an image fails to load |
| `02-gemini-generated/` | Raw Gemini renders from `art/ASSET_SPEC.md`, 7 pickups and 10 obstacles, plus the contact sheet | Google Gemini via `art/generated/generate.mjs` | c6e2d61 (review set) |
| `03-gemini-cutouts-in-game/` | The Gemini pickups after `rembg` background removal, exactly as shipped | Claude | d2f7521 → current pickups |
| `04-codex-photo-real-v1/` | Photographic pickups and obstacles Codex imported as "approved" | Codex, `art/approved-import/` | 3a84acf → current obstacles (gap photo retired in aa3fdad) |
| `05-gadgets-and-title/` | Gadget theme sheets (snack, travel, doodle), title fridge photo and logo | Claude | 371a9d0, fe0297a |
| `06-review-alternatives/` | Side-by-side review sheets (Claude vs Gemini, pocket-pal option) | mixed | never shipped |

| `07-souvenir-ready-v1/` | Textured Fiji S and Norway N magnets, layered brass compass, crayon, candy pole, bottle windows and gasket detail. Includes immutable source/history images, prepared WebP files, alpha checks and integration notes. | Codex built-in generation; magenta extraction using Flotillas chroma-cut (no erosion) | LIVE: souvenirs are the N/S plates, compass/crayon/candy pole are the polarity gadgets (7a1a6ac) LIVE incl. glass-door.webp (tall windows whole, wide bands tiled shelf behind the frosted frame) |

## Going back to a set

| `15-ui-icons-v1/` | Menu icons as enamel fridge magnets: gear, guide book, story scroll, help, trophy, chat bubble | Claude, Gemini 2.5 Flash Image + chroma-cutout | LIVE in `public/art/ui/` |

| `14-toy-bumper-keychains-v1/` | Section A2: donut, duck, robot, dino and POP! bumper studies; user specified small repulsive nudge plus keychain swinging for five; penguin queued | Codex built-in generation and magenta keying | LIVE: donut, duck, robot, dino, POP! as `public/art/bumpers/bumper-0..4.webp`, hung on the lemon's hook and chain at draw time (visual pendulum); COOL penguin replaced by pack 19 |

| `13-business-magnets-v1/` | Section A1: plumber, noodles, library, school bus and bakery, business-3..7; all five cutouts pass cleanup checks | Codex built-in generation and repo chroma key | LIVE: `public/art/business/business-3..7.webp` via `prepare-live.py` |

| `12-motion-studies-v1/` | Realistic kid arm, enamel reach badge, lemon pendulum and side/bottom swipe animation reviews. Interactive page /art-archive/motion-v1/ | Codex image generation and isolated review animation | enamel reach badge LIVE in `real-v1/pickups/reach.png`; kid arm LIVE in `real-v1/kid-arm.webp` (rigid hand about the wrist, forearm stretched along the drawn arm line, same hitbox) |

| `10-reach-badge-v1/` | Reach pickup as a glossy blue button badge with a navy double-headed arrow (pack-01 badge meaning, physical style); replaces the tape measure | Claude, @napi-rs/canvas `render.mjs` | superseded by pack 12 enamel badge (owner pick) |
| `10-hanging-keepsakes-v1/` | Five realistic hanging assemblies: seaside postcard, cat photo, dinosaur drawing, pancake recipe and lemon keychain. Sources, cutouts, alpha manifest and light/dark review sheet | Codex built-in image generation and magenta keying | LIVE: lemon keychain = snack swing (rotates about its hook), pancake/postcard/dinosaur = the three clip gadgets, cat photo = Cat Nap Club card; via `prepare-live.py` |

| `09-balanced-travel-v1/` | Six new destination souvenirs: Tahiti, Seychelles, Cape Town, Rio (S), Edinburgh and Lapland (N); combined collection 7 S / 7 N. Cape Town v2 preferred; v1 retained for history | Codex built-in generation and magenta keying | LIVE: all six in `public/art/destinations/` via `prepare-live.py` (Cape Town v2) |

| `08-tactile-refresh-v1/` | Realistic pizza and dentist advertising magnets, handwritten grocery paper; immutable magenta sources and transparent WebP cutouts | Codex built-in generation; existing chroma-cut script | LIVE: dentist/pizza/vet as `public/art/business/business-0..2.webp`, grocery as `public/art/paper/paper-8.webp` via `prepare-live.py` |

- Pickups load from `public/art/pickups/<kind>.png` (`src/game/pickup-art.ts`). Drop a set there; missing files fall back to the canvas drawing.
- Obstacles load from `public/art/real-v1/obstacles/<id>.png` (`src/game/obstacle-art.ts`). Remove a file, or add its id to `NO_PHOTO` there, to fall back to the canvas drawing.
- To restore the canvas look everywhere, empty both folders. Nothing else changes.

Regenerate `01-canvas-drawn/` with `node tests/art-archive.mjs`. Rebuild the browsable page (`https://magnetclimbers.com/art-archive/`, linked from the admin header) with `node scripts/art-archive-page.mjs` after adding a set.
