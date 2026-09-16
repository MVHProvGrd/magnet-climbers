/**
 * Fit archive masters into the shipped sizes.
 *
 * art/archive holds generation masters (1024px, ~500 KB). public/ is precached, so art
 * weight is install weight: everything here is resized to the scale it is actually drawn
 * at, the same way the existing pickups and obstacles already are.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { suspension, clipEye } from "./pivots.mjs";
import { createCanvas, loadImage } from "../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js";

/** [source, destination, longest edge] */
const JOBS = [
  // pack 26: refreshed photo obstacles, matched to what they replace
  ["26-glass-obstacles-v1/ready/obstacle-calendar-v2.webp", "public/art/real-v1/obstacles/calendar.png", 340],
  ["26-glass-obstacles-v1/ready/obstacle-dispenser-v2.webp", "public/art/real-v1/obstacles/dispenser.png", 300],
  ["26-glass-obstacles-v1/ready/obstacle-handle-v2.webp", "public/art/real-v1/obstacles/handle.png", 340],
  ["26-glass-obstacles-v1/ready/obstacle-ice-tray-v2.webp", "public/art/real-v1/obstacles/ice-tray.png", 340],
  ["26-glass-obstacles-v1/ready/obstacle-plastic-v2.webp", "public/art/real-v1/obstacles/plastic.png", 340],
  ["26-glass-obstacles-v1/ready/obstacle-vent-v2.webp", "public/art/real-v1/obstacles/vent.png", 320],
  // pack 26: extra stocked windows, alongside the two already shipped
  ["26-glass-obstacles-v1/ready/glass-door-v3.webp", "public/art/real-v1/obstacles/glass-door-2.webp", 384],
  ["26-glass-obstacles-v1/ready/glass-door-v4.webp", "public/art/real-v1/obstacles/glass-door-3.webp", 384],
  ["26-glass-obstacles-v1/ready/glass-wide-v3.webp", "public/art/real-v1/obstacles/glass-wide-2.webp", 768],
  ["26-glass-obstacles-v1/ready/glass-wide-v4.webp", "public/art/real-v1/obstacles/glass-wide-3.webp", 768],
  // pack 30: seven more toy bumpers, drawn about 90x50, shipped like bumper-0..5 (~320 px)
  ["30-bumper-variety-v1/ready/bumper-taxi-v1.webp", "public/art/bumpers/bumper-6.webp", 320],
  ["30-bumper-variety-v1/ready/bumper-race-car-v1.webp", "public/art/bumpers/bumper-7.webp", 320],
  ["30-bumper-variety-v1/ready/bumper-banana-v1.webp", "public/art/bumpers/bumper-8.webp", 320],
  ["30-bumper-variety-v1/ready/bumper-space-shuttle-v1.webp", "public/art/bumpers/bumper-9.webp", 320],
  ["30-bumper-variety-v1/ready/bumper-letter-block-v1.webp", "public/art/bumpers/bumper-10.webp", 320],
  ["30-bumper-variety-v1/ready/bumper-plastic-brick-v1.webp", "public/art/bumpers/bumper-11.webp", 320],
  ["30-bumper-variety-v1/ready/bumper-gummy-bear-v1.webp", "public/art/bumpers/bumper-12.webp", 320],

  // packs 21 + 24: the remaining twenty paper prints, shipped like paper-0..11 (~384 px)
  ...Array.from({ length: 8 }, (_, i) =>
    [`21-paper-classics-v1/ready/paper-${i + 12}-v1.webp`, `public/art/paper/paper-${i + 12}.webp`, 384]),
  ...Array.from({ length: 12 }, (_, i) =>
    [`24-new-papers-v1/ready/paper-new-${i}-v1.webp`, `public/art/paper/paper-new-${i}.webp`, 384]),

  // pack 25: the five assemblies that fill the empty cells of the kind x theme grid
  ["25-hardware-pickup-v1/ready/swing-travel-v1.webp", "public/art/gadgets/swing-travel.webp", 384, "suspension"],
  ["25-hardware-pickup-v1/ready/swing-doodle-v1.webp", "public/art/gadgets/swing-doodle.webp", 384, "suspension"],
  ["25-hardware-pickup-v1/ready/rotor-snack-v1.webp", "public/art/gadgets/rotor-snack.webp", 384, "centre"],
  ["25-hardware-pickup-v1/ready/rotor-travel-v1.webp", "public/art/gadgets/rotor-travel.webp", 384, "centre"],
  ["25-hardware-pickup-v1/ready/rotor-doodle-v1.webp", "public/art/gadgets/rotor-doodle.webp", 384, "centre"],

  // pack 27: twelve keyring swings. Each hangs about its own measured hook.
  ...["baby-shoe", "bead-lanyard", "bottle-opener", "carabiner-whistle", "disco-ball", "fishing-lure",
      "keys", "measuring-spoons", "rubber-duck", "scissors", "souvenir-spoon", "wind-chime"].map((n) =>
    [`27-hanging-variety-v1/ready/swing-${n}-v1.webp`, `public/art/gadgets/swing-${n}.webp`, 384, "suspension"]),

  // pack 28: four rotors. Codex normalised every spindle to the centre of a 1024 square.
  ...["clock", "fidget-spinner", "pinwheel", "thermometer"].map((n) =>
    [`28-rotor-variety-v1/ready/rotor-${n}-v1.webp`, `public/art/gadgets/rotor-${n}.webp`, 384, "centre"]),

  // pack 29: seven clipped sheets. The mount is the clip eye, never the paper centre.
  ...["birthday-invite", "concert-ticket", "coupon-sheet", "grandma-polaroid", "lost-cat",
      "report-card", "takeout-receipt"].map((n) =>
    [`29-clip-variety-v1/ready/clip-${n}-v1.webp`, `public/art/gadgets/clip-${n}.webp`, 384, "clip"]),
];

/** Pivot in SOURCE pixels, before the trim and rescale below moves it. */
async function sourcePivot(mode, path, img) {
  if (mode === "centre") return { x: img.width / 2, y: img.height / 2 };
  const m = mode === "clip" ? await clipEye(path) : await suspension(path);
  return { x: m.cx, y: m.susp };
}

let before = 0, after = 0;
const pivots = {};
for (const [src, dst, longest, pivotMode] of JOBS) {
  const path = `art/archive/${src}`;
  if (!existsSync(path)) { console.log("missing", path); continue; }
  const raw = readFileSync(path);
  const img = await loadImage(raw);
  // Trim to the opaque bounds FIRST so the subject fills its frame, then fit the
  // longest edge. This used to only say it did: a generation with generous margins
  // shipped those margins, and since the game fits art inside its slot, a padded
  // toy drew at half the size of one that was trimmed.
  const probe = createCanvas(img.width, img.height);
  const pctx = probe.getContext("2d");
  pctx.drawImage(img, 0, 0);
  const px = pctx.getImageData(0, 0, img.width, img.height).data;
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (px[(y * img.width + x) * 4 + 3] > 32) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const cw = x1 >= x0 ? x1 - x0 + 1 : img.width, ch = y1 >= y0 ? y1 - y0 + 1 : img.height;
  if (x1 < x0) { x0 = 0; y0 = 0; }
  const scale = Math.min(1, longest / Math.max(cw, ch));
  const w = Math.max(1, Math.round(cw * scale)), h = Math.max(1, Math.round(ch * scale));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, x0, y0, cw, ch, 0, 0, w, h);
  if (pivotMode) {
    // the same trim and scale the pixels just went through, applied to the measured point
    const sp = await sourcePivot(pivotMode, path, img);
    const id = dst.split("/").pop().replace(/\.\w+$/, "");
    pivots[id] = [+(((sp.x - x0) * scale) / w).toFixed(4), +(((sp.y - y0) * scale) / h).toFixed(4)];
  }
  const out = dst.endsWith(".png") ? canvas.toBuffer("image/png") : canvas.toBuffer("image/webp", 92);
  mkdirSync(dirname(dst), { recursive: true });
  const prev = existsSync(dst) ? readFileSync(dst).length : 0;
  writeFileSync(dst, out);
  before += prev || raw.length; after += out.length;
  console.log(`${dst.padEnd(46)} ${img.width}x${img.height} -> trimmed ${cw}x${ch} -> ${w}x${h} ${(out.length/1024)|0}KB`);
}
// The three pack-10 clips predate this script, so they are measured from what already ships.
// swing-snack deliberately keeps KEYCHAIN_PIVOT: it is also the hook and chain composited
// under every drawn charm, so moving it would shift far more than one sprite.
for (const id of ["clip-snack", "clip-travel", "clip-doodle"]) {
  const f = `public/art/gadgets/${id}.webp`;
  if (!existsSync(f)) continue;
  const m = await clipEye(f);
  pivots[id] = [+(m.cx / m.w).toFixed(4), +(m.susp / m.h).toFixed(4)];
}

if (Object.keys(pivots).length) {
  const body = Object.entries(pivots).sort(([a], [b]) => a.localeCompare(b))
    .map(([id, [x, y]]) => `  "${id}": [${x}, ${y}],`).join("\n");
  writeFileSync("src/game/gadget-pivots.ts", `// GENERATED by scripts/install-art.mjs - do not edit by hand.
// Where each photographed assembly hangs or turns, as a fraction of its own shipped frame.
// Measured per asset: Codex's handoffs are explicit that these were not drawn against one
// shared pivot, so a single hard-coded point would hang half of them off their hooks.
export const GADGET_PIVOTS: Record<string, readonly [number, number]> = {
${body}
};
`);
  console.log(`pivots written for ${Object.keys(pivots).length} assemblies`);
}
console.log(`\nshipped ${JOBS.length} assets: ${(after/1024)|0} KB (masters were ${(before/1024)|0} KB)`);
