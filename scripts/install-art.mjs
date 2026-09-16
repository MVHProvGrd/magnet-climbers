/**
 * Fit archive masters into the shipped sizes.
 *
 * art/archive holds generation masters (1024px, ~500 KB). public/ is precached, so art
 * weight is install weight: everything here is resized to the scale it is actually drawn
 * at, the same way the existing pickups and obstacles already are.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
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
];

let before = 0, after = 0;
for (const [src, dst, longest] of JOBS) {
  const path = `art/archive/${src}`;
  if (!existsSync(path)) { console.log("missing", path); continue; }
  const raw = readFileSync(path);
  const img = await loadImage(raw);
  // trim to the opaque bounds first so the subject fills its frame, then fit the longest edge
  const scale = Math.min(1, longest / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  const out = dst.endsWith(".png") ? canvas.toBuffer("image/png") : canvas.toBuffer("image/webp", 92);
  mkdirSync(dirname(dst), { recursive: true });
  const prev = existsSync(dst) ? readFileSync(dst).length : 0;
  writeFileSync(dst, out);
  before += prev || raw.length; after += out.length;
  console.log(`${dst.padEnd(48)} ${img.width}x${img.height} ${(raw.length/1024)|0}KB -> ${w}x${h} ${(out.length/1024)|0}KB`);
}
console.log(`\nshipped ${JOBS.length} assets: ${(after/1024)|0} KB (masters were ${(before/1024)|0} KB)`);
