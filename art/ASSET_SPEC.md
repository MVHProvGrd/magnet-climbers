# Magnet Climbers — pickup and obstacle art spec

Target: image assets that replace the hand-drawn canvas art for pickups and obstacles.
Generated with Gemini (`gemini-2.5-flash-image`) from the prompts below; backgrounds keyed to alpha.

## House style (prefix on every prompt)
"Game asset for a bright casual mobile game set on a stainless steel fridge door. Molded glossy plastic
fridge-magnet toy look: chunky rounded forms, saturated colours, one soft highlight from the upper left,
crisp silhouette readable at 32 px. Front-on, centered, fills 80% of the frame. No drop shadow, no text
unless specified, no border, no watermark. Flat solid magenta background (#FF00FF)."

## Readability rules
- Pickups render at 28–32 px on phones: one big shape, one colour family, one symbol.
- Currency must read as currency at a glance: coin has a "$", gem is a cut blue crystal.
- Obstacles are wide panels the player must NOT try to stick to: cool, non-metal materials. The two
  magnet plates carry a big "N" (red) or "S" (blue).
- Steel (safe) is the fridge itself; never draw steel-looking pickups.

## Pickups (square, 1024 → shipped at 128 and 256)
| id | name | prompt subject |
|---|---|---|
| coin | Pocket Change | gold coin with a bold embossed "$", warm yellow-gold |
| gem | Ice Gem | faceted cyan-blue crystal gem, icy sparkle |
| heart | Little Lifeline | glossy red heart, small white highlight |
| magnet | Super Magnet | classic red horseshoe magnet with silver tips |
| extra | Pocket Pal | tiny orange bendy magnet-person toy curled in a ball, silver magnet hands and feet |
| slowmo | Kitchen Timer | round red kitchen egg timer with a white dial |
| reach | Pocket Tape Measure | yellow retractable tape measure with a bit of tape pulled out |

## Obstacles (2:1 panels, 1024×512, drawn stretched to the zone; keep detail in the centre band)
| id | name | prompt subject |
|---|---|---|
| repel | N / Repelling Magnet | square red enamel magnet plate with a huge white "N", glowing red rim |
| attract | S / Attracting Magnet | square blue enamel magnet plate with a huge white "S", glowing blue rim |
| glass | Glass Panel | frosted glass panel with a thin aluminium bezel, faint reflections |
| plastic | Plastic Trim | matte grey plastic trim panel with subtle ribs |
| gap | Door Gap | dark recessed gap between two fridge doors, rubber seal edges |
| vent | Cold Air Vent | white plastic vent grille with horizontal slats, hint of frost |
| dispenser | Water Station | fridge door water and ice dispenser recess, black panel, chrome lever, small blue display |
| calendar | Busy Month | paper wall calendar page with a grid of days and a couple of scribbles, held by a magnet at the top |
| ice-tray | Ice Cube Alley | blue plastic ice cube tray seen from above, a few clear cubes |
| handle | Silver Handle | long brushed stainless steel fridge door handle, horizontal (this one IS steel and grabbable) |

## Deliverables
- `public/art/pickups/<id>.png` 256×256 RGBA
- `public/art/obstacles/<id>.png` 1024×512 RGBA
- `art/generated/` keeps the raw 1024 outputs and the contact sheet for review.

## Pipeline (what actually worked)
1. `art/generated/generate.mjs` calls `gemini-2.5-flash-image` per item (`GKEY` env var; never commit the key).
   Ask for a plain white or magenta background; Gemini ignores it a third of the time, so
2. run every output through `rembg` (model `isnet-general-use`) for the alpha, trim to the bounding box,
   then fit pickups to 256×256 and obstacles to 1024×512.
3. Chroma keying by colour does NOT work on this art: red and pink objects lose their edges.
Gemini rejects `2:1`; generate obstacles at `16:9` and crop.
