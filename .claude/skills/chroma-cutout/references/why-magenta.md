# Why every parameter is what it is

Short version: every rule in this skill was learned by shipping a tile that
looked wrong on a dark page.

## Why chroma key instead of a background remover

Removers (rembg / u2net, "remove background" buttons, SAM-based tools) do
**subject segmentation**: they find the object and keep it. Pixels of
background that are *enclosed* by the object — the sky between two towers, the
hole under a bridge, the inside of a wheel, the gaps in a railing — are not
connected to the outer background, so the segmenter treats them as part of the
object and leaves them opaque. On the original backdrop nobody notices; the
moment the sprite sits on water, a dark card or a different scene, a flat box
appears inside the art.

A chroma key doesn't reason about objects at all. It removes every pixel that
matches the key colour **wherever it is**. Interior pockets clear for free.

Removers remain fine as a fallback when the source already has real alpha and
no interior pockets.

## Why magenta

It has to be a colour the subject will never contain. Rust, wood, steel,
concrete, skin, foliage, sky, fire, teal rim-light, amber windows — none of
them come near `#FF00FF`. Green screens work for the same reason in film, but
game and product art often contains green (foliage, LEDs, status lights);
magenta is rarer. It is also maximally saturated, so "magenta dominance"
(`min(R, B) − G`) is huge on the background and near zero or negative on art,
which is what makes a single threshold band clean.

## Why no erosion

The first version eroded the matte by 1px to guarantee no pink rim. It also
deleted every feature thinner than ~2px: antennas, propeller blades, rigging,
cable stays, scaffolding poles. Those are exactly the details that make
salvage-punk / industrial art read as detailed. The despill step handles the
rim without touching geometry, so erosion buys nothing and costs the
silhouette.

## Why no wide feather

A Gaussian blur on the matte makes a soft edge — and a ring of 20–50%
transparent pixels around the whole object. On a light backdrop that reads as
"soft". On a dark page it reads as a faint glow, an "ethereal" outline that
makes every sprite look like a ghost. The steep ramp (fully opaque at
dominance ≤ 24, fully transparent at ≥ 66, linear between) yields a ~1px
antialiased edge — the same edge a rasteriser would draw — and nothing more.

## Why the despill only fires on magenta-dominant pixels

Edge pixels are a blend of subject and key, so a rim of them is pink. The
despill caps R and B down to `G + 12` **only where the pixel still reads
magenta** (`min(R,B) − G > 6`). Amber (low B) and teal (low R) can never
satisfy that test, so a teal edge-glow or a warm window that the artist wanted
stays exactly as painted. A global desaturate-the-edge pass would kill both.

## Why `--soft` exists, and why it isn't the default

A fishing net, rigging, hair, a chain-link fence: strands thinner than a
pixel are *mixed* pixels — 50% strand, 50% key. The steep ramp calls a 50/50
pixel "background" and deletes it, chewing the mesh into swiss cheese. Soft
mode instead treats magenta dominance as roughly linear in key fraction,
estimates `alpha = 1 − cast / cast_background`, keeps that as partial
transparency, and **unmixes** the key out of the colour
(`F = (P − (1−α)·K) / α`) so the surviving strand keeps its true rope/paint
colour instead of a pink tint. A second, gentler despill catches the residue
on G-rich (tan, wood) strands.

It is not the default because on a big solid shape it leaves a faint
semi-transparent film inside enclosed pockets and a slightly softer edge — the
default's hard edge is cleaner there. Run default, look (or run the checker),
switch on evidence.

## Why the checker

Agents frequently cannot view the image they just produced. `check-cutout.py`
turns "does it look right" into numbers: a thin ring of semi-transparent
pixels is the expected antialias; thousands of them mean a halo or a mesh that
wanted soft mode; any opaque pixel still magenta-dominant means a rim that
needs soft mode or a gradient the generator drew. Exit 1 says "look before
you ship".

## Why never overwrite a generation

Image models are non-deterministic. The prompt that produced the tile you
liked will produce a *different* tile next time. If the good one is
overwritten by a re-run there is no way back — not even version control, if
it happened before the first commit (it has). Keep every take.
