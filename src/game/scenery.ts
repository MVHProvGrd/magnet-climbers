import type { Bumper, NoStickZone, PowerUp, PowerKind } from "./types";
import { fridgeItem, toyHook, type FridgeItem } from "./items";
import { drawObject } from "./item-art";
import { drawObstacleImage, drawObstaclePreview, obstacleImage } from "./obstacle-art";
import { drawPaperPrint, drawBusinessMagnet, drawFieldMagnet, drawPickupObject, drawHardwareGrip, drawObstacleObject } from "./fridge-art";
import { drawGadget } from "./gadget-art";
import { destinationArtFor, destinationArtById, drawDestination, objectArtById, KEYCHAIN } from "./gadget-art";
import { drawPickupImage, pickupImage } from "./pickup-art";
import { drawKidHand, handPose } from "./kid-hand";
import { DOOR_SEAM, POP_BUBBLES, POP_RADIUS } from "./world";
import { drawSteel, drawSeam, drawZone as drawMaterialZone, drawBumper as drawMaterialBumper } from "./scenery-materials";
export { drawPanelJoint } from "./scenery-materials";

// This RNG is art-only. Never consume World.rng while rendering.
export function artVariant(x: number, y: number, seed: number, count: number): number {
  let hash = Math.imul(Math.round(x * 10) ^ seed, 374761393) ^ Math.imul(Math.round(y * 10), 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) % count;
}

const cards = new WeakMap<NoStickZone, { seed: number; image: HTMLCanvasElement }>();
const TAU = Math.PI * 2;

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function line(ctx: CanvasRenderingContext2D, points: number[], color: string, width = 2) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.stroke();
}
function polygon(ctx: CanvasRenderingContext2D, points: number[], color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath(); ctx.fill();
}
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = "#384b59") {
  ctx.fillStyle = color; ctx.font = `800 ${size}px system-ui, sans-serif`; ctx.textAlign = "center";
  ctx.fillText(value, x, y);
}
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
}

/** Claude's material lighting under the expanded collection of fridge art. */
export function drawSurface(ctx: CanvasRenderingContext2D, top: number, bottom: number) {
  drawSteel(ctx, top + 50, bottom - top - 100);
  drawSeam(ctx, top, bottom);
}

/** Small cartoon illustrations are drawn in a 100x100 square inside the real paper collider. */
function doodle(ctx: CanvasRenderingContext2D, variant: number) {
  if (variant >= 100) { drawPaperPrint(ctx, variant - 100); return; }
  if (variant >= 12) { drawObject(ctx, variant); return; }
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  switch (variant % 8) {
    case 0: { // Pizza postcard
      box(ctx, 0, 0, 100, 100, "#ffd6aa");
      polygon(ctx, [23, 21, 82, 28, 48, 78], "#b95c35");
      polygon(ctx, [24, 27, 77, 32, 48, 73], "#ffcb4f");
      line(ctx, [23, 22, 49, 20, 81, 28], "#e8954e", 10);
      for (const [x, y] of [[39, 36], [63, 39], [49, 56]]) circle(ctx, x, y, 6, "#e15a4e");
      text(ctx, "SLICE OF LIFE", 50, 93, 10, "#853d36"); break;
    }
    case 1: { // Cat drawing
      box(ctx, 0, 0, 100, 100, "#e7daf8");
      polygon(ctx, [22, 44, 20, 15, 44, 32, 58, 31, 81, 15, 78, 49], "#e59d65");
      circle(ctx, 50, 52, 28, "#eeb57f");
      polygon(ctx, [25, 31, 25, 22, 36, 32], "#e58593");
      polygon(ctx, [66, 32, 77, 22, 75, 34], "#e58593");
      circle(ctx, 39, 49, 2.5, "#44333b"); circle(ctx, 61, 49, 2.5, "#44333b");
      polygon(ctx, [46, 57, 54, 57, 50, 61], "#b65762");
      line(ctx, [23, 56, 7, 53], "#745266", 1.5); line(ctx, [24, 62, 9, 65], "#745266", 1.5);
      line(ctx, [76, 56, 92, 53], "#745266", 1.5); line(ctx, [76, 62, 90, 65], "#745266", 1.5);
      text(ctx, "CAT NAP CLUB", 50, 94, 10); break;
    }
    case 2: { // Crayon rainbow
      box(ctx, 0, 0, 100, 100, "#fff5d6");
      for (const [i, color] of ["#f27380", "#ffb555", "#f6d95c", "#7ac8a3", "#71b8dc"].entries()) {
        ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(50, 62, 36 - i * 6, Math.PI, TAU); ctx.stroke();
      }
      for (const x of [14, 78]) { circle(ctx, x, 63, 9, "#fff"); circle(ctx, x + 9, 60, 11, "#fff"); }
      text(ctx, "HIGHER TOGETHER", 50, 91, 8.5); break;
    }
    case 3: { // Mountain souvenir
      box(ctx, 0, 0, 100, 100, "#b8d9d5"); circle(ctx, 75, 23, 12, "#fff0b2");
      polygon(ctx, [0, 75, 36, 21, 76, 75], "#61818e");
      polygon(ctx, [29, 33, 36, 21, 47, 36, 37, 32], "#f1eee4");
      polygon(ctx, [37, 76, 70, 37, 100, 74, 100, 100, 0, 100, 0, 74], "#416d69");
      text(ctx, "TAKE THE SCENIC ROUTE", 50, 92, 7, "#fff9e8"); break;
    }
    case 4: { // Rocket / space club
      box(ctx, 0, 0, 100, 100, "#3b4a78");
      for (const [x, y] of [[16, 24], [79, 14], [84, 57], [19, 66], [68, 77]]) {
        line(ctx, [x - 3, y, x + 3, y], "#fff1a8", 1.5); line(ctx, [x, y - 3, x, y + 3], "#fff1a8", 1.5);
      }
      polygon(ctx, [39, 62, 50, 88, 60, 62], "#ffbc54");
      polygon(ctx, [36, 44, 26, 66, 40, 61, 60, 61, 75, 66, 63, 44], "#f0838b");
      ctx.fillStyle = "#edf1e5"; ctx.beginPath(); ctx.ellipse(50, 42, 15, 28, 0, 0, TAU); ctx.fill();
      circle(ctx, 50, 39, 8, "#78c5dd"); circle(ctx, 47, 36, 2, "#e5faff");
      text(ctx, "SPACE CADET", 50, 97, 8, "#fff"); break;
    }
    case 5: { // House doodle
      box(ctx, 0, 0, 100, 100, "#fff9e7"); circle(ctx, 80, 18, 10, "#f3ca54");
      line(ctx, [7, 78, 31, 75, 56, 79, 92, 74], "#85b779", 4);
      box(ctx, 29, 43, 41, 34, "#eea77e"); polygon(ctx, [23, 45, 50, 19, 77, 45], "#d97576");
      box(ctx, 44, 56, 13, 21, "#91b8bc"); box(ctx, 33, 50, 8, 9, "#e7eee3");
      text(ctx, "HOME SWEET FRIDGE", 50, 95, 8); break;
    }
    case 6: { // Flower
      box(ctx, 0, 0, 100, 100, "#d5ecd4");
      line(ctx, [50, 48, 48, 78], "#57896b", 4);
      ctx.fillStyle = "#7aaf79"; ctx.beginPath(); ctx.ellipse(38, 66, 12, 5, 0.4, 0, TAU); ctx.fill();
      for (let i = 0; i < 6; i++) circle(ctx, 50 + Math.cos(i * TAU / 6) * 16, 38 + Math.sin(i * TAU / 6) * 16, 11, "#ee96a8");
      circle(ctx, 50, 38, 12, "#ffdd72"); circle(ctx, 46, 36, 1.5, "#775c42"); circle(ctx, 54, 36, 1.5, "#775c42");
      text(ctx, "GROW YOUR OWN WAY", 50, 94, 7.5); break;
    }
    case 7: { // Cheerful penguin
      box(ctx, 0, 0, 100, 100, "#cbe8ec");
      ctx.fillStyle = "#3d5268"; ctx.beginPath(); ctx.ellipse(50, 47, 25, 33, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#f9f6e9"; ctx.beginPath(); ctx.ellipse(50, 55, 18, 22, 0, 0, TAU); ctx.fill();
      circle(ctx, 42, 35, 4, "#fff"); circle(ctx, 58, 35, 4, "#fff"); circle(ctx, 42, 35, 1.7, "#304353"); circle(ctx, 58, 35, 1.7, "#304353");
      polygon(ctx, [45, 43, 55, 43, 50, 49], "#eca14e");
      line(ctx, [37, 79, 43, 79], "#eca14e", 6); line(ctx, [56, 79, 63, 79], "#eca14e", 6);
      text(ctx, "STAY COOL", 50, 96, 10); break;
    }
  }
}


function paintZone(ctx: CanvasRenderingContext2D, z: NoStickZone, seed: number) {
  const w = z.w, h = z.h;
  const variant = fridgeItem(z.itemId)?.art ?? artVariant(z.x, z.y, seed ^ (z.hue ?? 0), 12);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  const photo = z.kind === "sticker" && z.itemId ? objectArtById(z.itemId) : undefined;
  if (photo) {
    const iw = (photo as HTMLImageElement).naturalWidth || (photo as HTMLCanvasElement).width || 1;
    const ih = (photo as HTMLImageElement).naturalHeight || (photo as HTMLCanvasElement).height || 1;
    // Contain, and nothing behind it. The photo is a cut-out piece of paper with
    // its own edges, so a card-coloured rectangle under it only ever showed up as
    // a cream border wherever the zone was not exactly the photo's shape.
    const s = Math.min(w / iw, h / ih), dw = iw * s, dh = ih * s;
    ctx.drawImage(photo, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.restore(); return;
  }
  if (z.kind === "sticker") {
    const note = variant >= 8 && variant < 12;
    // The drawing is authored square, so the PAPER is square too. Painting the card
    // across the whole zone and fitting the drawing inside it left the paper showing
    // as a white border down both sides of anything that was not square.
    const cs = Math.min(w, h), cx = (w - cs) / 2, cy = (h - cs) / 2;
    box(ctx, cx, cy, cs, cs, note ? ["#ffdf81", "#d8edb7", "#fac4d2", "#bae4ea"][variant - 8] : "#fcf6e8");
    ctx.save(); ctx.translate(cx, cy);
    if (note) {
      const lines = [["TO DO", "climb fridge", "find snacks", "repeat"], ["YOU GOT", "THIS!", "", "keep climbing"], ["DON'T", "LET", "GO!", ""], ["MILK", "EGGS", "MORE", "MAGNETS"]][variant - 8];
      ctx.save(); fitSquare(ctx, cs * 0.1, cs * 0.17, cs * 0.8, cs * 0.75);
      for (let i = 0; i < 4; i++) text(ctx, lines[i], 50, 17 + i * 23, i === 0 ? 17 : 13, "#4b5355");
      ctx.restore();
    } else {
      ctx.save(); fitSquare(ctx, cs * 0.07, cs * 0.1, cs * 0.86, cs * 0.82); doodle(ctx, variant); ctx.restore();
    }
    // A small pin lives inside the nonstick card, never outside its collider.
    circle(ctx, cs * 0.52 + 1.5, 7, 4, "rgba(40,52,60,0.2)");
    circle(ctx, cs * 0.52, 5, 3.6, ["#ec7284", "#69b5d1", "#e8b54c"][variant % 3]);
    circle(ctx, cs * 0.52 - 1, 4, 1, "rgba(255,255,255,0.7)");
    polygon(ctx, [cs - 9, cs, cs - 9, cs - 9, cs, cs - 9], "rgba(91,81,64,0.16)");
    polygon(ctx, [cs - 9, cs, cs - 9, cs - 9, cs, cs - 9], "rgba(255,255,255,0.45)");
    ctx.restore();
  } else if (z.kind === "glass") {
    const glass = ctx.createLinearGradient(0, 0, w, h);
    glass.addColorStop(0, "#497788"); glass.addColorStop(0.5, ["#284759", "#345b62", "#364e6b"][variant % 3]); glass.addColorStop(1, "#172c41");
    ctx.fillStyle = glass; ctx.fillRect(0, 0, w, h);
    // Frosted shelves read as being behind the glass, not usable steel ledges.
    for (let row = 38; row < h - 24; row += 74) {
      box(ctx, 10, row + 35, w - 20, 1.5, "rgba(175,226,232,0.12)");
      for (let x = 23; x < w - 20; x += 43) {
        const tint = ["rgba(174,208,167,0.15)", "rgba(241,219,155,0.12)", "rgba(227,159,171,0.13)"][artVariant(x, row, variant, 3)];
        box(ctx, x - 7, row + 8, 15, 26, tint); box(ctx, x - 4, row + 3, 9, 6, tint);
      }
    }
    polygon(ctx, [0, h * 0.65, w, h * 0.08, w, h * 0.24, 0, h * 0.81], "rgba(205,243,244,0.13)");
    line(ctx, [8, h * 0.83, w - 8, h * 0.26], "rgba(231,253,255,0.3)", 1);
    ctx.strokeStyle = "#354958"; ctx.lineWidth = 5; ctx.strokeRect(2.5, 2.5, w - 5, h - 5);
  }
  ctx.restore();
}

/** Map the 100x100 space a drawn card is authored in onto `w`x`h`, centred and
 *  never distorted: a wide card gets paper margins rather than stretched art. */
function fitSquare(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const s = Math.min(w, h) / 100;
  ctx.translate(x + (w - 100 * s) / 2, y + (h - 100 * s) / 2);
  ctx.scale(s, s);
}

function drawFieldArcs(ctx: CanvasRenderingContext2D, z: NoStickZone, time: number, outward: boolean, dim = 1) {
  const cx = z.x + z.w / 2;
  const power = z.power ?? 1;
  const span = 34 * Math.sqrt(power) * (outward ? 1 + Math.max(0, power - 1) : 1); // how far the field reaches past the plate
  const gap = span / 3;            // spacing between arcs
  const rx = Math.max(z.w, z.h) / 2 + 4;
  const phase = (time * 14) % gap;
  ctx.strokeStyle = outward ? "#ff687d" : "#6fb6ff";
  ctx.lineWidth = 1.4 + Math.max(0, power - 1) * 1.2;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const d = outward ? i * gap + phase : (i + 1) * gap - phase;
    if (d <= 0 || d > span) continue;
    ctx.globalAlpha = (1 - d / span) * 0.45 * dim;
    const r = rx + d;
    const s = (rx + d * 0.75) / r;
    // top edge: semicircle over the plate, squashed to hug it
    ctx.save(); ctx.translate(cx, z.y); ctx.scale(1, s);
    ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, Math.PI * 2); ctx.stroke(); ctx.restore();
    // bottom edge
    ctx.save(); ctx.translate(cx, z.y + z.h); ctx.scale(1, s);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.stroke(); ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function drawZone(ctx: CanvasRenderingContext2D, z: NoStickZone, time: number, seed: number) {
  if (drawObstacleImage(ctx, z)) {
    if (z.kind === 'attract' || z.kind === 'repel') {
      ctx.save(); drawFieldArcs(ctx, z, time, z.kind === 'repel'); ctx.restore();
    }
    return;
  }
  if (!z.swing && z.itemId?.startsWith("bumper-")) {
    // toy stuck straight on the door by its magnet backing: a weak N field, so it gets small arcs
    const toy = objectArtById(z.itemId);
    ctx.save(); ctx.shadowColor = "#24374755"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
    if (toy) {
      const iw = (toy as HTMLImageElement).naturalWidth || 1, ih = (toy as HTMLImageElement).naturalHeight || 1;
      const s = Math.min(z.w / iw, z.h / ih), dw = iw * s, dh = ih * s, dx = z.x + (z.w - dw) / 2, dy = z.y + (z.h - dh) / 2;
      ctx.drawImage(toy, dx, dy, dw, dh);
      if (z.pops != null) { ctx.shadowColor = "transparent"; drawPops(ctx, dx, dy, dw, dh, z.pops); }
    }
    else { const item = fridgeItem(z.itemId); drawBumper(ctx, { x: z.x, y: z.y, w: z.w, h: z.h, vx: 0, minX: 0, maxX: 0, label: item?.label ?? "", hue: item?.hue ?? 0, itemId: undefined, motion: "slide", vy: 0, minY: 0, maxY: 0 }); }
    // a hint of a field. A toy magnet can sit either way round, so the arcs say which: red
    // creeping outward pushes you off, blue closing inward pulls you in.
    const pulls = (z.power ?? 0) < 0;
    ctx.restore(); ctx.save(); ctx.strokeStyle = pulls ? "#63c7ff" : "#ff687d"; ctx.lineWidth = 1.2;
    const rr = toy ? (() => { const iw = (toy as HTMLImageElement).naturalWidth || 1, ih = (toy as HTMLImageElement).naturalHeight || 1; const s = Math.min(z.w / iw, z.h / ih); return { x: z.x + (z.w - iw * s) / 2, y: z.y + (z.h - ih * s) / 2, w: iw * s, h: ih * s }; })() : z;
    const drift = (time * 6) % 6;
    for (let i = 0; i < 2; i++) {
      const d = 3 + i * 6 + (pulls ? 6 - drift : drift); ctx.globalAlpha = 0.32 * (1 - d / 16);
      ctx.beginPath(); ctx.roundRect(rr.x - d, rr.y - d, rr.w + d * 2, rr.h + d * 2, 10 + d); ctx.stroke();
    }
    ctx.restore(); return;
  }
  if (z.swing && z.itemId) {
    // toy keychain: plain resin on a chain, no field; it just swings when brushed
    const toy = objectArtById(z.itemId), hardware = objectArtById("swing-snack");
    if (toy && hardware) { drawKeychain(ctx, z, toy, hardware, z.swing.angle, z.pops, toyHook(z.itemId)); return; }
    if (hardware) {
      // no photo yet (COOL penguin): the drawn toy card hangs from the chain until Codex's art lands
      const card = document.createElement("canvas"); card.width = Math.ceil(z.w * 2); card.height = Math.ceil(z.h * 2);
      const g = card.getContext("2d")!; g.scale(2, 2);
      const item = fridgeItem(z.itemId);
      drawBumper(g, { x: 0, y: 0, w: z.w, h: z.h, vx: 0, minX: 0, maxX: 0, label: item?.label ?? "", hue: item?.hue ?? 0, itemId: undefined, motion: "slide", vy: 0, minY: 0, maxY: 0 });
      drawKeychain(ctx, z, card, hardware, z.swing.angle); return;
    }
  }
  if (z.kind === "attract" || z.kind === "repel") {
    const repel = z.kind === "repel";
    const souvenir = destinationArtFor(z.x, z.y, repel);
    ctx.save();
    if (souvenir) {
      ctx.shadowColor = "#22303966"; ctx.shadowBlur = 6; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 4;
      drawDestination(ctx, souvenir, z.x, z.y, z.w, z.h);
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    } else drawFieldMagnet(ctx, z, repel);
    drawFieldArcs(ctx, z, time, repel); ctx.restore(); return;
  }
  if (z.itemId === "glass" || z.itemId === "plastic" || z.itemId === "vent") {
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(z.w / 100, z.h / 100);
    drawObstacleObject(ctx, z.itemId); ctx.restore(); return;
  }
  if (z.hue === -1 && artVariant(z.x, z.y, seed, 3) !== 0) {
    drawHardwareGrip(ctx, z, artVariant(z.x,z.y,seed,4)); return;
  }
  if (["dispenser", "calendar", "ice-tray"].includes(z.itemId ?? "")) {
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(z.w / 100, z.h / 100);
    drawObject(ctx, z.itemId === "dispenser" ? 20 : z.itemId === "calendar" ? 21 : 22);
    ctx.restore(); return;
  }
  // Keep Claude's handles, vents, gaps and glowing repel plates; mix both glass
  // treatments, and retain his four card styles alongside the 12 new drawings.
  const variant = artVariant(z.x, z.y, seed, 16);
  const material = z.hue === -1 || z.kind === "trim" || z.kind === "void"
    || (z.kind === "glass" && variant % 2 === 0) || (z.kind === "sticker" && !z.itemId && variant >= 12);
  if (material) {
    ctx.save(); drawMaterialZone(ctx, z, time);
    ctx.restore();
    return;
  }
  let cached = cards.get(z);
  if (!cached || cached.seed !== seed) {
    const image = document.createElement("canvas");
    image.width = Math.ceil(z.w * 2); image.height = Math.ceil(z.h * 2);
    const g = image.getContext("2d")!; g.scale(2, 2); paintZone(g, z, seed);
    cached = { seed, image }; cards.set(z, cached);
  }
  ctx.save();
  if (z.kind === "sticker") {
    ctx.shadowColor = "rgba(27,35,43,0.22)"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;
  }
  ctx.drawImage(cached.image, z.x, z.y, z.w, z.h); ctx.restore();
}

/** Visual-only pendulum per toy keychain bumper: the ring hangs from the slider, so reversals and stops swing the toy. */
const keychainSwing = new WeakMap<Bumper, { angle: number; vel: number; time: number; vx: number }>();
/** Hook and chain rows of the lemon keychain image (fractions of its height); the pivot is the hook's ring. */
// the keychain hardware is measured once, in gadget-art, so both composites agree
const CHAIN = { pivotX: KEYCHAIN.x, pivotY: KEYCHAIN.y, chainEnd: KEYCHAIN.chainEnd };
/** POP! bubbles pushed in: a concave shadow over each bubble whose bit is set, drawn over the toy image rect. */
function drawPops(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pops: number) {
  const r = POP_RADIUS * w;
  POP_BUBBLES.forEach(([u, v], i) => {
    if (!(pops & (1 << i))) return;
    const cx = x + u * w, cy = y + v * h;
    const g = ctx.createRadialGradient(cx + r * 0.2, cy + r * 0.25, r * 0.1, cx, cy, r);
    g.addColorStop(0, "rgba(20,25,35,0.55)"); g.addColorStop(0.75, "rgba(20,25,35,0.28)"); g.addColorStop(1, "rgba(255,255,255,0.25)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  });
}
/** A toy on the lemon's hook and chain: hook fixed above the rect, chain + toy rotated by `angle` about the ring. */
export function drawKeychain(ctx: CanvasRenderingContext2D, b: { x: number; y: number; w: number; h: number }, toy: CanvasImageSource, hardware: CanvasImageSource, angle: number, pops?: number, hook: readonly [number, number] = [0.5, 0.02]) {
  const hw = (hardware as HTMLImageElement).naturalWidth || (hardware as HTMLCanvasElement).width || 1;
  const hh = (hardware as HTMLImageElement).naturalHeight || (hardware as HTMLCanvasElement).height || 1;
  const tw = (toy as HTMLImageElement).naturalWidth || (toy as HTMLCanvasElement).width || 1;
  const th = (toy as HTMLImageElement).naturalHeight || (toy as HTMLCanvasElement).height || 1;
  const chain = 30; // visible chain length in px
  const s = chain / ((CHAIN.chainEnd - CHAIN.pivotY) * hh);
  const f = Math.min(b.w / tw, b.h / th) * 1.1, dw = tw * f, dh = th * f;
  // The chain ends ON the toy: over the duck's head, the banana's stem, the block's
  // top corner. The toy still hangs centred on its collider, so the hook slides
  // sideways to meet its contact point instead of the toy sliding off the magnet.
  const [hookU, hookV] = hook;
  const px = b.x + b.w / 2 + (hookU - 0.5) * dw, py = b.y - chain - 2 + hookV * dh;
  ctx.save(); ctx.shadowColor = "#24374755"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
  // hook: fixed to the slider
  ctx.drawImage(hardware, 0, 0, hw, CHAIN.pivotY * hh, px - CHAIN.pivotX * hw * s, py - CHAIN.pivotY * hh * s, hw * s, CHAIN.pivotY * hh * s);
  // chain and toy: one rigid piece about the ring
  ctx.translate(px, py); ctx.rotate(angle);
  ctx.drawImage(hardware, 0, CHAIN.pivotY * hh, hw, (CHAIN.chainEnd - CHAIN.pivotY) * hh, -CHAIN.pivotX * hw * s, 0, hw * s, chain);
  const tx = -hookU * dw, ty = chain - 2 - hookV * dh;
  ctx.drawImage(toy, tx, ty, dw, dh);
  if (pops != null) { ctx.shadowColor = "transparent"; drawPops(ctx, tx, ty, dw, dh, pops); }
  ctx.restore();
}
/** Old-world sliding toy: the pendulum is visual only, kicked by the slider's reversals. */
function drawKeychainBumper(ctx: CanvasRenderingContext2D, b: Bumper, toy: CanvasImageSource, hardware: CanvasImageSource, time: number) {
  const st = keychainSwing.get(b) ?? { angle: 0, vel: 0, time, vx: b.vx };
  const dt = Math.min(0.05, Math.max(0, time - st.time));
  if (dt > 0) {
    const kick = Math.max(-3, Math.min(3, -(b.vx - st.vx) / 90));
    st.vel += kick + (-9.8 * Math.sin(st.angle) - 1.4 * st.vel) * dt;
    st.angle += st.vel * dt;
  }
  st.time = time; st.vx = b.vx; keychainSwing.set(b, st);
  drawKeychain(ctx, b, toy, hardware, st.angle, undefined, toyHook(b.itemId));
}

export function drawBumper(ctx: CanvasRenderingContext2D, b: Bumper, time = 0) {
  const item = fridgeItem(b.itemId);
  const photo = item && objectArtById(item.id);
  const hardware = objectArtById("swing-snack");
  if (photo && hardware && item.id.startsWith("bumper-")) { drawKeychainBumper(ctx, b, photo, hardware, time); return; }
  if (photo) {
    // the collider is the magnet (v13 sliders are 72-100 px wide); older worlds' small sliders draw a little larger
    const k = b.w >= 72 ? 1 : 1.5, w = b.w * k, h = b.h * k, x = b.x + (b.w - w) / 2, y = b.y + (b.h - h) / 2;
    // exact contain fit, no oversize and no clip: the ends of a bone or a bus must not get trimmed
    const iw = (photo as HTMLImageElement).naturalWidth || 1, ih = (photo as HTMLImageElement).naturalHeight || 1;
    const s = Math.min(w / iw, h / ih), dw = iw * s, dh = ih * s;
    ctx.save(); ctx.shadowColor = "#24374755"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
    ctx.drawImage(photo, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.restore(); return;
  }
  if (item?.art != null && item.art >= 100) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.w / 100, b.h / 60);
    ctx.shadowColor = "#24374755"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
    drawBusinessMagnet(ctx, item.art - 100); ctx.restore(); return;
  }
  if (!item && (b.label.length <= 1 || artVariant(b.minX, b.minY, b.hue, 7) >= 5)) {
    ctx.save(); drawMaterialBumper(ctx, b); ctx.restore(); return;
  }
  ctx.save(); ctx.translate(b.x, b.y);
  const variant = artVariant(b.minX, b.minY, b.hue, 5);
  ctx.shadowColor = "rgba(25,35,49,0.25)"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;
  const enamel = ctx.createLinearGradient(0, 0, b.w, b.h);
  enamel.addColorStop(0, `hsl(${b.hue} 65% 82%)`); enamel.addColorStop(0.4, `hsl(${b.hue} 65% 60%)`); enamel.addColorStop(1, `hsl(${b.hue} 50% 39%)`);
  ctx.fillStyle = enamel; ctx.beginPath(); ctx.roundRect(0, 0, b.w, b.h, 5); ctx.fill();
  ctx.shadowColor = "transparent"; ctx.strokeStyle = "rgba(255,255,255,0.65)"; ctx.lineWidth = 1.3; ctx.stroke();
  if (item?.art != null) {
    ctx.save(); ctx.translate(3, 3); ctx.scale((b.h - 6) / 100, (b.h - 6) / 100); doodle(ctx, item.art); ctx.restore();
    text(ctx, b.label, b.w * 0.76, b.h * 0.58, Math.min(9, b.w * 0.4 / b.label.length * 1.5), "#fffbea");
  } else if (variant === 0) {
    // Pizza delivery magnet.
    ctx.save(); ctx.translate(4, 3); ctx.scale(0.28, 0.28); doodle(ctx, 0); ctx.restore();
    text(ctx, "YUM", b.w * 0.74, b.h * 0.6, 9, "#fff8dd");
  } else if (variant === 1) {
    circle(ctx, b.w / 2, b.h / 2, 12, "#ffe17a");
    circle(ctx, b.w / 2 - 4, b.h / 2 - 3, 1.6, "#6c4c38"); circle(ctx, b.w / 2 + 4, b.h / 2 - 3, 1.6, "#6c4c38");
    ctx.strokeStyle = "#9e653e"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.w / 2, b.h / 2, 6, 0.2, Math.PI - 0.2); ctx.stroke();
  } else {
    const caption = variant === 2 ? "COOL!" : variant === 3 ? b.label : "WOW";
    text(ctx, caption, b.w / 2, b.h / 2 + 5, Math.min(15, (b.w - 10) / Math.max(1, caption.length) * 1.6), "#fffbea");
  }
  line(ctx, [5, 4, b.w - 8, 4], "rgba(255,255,255,0.5)", 1.4);
  ctx.restore();
}

export function drawPower(ctx: CanvasRenderingContext2D, p: PowerUp, time: number) {
  // quiet idle bob, same as Codex's enamel badge study (3 px at 2 rad/s), for every pickup
  ctx.save(); ctx.translate(p.x, p.y + Math.sin(time * 2 + p.bob) * 3);
  ctx.shadowColor = "#21374855"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
  // generated image art first; the canvas drawing stays as the fallback while images load
  if (!drawPickupImage(ctx, p.kind)) drawPickupObject(ctx, p.kind);
  ctx.restore();
}

/** Previous badge illustrations retained for a retro look. */
export function drawLegacyPower(ctx: CanvasRenderingContext2D, p: PowerUp, time: number) {
  const bob = Math.sin(time * 3 + p.bob), y = p.y + bob * 4;
  const colors: Record<PowerKind, string> = { coin: "#ffcf58", gem: "#70d9ed", magnet: "#ee7a91", extra: "#a9d783", slowmo: "#b5a2ed", reach: "#81cce5", heart: "#ff8fb0", candy: "#ff8fb0", paint: "#7ad1ff" };
  ctx.save(); ctx.translate(p.x, y); ctx.lineCap = "round";
  if (p.kind !== "coin") {
    ctx.strokeStyle = `${colors[p.kind]}66`; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, 19 + bob * 1.5, 0, TAU); ctx.stroke();
  }
  ctx.shadowColor = "rgba(35,46,58,0.25)"; ctx.shadowBlur = 3; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 4;
  const gloss = ctx.createLinearGradient(-12, -15, 12, 15);
  gloss.addColorStop(0, "#fff7da"); gloss.addColorStop(0.3, colors[p.kind]); gloss.addColorStop(1, p.kind === "coin" ? "#d18b36" : "#4d748c");
  ctx.fillStyle = gloss; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1; ctx.stroke();
  if (p.kind === "coin") {
    ctx.strokeStyle = "#b57a31"; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.stroke();
    text(ctx, "$", 0, 5, 16, "#8f5a23");
  } else if (p.kind === "gem") {
    polygon(ctx, [-9, -4, -4, -9, 5, -9, 10, -4, 0, 10], "#dcffff");
    polygon(ctx, [-9, -4, 0, -3, 0, 10], "#51b5dd"); polygon(ctx, [0, -3, 10, -4, 0, 10], "#278bc0");
  } else if (p.kind === "magnet") {
    ctx.strokeStyle = "#b63c58"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 1, 7, 0, Math.PI); ctx.stroke();
    line(ctx, [-7, 1, -7, -7], "#d44b65", 6); line(ctx, [7, 1, 7, -7], "#5686d0", 6);
    line(ctx, [-7, -7, -7, -9], "#f4f8f5", 6); line(ctx, [7, -7, 7, -9], "#f4f8f5", 6);
  } else if (p.kind === "slowmo") {
    circle(ctx, 0, 1, 9, "#f9f3e6"); circle(ctx, 0, 1, 1.4, "#60507e");
    line(ctx, [0, -6, 0, 1, 5, 3], "#665185", 2); line(ctx, [-3, -11, 3, -11], "#665185", 3);
  } else if (p.kind === "heart") {
    ctx.fillStyle = "#e0325f";
    ctx.beginPath();
    ctx.arc(-4, -3, 4.5, 0, TAU); ctx.arc(4, -3, 4.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8.3, -1.5); ctx.lineTo(0, 9); ctx.lineTo(8.3, -1.5); ctx.closePath(); ctx.fill();
    circle(ctx, -4.5, -4.5, 1.4, "rgba(255,255,255,0.8)");
  } else if (p.kind === "paint") {
    // bucket: tapered body, handle, and a colour spill over the lip
    ctx.fillStyle = "#3f4a55";
    ctx.beginPath(); ctx.moveTo(-7.5, -4); ctx.lineTo(7.5, -4); ctx.lineTo(5.5, 8); ctx.lineTo(-5.5, 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#9fb3c4"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, -5, 6.5, Math.PI, TAU); ctx.stroke();
    ctx.fillStyle = "#7ad1ff";
    ctx.beginPath(); ctx.ellipse(0, -4, 7.5, 2.2, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, -3.4); ctx.quadraticCurveTo(9, 1, 6.5, 5); ctx.quadraticCurveTo(4.5, 1, 4, -3.4); ctx.fill();
  } else if (p.kind === "extra") {
    circle(ctx, -3, -6, 3, "#376652"); line(ctx, [-3, -1, -3, 7], "#376652", 3);
    line(ctx, [-8, 1, -3, 3, 2, 0], "#376652", 2.5); line(ctx, [-7, 10, -3, 5, 1, 10], "#376652", 2.5);
    line(ctx, [5, -5, 11, -5], "#fff", 2); line(ctx, [8, -8, 8, -2], "#fff", 2);
  } else {
    line(ctx, [-9, 0, 9, 0], "#245c7b", 3);
    line(ctx, [-5, -4, -9, 0, -5, 4], "#245c7b", 2); line(ctx, [5, -4, 9, 0, 5, 4], "#245c7b", 2);
  }
  ctx.restore();
}

/** The photographic source behind a guide item, so the zoom can show it whole at its own proportions. */
export function itemPhoto(item: FridgeItem): CanvasImageSource | undefined {
  if (item.kind === "attract" || item.kind === "repel") return destinationArtById(item.id);
  if (item.power) return pickupImage(item.power);
  if (item.family === "surface" && item.id !== "gap" && item.id !== "seam") return obstacleImage(item.id);
  return objectArtById(item.id);
}
/** Actual game artwork, also used by the offline art-review previews in tests/. */
export function drawItemPreview(ctx: CanvasRenderingContext2D, item: FridgeItem) {
  if (item.id === "seam") {
    ctx.save(); ctx.beginPath(); ctx.roundRect(6, 6, 88, 88, 10); ctx.clip();
    ctx.translate(50 - DOOR_SEAM.x - DOOR_SEAM.w / 2, 0); drawSteel(ctx, 0, 100); drawSeam(ctx, 0, 100); ctx.restore(); return;
  }
  if (item.id === "kid-hand") {
    const h = { side: -1 as const, y: 0, x: 0, phase: "sweep" as const, t: 0.36, hit: new Set<number>() };
    const p = handPose(h).point;
    ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, 100, 100, 10); ctx.clip();
    ctx.translate(58, 56); ctx.scale(0.42, 0.42); ctx.translate(-p.x, -p.y); drawKidHand(ctx, h); ctx.restore(); return;
  }
  if (item.kind === "attract" || item.kind === "repel") {
    const souvenir = destinationArtById(item.id);
    const z = { x: 8, y: 8, w: 84, h: 84, kind: item.kind } as NoStickZone;
    if (souvenir) { drawDestination(ctx, souvenir, z.x, z.y, z.w, z.h); ctx.save(); drawFieldArcs(ctx, z, 0, item.kind === "repel"); ctx.restore(); }
    else drawZone(ctx, z, 0, 42);
    return;
  }
  if (item.family === 'surface' && item.id !== 'gap' && drawObstaclePreview(ctx, item.id)) return;
  if (item.id === "handle") {
    drawZone(ctx, { x: 6, y: 39, w: 88, h: 22, kind: "void", hue: -1, itemId: item.id }, 0, 42); return;
  }
  if (item.id === "glass" || item.id === "plastic" || item.id === "gap" || item.id === "vent") {
    ctx.save(); ctx.translate(4, 4); ctx.scale(.92, .92); drawObstacleObject(ctx, item.id); ctx.restore(); return;
  }
  if (item.behavior) { drawGadget(ctx, { id: item.id, itemId: item.id, kind: item.behavior, x: 50, y: 59, phase: 0 }, 0); return; }
  if (item.power) { ctx.save(); ctx.translate(50, 48); ctx.scale(2.2, 2.2); drawPower(ctx, { x: 0, y: 0, kind: item.power, taken: false, bob: 0 }, 0); ctx.restore(); }
  else if (item.family === "bumper") {
    const keychain = item.id.startsWith("bumper-") && objectArtById(item.id) && objectArtById("swing-snack");
    const r = keychain ? { x: 12, y: 46, w: 76, h: 44 } : { x: 5, y: 25, w: 90, h: 50 };
    drawBumper(ctx, { ...r, vx: 0, minX: 0, maxX: 100, label: item.label!, hue: item.hue!, itemId: item.id, motion: "slide", vy: 0, minY: r.y, maxY: r.y });
  }
  else if (item.kind === "sticker" && objectArtById(item.id)) {
    // photographed paper: the thumbnail keeps the photo's own shape instead of cropping it square
    const photo = objectArtById(item.id)!;
    const iw = (photo as HTMLImageElement).naturalWidth || (photo as HTMLCanvasElement).width || 1;
    const ih = (photo as HTMLImageElement).naturalHeight || (photo as HTMLCanvasElement).height || 1;
    const s = Math.min(88 / iw, 88 / ih), w = Math.round(iw * s), h = Math.round(ih * s);
    drawZone(ctx, { x: 50 - w / 2, y: 50 - h / 2, w, h, kind: item.kind, hue: 0, itemId: item.id }, 0, 42);
  }
  else if (item.kind) drawZone(ctx, { x: 6, y: 6, w: 88, h: 88, kind: item.kind, hue: item.metal ? -1 : 0, itemId: item.id }, 0, 42);
}
