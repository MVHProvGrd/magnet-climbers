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
    const compass = objectArt.get("compass-base"), needle = objectArt.get("compass-needle");
    if (compass) {
      ctx.drawImage(compass, -31, -31, 62, 62);
      if (needle) {
        ctx.save(); ctx.translate(0, 2.6); ctx.rotate(time * .95);
        ctx.drawImage(needle, -3.85, -20.4, 7.75, 46.45); ctx.restore();
      }
    } else {
      plate(ctx, -29, -29, 58, 58, ["#db6454", "#49aeb3", "#c695dd"][index] ?? "#49aeb3", 15);
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "#ffffff66"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-25, -25, 50, 50, 12); ctx.stroke();
      ctx.font = "900 42px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#754e4944"; ctx.fillText("ABC"[index] ?? "A", 2, 17);
      ctx.fillStyle = "#fff1c9"; ctx.fillText("ABC"[index] ?? "A", 0, 14);
    }
  } else if (g.kind !== "polarity") {
    const object = objectArt.get(g.kind === "clip" ? "candy-pole" : "crayon");
    if (object) {
      const horizontal = g.kind === "clip";
      ctx.drawImage(object, horizontal ? -30 : -31, horizontal ? -12 : -16, horizontal ? 60 : 62, horizontal ? 24 : 32);
    } else {
      if (g.kind === "clip") plate(ctx, -29, -27, 58, 62, "#fff3d7", 2);
      charm(ctx, theme, g.kind === "clip" ? 58 : 62);
    }
  }
  ctx.restore();
  if (g.kind === "polarity") {
    const destination = destinationArt.get(polarityDestination(g.id, p.active));
    if (destination) {
      ctx.save(); ctx.beginPath(); ctx.roundRect(z.x, z.y, z.w, z.h, 8); ctx.clip();
      ctx.shadowColor = "#22303966"; ctx.shadowBlur = 6; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 4;
      ctx.drawImage(destination, z.x, z.y, z.w, z.h); ctx.restore();
      polarityField(ctx, z, p.active, time);
    } else drawFieldMagnet(ctx, z, p.active);
    ctx.shadowColor = "#22303955"; ctx.shadowBlur = 6; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5;
    ctx.shadowColor = "transparent";
    const shine = ctx.createLinearGradient(z.x, z.y, z.x + z.w, z.y + z.h);
    shine.addColorStop(0, "#ffffff66"); shine.addColorStop(.4, "#ffffff00"); shine.addColorStop(1, "#172f4d55");
    ctx.fillStyle = shine; ctx.fillRect(z.x, z.y, z.w, z.h);
    // Small enamel pins keep legacy fallback versions distinct.
    if (!destination) { ctx.save(); ctx.translate(z.x + 9, z.y + 9); charm(ctx, theme, 12); ctx.restore(); }
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
