import type { Gadget } from "./types";
import { gadgetPose, gadgetZone, THEMES, POLARITY_DESTINATIONS, polarityDestination } from "./gadgets";
import { drawFieldMagnet, drawHardwareGrip, drawPops, BUSINESS_MAGNETS } from "./fridge-art";
import { GADGET_PIVOTS } from "./gadget-pivots";
import { toyHook } from "./items";

/** Every gadget that ships as a photograph rather than drawn canvas art. */
export const GADGET_ASSEMBLIES = [
  "swing-snack", "swing-travel", "swing-doodle",
  "swing-baby-shoe", "swing-bead-lanyard", "swing-bottle-opener", "swing-carabiner-whistle",
  "swing-disco-ball", "swing-fishing-lure", "swing-keys", "swing-measuring-spoons",
  "swing-rubber-duck", "swing-scissors", "swing-souvenir-spoon", "swing-wind-chime",
  "clip-snack", "clip-travel", "clip-doodle",
  "clip-birthday-invite", "clip-concert-ticket", "clip-coupon-sheet", "clip-grandma-polaroid",
  "clip-lost-cat", "clip-report-card", "clip-takeout-receipt",
  "rotor-snack", "rotor-travel", "rotor-doodle",
  "rotor-clock", "rotor-fidget-spinner", "rotor-pinwheel", "rotor-thermometer",
] as const;

const art = new Map<string, CanvasImageSource>();
const destinationArt = new Map<string, CanvasImageSource>();
const objectArt = new Map<string, CanvasImageSource>();
export function setGadgetArt(theme: string, image: CanvasImageSource) { art.set(theme, image); }
export function setDestinationArt(id: string, image: CanvasImageSource) { destinationArt.set(id, image); }
export function setObjectArt(id: string, image: CanvasImageSource) { objectArt.set(id, image); }
const loadImage = (path: string, done: (image: CanvasImageSource) => void) => new Promise<void>((resolve) => {
  const image = new Image();
  image.onload = () => { done(image); resolve(); };
  image.onerror = () => resolve();
  image.src = `${import.meta.env.BASE_URL ?? "/"}${path}`;
});
export const gadgetArtReady = typeof Image === "undefined" ? Promise.resolve() : Promise.all([
  ...THEMES.map((theme) => loadImage(`art/gadgets/${theme}.png`, (image) => setGadgetArt(theme, image))),
  ...POLARITY_DESTINATIONS.map((id) => loadImage(`art/destinations/${id}.webp`, (image) => setDestinationArt(id, image))),
  loadImage("art/gadgets/compass-base.webp", (image) => setObjectArt("compass-base", image)),
  loadImage("art/gadgets/compass-needle.webp", (image) => setObjectArt("compass-needle", image)),
  loadImage("art/gadgets/crayon.webp", (image) => setObjectArt("crayon", image)),
  loadImage("art/gadgets/candy-pole.webp", (image) => setObjectArt("candy-pole", image)),
  // photographic business magnets (bumpers) and paper, keyed by item id; missing files fall back to canvas art
  ...Array.from({ length: BUSINESS_MAGNETS.length }, (_, i) => `business-${i}`).map((id) => loadImage(`art/business/${id}.webp`, (image) => setObjectArt(id, image))),
  // toy bumpers are keychain payloads; the hook and chain are composited from the lemon keychain at draw time
  ...Array.from({ length: 13 }, (_, i) => `bumper-${i}`).map((id) => loadImage(`art/bumpers/${id}.webp`, (image) => setObjectArt(id, image))),
  ...Array.from({ length: 20 }, (_, n) => `paper-${n}`).concat(Array.from({ length: 12 }, (_, n) => `paper-new-${n}`))
    .map((id) => loadImage(`art/paper/${id}.webp`, (image) => setObjectArt(id, image))),
  // Whole photographed assemblies - hook, chain, clip or spindle baked in - keyed by the item id
  // the world hands out. Each one hangs or turns about its own measured point in GADGET_PIVOTS.
  ...GADGET_ASSEMBLIES.map((id) => loadImage(`art/gadgets/${id}.webp`, (image) => setObjectArt(id, image))),
  loadImage("art/real-v1/kid-arm.webp", (image) => setObjectArt("kid-arm", image)),
  loadImage("art/real-v1/cat-paw.webp", (image) => setObjectArt("cat-paw", image)),
  loadImage("art/real-v1/cat-paw-claws.webp", (image) => setObjectArt("cat-paw-claws", image)),
  ...[1, 2, 3].map((n) => loadImage(`art/real-v1/claws/claw-${n}.webp`, (image) => setObjectArt(`claw-${n}`, image))),
]);
/**
 * The lemon keychain, measured on the file that actually ships (256x384, trimmed).
 *
 * chainEnd is where the chain stops and the fruit starts: row 218, the 6px neck below the
 * split ring. It used to be 0.615 - row 236 - which is a dozen rows INTO the lemon, so every
 * assembly composited onto this hardware carried a slice of lemon leaf above its own charm.
 */
export const KEYCHAIN = { x: 0.4936, y: 0.1771, chainEnd: 218 / 384 };
const KEYCHAIN_PIVOT = { x: KEYCHAIN.x, y: KEYCHAIN.y };
const imageSize = (img: CanvasImageSource) => ({
  w: (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width || 1,
  h: (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height || 1,
});
/** Photographic object art by item id (bumpers, paper). */
export const objectArtById = (id: string) => objectArt.get(id);
function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, radius = 5) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
function charm(ctx: CanvasRenderingContext2D, theme: string, size: number) {
  const image = art.get(theme);
  if (image) ctx.drawImage(image, -size / 2, -size / 2, size, size);
  else { plate(ctx, -size / 2, -size / 2, size, size, "#ecd397", 8); ctx.fillStyle = "#587b7b"; ctx.font = `bold ${size * .55}px system-ui`; ctx.textAlign = "center"; ctx.fillText("★", 0, size * .2); }
}
/** A specific souvenir by id (guide cards). */
export const destinationArtById = (id: string) => destinationArt.get(id);
/** Souvenir magnet for a static N/S plate, picked by position so it never changes frame to frame. */
export function destinationArtFor(x: number, y: number, repel: boolean): CanvasImageSource | undefined {
  return destinationArt.get(polarityDestination(`${Math.round(x)}:${Math.round(y)}`, repel));
}
/** Draw a souvenir magnet fitted inside a rectangle, whole cutout visible. The fit
 *  used to run 8% oversize, which quietly shaved the edge off every wide souvenir. */
export function drawDestination(ctx: CanvasRenderingContext2D, image: CanvasImageSource, x: number, y: number, w: number, h: number): boolean {
  const iw = (image as HTMLImageElement).naturalWidth || (image as HTMLCanvasElement).width || 1;
  const ih = (image as HTMLImageElement).naturalHeight || (image as HTMLCanvasElement).height || 1;
  const s = Math.min(w / iw, h / ih), dw = iw * s, dh = ih * s;
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.clip();
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.restore();
  return true;
}
/**
 * The field around a switching magnet: the toy's own outline, repeated outward.
 *
 * It used to be ellipses around a tinted box, which read as two rectangles bolted to the
 * door rather than as something the toy is doing. Now each ring is the shape of the toy -
 * a circle around the compass, a capsule around the crayon and the candy pole - growing
 * slowly outward while red pushes and inward while blue pulls. The colour is the whole
 * message, so there is nothing else to paint over the art.
 */
function polarityField(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, repel: boolean, time: number) {
  ctx.save(); ctx.strokeStyle = repel ? "#e53f43" : "#1596df"; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const p = (time * .42 + i / 3) % 1, grow = repel ? p : 1 - p;
    const k = 1.06 + grow * 0.62;
    const rw = w * k, rh = h * k;
    ctx.globalAlpha = .5 * (1 - p) * (1 - p);
    ctx.beginPath(); ctx.roundRect(cx - rw / 2, cy - rh / 2, rw, rh, Math.min(rw, rh) / 2); ctx.stroke();
  }
  ctx.restore();
}
/** Bright grips use the actual collision geometry, independent of the decorative sprite. */
export function drawGadget(ctx: CanvasRenderingContext2D, g: Gadget, time: number) {
  const p = gadgetPose(g, time), z = gadgetZone(g, time), theme = g.itemId.split("-")[1];
  const index = THEMES.indexOf(theme as typeof THEMES[number]);
  ctx.save(); ctx.lineCap = "round";
  // by item id, not by theme: a gadget may be any one of the photographed variants
  const assembly = g.kind === "swing" || g.kind === "clip" ? objectArt.get(g.itemId) : undefined;
  const pivot = GADGET_PIVOTS[g.itemId] ?? [KEYCHAIN_PIVOT.x, KEYCHAIN_PIVOT.y];
  const hardware = objectArt.get("swing-snack"), charmImg = art.get(theme);
  // v18: a toy on a keyring. It has no assembly photo of its own, so it rides the lemon's
  // hook and chain, meeting them at the hook point measured on that toy.
  const toyN = /^swing-toy-(\d+)$/.exec(g.itemId)?.[1];
  const toyImg = toyN === undefined ? undefined : objectArt.get(`bumper-${toyN}`);
  const charm2 = toyImg ?? charmImg;
  if (!assembly && g.kind === "swing" && hardware && charm2) {
    // keyring charms without their own photo hang from the lemon keychain's hook and chain (cropped at draw time)
    const { w, h } = imageSize(hardware), pivotY = KEYCHAIN.y, chainEnd = KEYCHAIN.chainEnd;
    const chain = 44, s = chain / ((chainEnd - pivotY) * h);
    const lean = Math.atan2(p.hold.x - g.x, p.hold.y - (g.y - 62));
    ctx.save(); ctx.shadowColor = "#26303966"; ctx.shadowBlur = 5; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5;
    ctx.drawImage(hardware, 0, 0, w, pivotY * h, g.x - KEYCHAIN_PIVOT.x * w * s, g.y - 62 - pivotY * h * s, w * s, pivotY * h * s);
    ctx.translate(g.x, g.y - 62); ctx.rotate(-lean);
    ctx.drawImage(hardware, 0, pivotY * h, w, (chainEnd - pivotY) * h, -KEYCHAIN_PIVOT.x * w * s, 0, w * s, chain);
    if (toyImg) {
      const t = imageSize(toyImg), f = Math.min(68 / t.w, 68 / t.h), dw = t.w * f, dh = t.h * f;
      const [hu, hv] = toyHook(`bumper-${toyN}`);
      const tx = -hu * dw, ty = chain - 2 - hv * dh;
      ctx.drawImage(toyImg, tx, ty, dw, dh);
      // a POP! toy on a keyring keeps its own bubbles: they push in where a climber goes through
      if (g.pops != null) { const sh = ctx.shadowColor; ctx.shadowColor = "transparent"; drawPops(ctx, tx, ty, dw, dh, g.pops); ctx.shadowColor = sh; }
    } else ctx.drawImage(charm2, -31, chain - 4, 62, 62);
    ctx.restore();
  } else if (assembly && g.kind === "swing") {
    // the keychain photo carries its own hook and chain: swing the whole thing about the hook.
    // The steel hold goes BEHIND it, as the mount the chain hangs in front of (it is still the only grip).
    const { w, h } = imageSize(assembly), s = 95 / ((1 - pivot[1]) * h);
    // aim the chain through the steel bar (the real hold), not the raw pendulum angle
    const lean = Math.atan2(p.hold.x - g.x, p.hold.y - (g.y - 62));
    const px = pivot[0] * w, py = pivot[1] * h;
    ctx.save(); ctx.shadowColor = "#26303966"; ctx.shadowBlur = 5; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5;
    // the round hook magnet stays put on the door; only the chain and lemon swing about its ring
    ctx.drawImage(assembly, 0, 0, w, py, g.x - px * s, g.y - 62 - py * s, w * s, py * s);
    ctx.translate(g.x, g.y - 62); ctx.rotate(-lean);
    ctx.drawImage(assembly, 0, py, w, h - py, -px * s, 0, w * s, (h - py) * s); ctx.restore();
  } else if ((g.kind === "swing" && !(hardware && charm2)) || (g.kind === "clip" && !assembly)) {
    // A photographed clip carries its own steel: no drawn rod and pin over it.
    ctx.strokeStyle = "#46565c"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(g.x, g.y - 62); ctx.lineTo(p.hold.x, p.hold.y); ctx.stroke();
    ctx.strokeStyle = "#e9f5f5"; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = "#86989e"; ctx.beginPath(); ctx.arc(g.x, g.y - 62, 5, 0, Math.PI * 2); ctx.fill();
  }
  // photo assemblies carry their own hook, chain or clip: that IS the hold, so no plate or drawn hardware over it
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
  ctx.shadowColor = "#26303966"; ctx.shadowBlur = 5; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5;
  const rotorImg = g.kind === "rotor" ? objectArt.get(g.itemId) : undefined;
  if (rotorImg) {
    // spindle-centred by the install script, so the draw offset IS the pivot
    const { w, h } = imageSize(rotorImg), s = 76 / Math.max(w, h);
    ctx.drawImage(rotorImg, -pivot[0] * w * s, -pivot[1] * h * s, w * s, h * s);
  } else if (g.kind === "rotor") {
    plate(ctx, -29, -29, 58, 58, ["#db6454", "#49aeb3", "#c695dd"][index] ?? "#49aeb3", 15);
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#ffffff66"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-25, -25, 50, 50, 12); ctx.stroke();
    ctx.font = "900 42px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#754e4944"; ctx.fillText("ABC"[index] ?? "A", 2, 17);
    ctx.fillStyle = "#fff1c9"; ctx.fillText("ABC"[index] ?? "A", 0, 14);
  } else if (assembly && g.kind === "clip") {
    // clipped paper photo hangs from the grip: its clip ring sits on the steel bar
    const { w, h } = imageSize(assembly);
    // fit by AREA, not by bounding box: 78/h made the tall thin receipt read as a stamp
    // beside the postcard, at barely half its area. Caps keep it inside the slot.
    const s = Math.min(Math.sqrt(11000 / (w * h)), 120 / w, 176 / h);
    // hooked near one end, the clip tips: rotate the sheet about the clip itself, which is
    // where the pivot lands, so the paper swings under it rather than sliding sideways
    const tip = g.lean ?? 0;
    if (tip) { ctx.translate(0, -27); ctx.rotate(tip); ctx.translate(0, 27); }
    ctx.drawImage(assembly, -pivot[0] * w * s, -27 - pivot[1] * h * s, w * s, h * s);
  } else if (g.kind !== "polarity" && !assembly && !(g.kind === "swing" && hardware && charm2)) {
    if (g.kind === "clip") plate(ctx, -29, -27, 58, 62, "#fff3d7", 2);
    charm(ctx, theme, g.kind === "clip" ? 58 : 62);
  }
  ctx.restore();
  if (g.kind === "polarity") {
    // the switching magnets are the tactile toys: compass (travel), crayon (doodle), candy pole (snack)
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    const compass = objectArt.get("compass-base"), needle = objectArt.get("compass-needle");
    const object = theme === "travel" ? compass : objectArt.get(theme === "snack" ? "candy-pole" : "crayon");
    // the toy's drawn box: a round compass, a long crayon, a longer candy pole
    const [fw, fh] = theme === "travel" ? [88, 88] : theme === "snack" ? [86, 42] : [88, 48];
    if (object) {
      polarityField(ctx, cx, cy, fw, fh, p.active, time);
      // every switching toy turns a half turn when the pole flips: eased over .45 s from the moment of the switch
      const since = 3 - p.remaining, k = Math.min(1, since / .45), ease = k * k * (3 - 2 * k);
      const facing = (p.active ? Math.PI : 0) - Math.PI * (1 - ease);
      ctx.save(); ctx.translate(cx, cy);
      ctx.shadowColor = "#22303966"; ctx.shadowBlur = 6; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 4;
      if (theme === "travel") {
        ctx.drawImage(object, -44, -44, 88, 88);
        if (needle) {
          // the needle swings to the live pole and spins as the switch nears
          ctx.shadowColor = "transparent";
          const spin = p.remaining < .65 ? time * 18 : 0;
          ctx.save(); ctx.translate(0, 3.7); ctx.rotate(facing + spin);
          ctx.drawImage(needle, -5.5, -29, 11, 66); ctx.restore();
        }
      } else if (theme === "snack") { ctx.rotate(-Math.PI / 2 + facing); ctx.drawImage(object, -43, -17, 86, 34); }
      else { ctx.rotate(facing); ctx.drawImage(object, -44, -22, 88, 44); }
      ctx.restore();
    } else drawFieldMagnet(ctx, z, p.active);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#fff"; ctx.textAlign = "center";
    const urgent = p.remaining < .65 && Math.sin(time * 25) > 0;
    // the countdown sits under the toy rather than across it, now the toys are drawn full size
    const barY = Math.round(cy + (object ? fh / 2 : 32) + 7), barX = Math.round(cx - 27);
    plate(ctx, barX, barY, 54, 8, "#1c334a88", 3);
    plate(ctx, barX, barY, Math.max(1, 54 * p.remaining / 3), 8, urgent ? "#fff" : "#ffe19a", 3);
    ctx.font = "bold 11px system-ui";
    ctx.fillText(p.active ? "−" : "+", barX - 8, barY + 8);
    ctx.fillText(`${Math.ceil(p.remaining)}`, barX + 62, barY + 8);
  } else if (!assembly && !rotorImg && !(g.kind === "swing" && hardware && charm2)) {
    // a photographed rotor is a magnet - a clock, a dial, a letter - so it carries no drawn
    // clip. The metal object IS the hold; only the drawn letter board still needs hardware.
    plate(ctx, z.x + 2, z.y + 3, z.w, z.h, "#21323a55", 3);
    drawHardwareGrip(ctx, z, g.kind === "clip" ? 1 : g.kind === "rotor" ? 2 : index === 2 ? 3 : 0);
  }
  ctx.restore();
}
