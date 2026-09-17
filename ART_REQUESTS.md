# Art requests for Codex

A running queue. Each entry says what is needed, where it lands in the code, and what is
rendering in its place today so the request can be judged against the real screen. Newest
requests go at the bottom of their section; finished ones move to **Delivered** with the
commit that wired them in.

The house rules from `ART_REFRESH_HANDOFF.md` still hold: photographic, lit from the upper
left like the door, transparent PNG/WebP, square canvas with the object centred unless a
pivot is called out, and a `-v1` suffix on the id so a re-cut can land beside the old one.

---

## Queued

### 1. League tier badges — Paper, Plastic, Steel, Chrome, Gold
Five badges, one per tier in `worker/src/index.ts` `TIERS`. Shown on the board's LEAGUE tab
(`src/game/ui.ts` `showBoard`) and, once it exists, on a home-dock rank chip.

- Square, ~192×192, transparent.
- Read as fridge-magnet materials, not as generic game ranks: a paper luggage tag, a moulded
  plastic letter magnet, brushed steel, polished chrome, a gold foil star sticker. The tier
  names are already the material — lean on that rather than inventing heraldry.
- They sit at ~28px on the board row, so silhouette has to carry at thumbnail size.

Today: the tier name is plain text.

### 2. A streak flame — `streak-flame-v1`
The daily streak counter uses the 🔥 emoji, which renders differently on every platform and
breaks the kitchen-photo look. Wanted: one small object, ~128×128 transparent, that reads as
"days in a row" on a fridge door — a magnetic day counter, a wax seal, a tally sticker. It
sits next to a number, so leave the number out of the art.

Today: `🔥` in `src/game/ui.ts`.

### 3. Board empty state — `board-empty-v1`
~240×240 transparent. The LEAGUE and TODAY tabs open on a blank body with one line of text
before any score lands, which is the first thing a new player sees on that screen. Wanted:
a bare fridge door with a single blank magnetic notepad on it — an invitation, not an error.

### 4. Daily share card background — `card-base-daily.jpg`
1200×630 JPEG for `worker/src/assets/`, a sibling of the existing `card-base.jpg`. Used when
the shared run was the daily climb, so it wants a "today" motif — a magnetic date tile or a
torn calendar day on the door — with the same cover framing and the same clear band across
the middle-left where `cardSvg` writes the name and the height.

### 5. Set-piece doors, three or four more
`world-patterns.ts` `SET_PIECES` has four: `water-station`, `busy-month`, `ice-alley`,
`handle-hop`. A long climb cycles them six or seven times. Same on-door treatment as the
existing four (340 wide × ~280 tall, sitting on the steel, not replacing it):

- a spice rack strip,
- a magnetic whiteboard with a shopping list,
- a row of bottle openers,
- a takeaway-menu fan.

These are the biggest single lever on how varied a run looks, and with the clock delivered
they are the most valuable art on this list.

### 6. iOS home-screen set
`index.html` carries one 192×192 `apple-touch-icon` and no splash screens, so launching from
an iOS home screen shows white until the bundle loads. Needed, all derivable from the
existing `toy-icon-512.png` master rather than drawn fresh:

- `apple-touch-icon` at 180×180,
- `apple-touch-startup-image` at the common iPhone/iPad viewport sizes, on the manifest's
  `theme_color` ground with the toy centred.

### 7. A kit icon — `ui-kit-v1`
Kit and creatures are tiles in the home row now, five across. Creatures wears the player's own
toy, which is right. Kit is borrowing the red horseshoe from `art/pickups/magnet.png`, which
is a power-up you catch mid-climb, not the gear you buy before one.

Wanted: one object at the same weight and lighting as `art/ui/board.webp` and its siblings,
square, ~96×96 transparent, reading as "gear for this climb" — a small canvas tool roll, a
carabiner, a climbing harness clip. It draws at 24px, so silhouette has to carry it.

### 8. A grip texture for bare steel — `steel-grip-v1`
The one surface the climber can actually stick to is the only surface with nothing on it.
Every photogenic object on the door — cards, the calendar, the jar photo — is a slide-off.
A player's eye goes to exactly the wrong places.

Wanted: a tileable square overlay, ~256×256, that reads as "a magnet would hold here" —
iron filings caught in the brushed grain, a faint magnetic scratch halo. Subtle: it lays
over the existing steel in `scenery-materials.ts`, it does not replace it, and the door must
still look like a photograph of a fridge.

### 9. Height-tier backdrops — `door-tier-1..3`
Two or three tall portrait layers (~9:16) drawn as a parallax base in `scenery.ts`, keyed to
height: warm counter light at the bottom, cooler daylight near the top of the door. At 200cm
and at 400cm the background is currently the same texture, so climbing does not feel like
going anywhere.

### 10. Danger vignette — `danger-vignette-v1`
One full-screen edge-darkening red glow, ~9:19.5, composited over the play canvas with its
opacity driven by how close the red line is. Today the line is one or two pixels and a small
HUD bar, so the thing that kills almost every run has essentially no telegraph.

### 11. Store listing art — *not yet, hold*
Icon and screenshots for a store listing, plus fridge-door skin variants if paid cosmetic
packs are ever built. Listed so it is not forgotten; nothing should be drawn for it until
that call is actually made.

---

## Delivered

- **A hands-free clock face.** Landed as Codex pack 35 (a layered face and separate hands),
  wired up in "The fridge clock tells the time". The kitchen clock now shows the player's
  real phone time without carrying two sets of hands.

Everything else already in `public/art/` predates this file; `ART_REFRESH_HANDOFF.md` is its
record.
