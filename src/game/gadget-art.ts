import type { Gadget } from "./types";
import { gadgetPose, gadgetZone, THEMES, POLARITY_DESTINATIONS, polarityDestination } from "./gadgets";
import { drawFieldMagnet, drawHardwareGrip } from "./fridge-art";

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
]);
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
/** Draw a souvenir magnet fitted inside a rectangle (whole cutout visible, slightly oversize). False while the art is still loading. */
export function drawDestination(ctx: CanvasRenderingContext2D, image: CanvasImageSource, x: number, y: number, w: number, h: number): boolean {
  const iw = (image as HTMLImageElement).naturalWidth || (image as HTMLCanvasElement).width || 1;
  const ih = (image as HTMLImageElement).naturalHeight || (image as HTMLCanvasElement).height || 1;
  const s = Math.min(w / iw, h / ih) * 1.08, dw = iw * s, dh = ih * s;
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.clip();
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.restore();
  return true;
}
function polarityField(ctx: CanvasRenderingContext2D, z: { x: number; y: number; w: number; h: number }, repel: boolean, time: number) {
  const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
  ctx.save(); ctx.strokeStyle = repel ? "#e53f43" : "#1596df"; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const p = (time * .7 + i / 3) % 1, q = repel ? p : 1 - p;
    ctx.globalAlpha = .55 * (1 - p); ctx.beginPath();
    ctx.ellipse(cx, cy, z.w * .58 + z.w * .38 * q, z.h * .58 + z.h * .32 * q, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
/** Bright grips use the actual collision geometry, independent of the decorative sprite. */
export function drawGadget(ctx: CanvasRenderingContext2D, g: Gadget, time: number) {
  const p = gadgetPose(g, time), z = gadgetZone(g, time), theme = g.itemId.split("-")[1];
  const index = THEMES.indexOf(theme as typeof THEMES[number]);
  ctx.save(); ctx.lineCap = "round";
  if (g.kind === "swing" || g.kind === "clip") {
    ctx.strokeStyle = "#46565c"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(g.x, g.y - 62); ctx.lineTo(p.hold.x, p.hold.y); ctx.stroke();
    ctx.strokeStyle = "#e9f5f5"; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = "#86989e"; ctx.beginPath(); ctx.arc(g.x, g.y - 62, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
  ctx.shadowColor = "#26303966"; ctx.shadowBlur = 5; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5;
  if (g.kind === "rotor") {
    plate(ctx, -29, -29, 58, 58, ["#db6454", "#49aeb3", "#c695dd"][index] ?? "#49aeb3", 15);
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#ffffff66"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-25, -25, 50, 50, 12); ctx.stroke();
    ctx.font = "900 42px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#754e4944"; ctx.fillText("ABC"[index] ?? "A", 2, 17);
    ctx.fillStyle = "#fff1c9"; ctx.fillText("ABC"[index] ?? "A", 0, 14);
  } else if (g.kind !== "polarity") {
    if (g.kind === "clip") plate(ctx, -29, -27, 58, 62, "#fff3d7", 2);
    charm(ctx, theme, g.kind === "clip" ? 58 : 62);
  }
  ctx.restore();
  if (g.kind === "polarity") {
    // the switching magnets are the tactile toys: compass (travel), crayon (doodle), candy pole (snack)
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    const compass = objectArt.get("compass-base"), needle = objectArt.get("compass-needle");
    const object = theme === "travel" ? compass : objectArt.get(theme === "snack" ? "candy-pole" : "crayon");
    if (object) {
      polarityField(ctx, z, p.active, time);
      ctx.save(); ctx.translate(cx, cy);
      ctx.shadowColor = "#22303966"; ctx.shadowBlur = 6; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 4;
      if (theme === "travel") {
        ctx.drawImage(object, -31, -31, 62, 62);
        if (needle) {
          // the needle swings to the live pole and spins as the switch nears
          ctx.shadowColor = "transparent";
          const spin = p.remaining < .65 ? time * 18 : 0;
          ctx.save(); ctx.translate(0, 2.6); ctx.rotate((p.active ? Math.PI : 0) + spin);
          ctx.drawImage(needle, -3.85, -20.4, 7.75, 46.45); ctx.restore();
        }
      } else if (theme === "snack") { ctx.rotate(-Math.PI / 2); ctx.drawImage(object, -30, -12, 60, 24); }
      else ctx.drawImage(object, -31, -16, 62, 32);
      ctx.restore();
      // pole tint: a red or blue wash over the toy says which way it is pushing
      ctx.save(); ctx.globalAlpha = .28; ctx.fillStyle = p.active ? "#e53f43" : "#1596df";
      ctx.beginPath(); ctx.roundRect(z.x, z.y, z.w, z.h, 10); ctx.fill(); ctx.restore();
    } else drawFieldMagnet(ctx, z, p.active);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "900 9px system-ui";
    const urgent = p.remaining < .65 && Math.sin(time * 25) > 0;
    plate(ctx, z.x + 5, z.y + 51, 54, 8, "#1c334a88", 3);
    plate(ctx, z.x + 5, z.y + 51, Math.max(1, 54 * p.remaining / 3), 8, urgent ? "#fff" : "#ffe19a", 3);
    ctx.font = "bold 11px system-ui"; ctx.fillText(p.active ? "−" : "+", z.x + 8, p.y + 4); ctx.fillText(`${Math.ceil(p.remaining)}`, z.x + 55, p.y + 4);
  } else {
    plate(ctx, z.x + 2, z.y + 3, z.w, z.h, "#21323a55", 3);
    drawHardwareGrip(ctx, z, g.kind === "clip" ? 1 : g.kind === "rotor" ? 2 : index === 2 ? 3 : 0);
  }
  ctx.restore();
}
