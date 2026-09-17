/**
 * Find the suspension point of a hanging assembly.
 *
 * Codex's handoffs are explicit that these were not generated against one shared pivot
 * ("not all hooks landed on the same requested pixel"), so each asset is measured instead
 * of assumed: the magnetic plate is a wide blob at the top and the chain below it is much
 * narrower, so the first row where the opaque run collapses is where the thing swings from.
 */
import { readFileSync } from "node:fs";
import { createCanvas, loadImage } from "../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js";

export async function alphaRows(path) {
  const img = await loadImage(readFileSync(path));
  const c = createCanvas(img.width, img.height), x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  const px = x.getImageData(0, 0, img.width, img.height).data;
  const rows = [];
  for (let y = 0; y < img.height; y++) {
    let lo = -1, hi = -1, n = 0;
    for (let ix = 0; ix < img.width; ix++) if (px[(y * img.width + ix) * 4 + 3] > 40) { if (lo < 0) lo = ix; hi = ix; n++; }
    rows.push({ lo, hi, n, w: hi >= lo ? hi - lo + 1 : 0 });
  }
  return { img, px, rows };
}

/** Suspension point in SOURCE pixels. */
export async function suspension(path) {
  const { img, px, rows } = await alphaRows(path);
  const A = (ix, iy) => px[(iy * img.width + ix) * 4 + 3];
  let top = rows.findIndex((r) => r.n > 0);
  let bot = rows.length - 1; while (bot > 0 && rows[bot].n === 0) bot--;
  const h = bot - top + 1;

  const band = Math.max(4, Math.round(h * 0.12));
  let plateW = 0, plateRow = top;
  for (let y = top; y < Math.min(rows.length, top + band); y++) if (rows[y].w > plateW) { plateW = rows[y].w; plateRow = y; }

  let susp = plateRow;
  for (let y = plateRow; y < Math.min(rows.length, top + h * 0.45); y++) { susp = y; if (rows[y].w < plateW * 0.45) break; }

  // x from the plate band only: a charm hanging off to one side must not drag the pivot sideways
  let sx = 0, sn = 0;
  const xEnd = Math.min(rows.length - 1, plateRow + Math.round(plateW * 0.2));
  for (let y = top; y <= xEnd; y++) for (let ix = rows[y].lo; ix >= 0 && ix <= rows[y].hi; ix++) if (A(ix, y) > 40) { sx += ix; sn++; }

  return { w: img.width, h: img.height, top, bot, plateW, plateRow, susp, cx: sn ? sx / sn : img.width / 2 };
}

/**
 * Clips mount the other way up: the bulldog clip is a NARROW blob at the top and the paper
 * below it is wider, so the run never collapses - it flares. Find where it flares instead,
 * and take the eye from the clip itself.
 */
export async function clipEye(path) {
  const { img, px, rows } = await alphaRows(path);
  const A = (ix, iy) => px[(iy * img.width + ix) * 4 + 3];
  const top = rows.findIndex((r) => r.n > 0);
  let bot = rows.length - 1; while (bot > 0 && rows[bot].n === 0) bot--;
  const h = bot - top + 1;

  // width of the clip itself, from the first rows only
  const probe = rows.slice(top + 2, top + 2 + Math.max(3, Math.round(h * 0.02))).map((r) => r.w).sort((a, b) => a - b);
  const clipW = probe[probe.length >> 1] || rows[top].w;

  let paperTop = top + Math.round(h * 0.2);
  for (let y = top; y < Math.min(rows.length, top + h * 0.35); y++) if (rows[y].w > clipW * 1.8) { paperTop = y; break; }

  const eyeY = top + Math.round((paperTop - top) * 0.45);
  let sx = 0, sn = 0;
  for (let y = top; y <= paperTop; y++) for (let ix = rows[y].lo; ix >= 0 && ix <= rows[y].hi; ix++) if (A(ix, y) > 40) { sx += ix; sn++; }
  return { w: img.width, h: img.height, top, bot, clipW, paperTop, susp: eyeY, cx: sn ? sx / sn : img.width / 2 };
}
