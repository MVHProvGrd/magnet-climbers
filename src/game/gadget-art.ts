import type { Gadget } from "./types";
import { gadgetPose, gadgetZone, THEMES } from "./gadgets";

const art = new Map<string, CanvasImageSource>();
export function setGadgetArt(theme: string, image: CanvasImageSource) { art.set(theme, image); }
export const gadgetArtReady = typeof Image === "undefined" ? Promise.resolve() : Promise.all(THEMES.map((theme) => new Promise<void>((resolve) => {
  const image = new Image();
  image.onload = () => { setGadgetArt(theme, image); resolve(); };
  image.onerror = () => resolve();
  image.src = `${import.meta.env.BASE_URL ?? "/"}art/gadgets/${theme}.png`;
})));
function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, radius = 5) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
function charm(ctx: CanvasRenderingContext2D, theme: string, size: number) {
  const image = art.get(theme);
  if (image) ctx.drawImage(image, -size / 2, -size / 2, size, size);
  else { plate(ctx, -size / 2, -size / 2, size, size, "#ecd397", 8); ctx.fillStyle = "#587b7b"; ctx.font = `bold ${size * .55}px system-ui`; ctx.textAlign = "center"; ctx.fillText("★", 0, size * .2); }
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
    ctx.shadowColor = "#22303955"; ctx.shadowBlur = 6; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5;
    plate(ctx, z.x, z.y, z.w, z.h, p.active ? "#d84e5e" : "#459cb9", 7);
    ctx.shadowColor = "transparent";
    const shine = ctx.createLinearGradient(z.x, z.y, z.x + z.w, z.y + z.h);
    shine.addColorStop(0, "#ffffff66"); shine.addColorStop(.4, "#ffffff00"); shine.addColorStop(1, "#172f4d55");
    ctx.fillStyle = shine; ctx.fill();
    ctx.save(); ctx.translate(p.x, p.y - 1); charm(ctx, theme, 34); ctx.restore();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "900 9px system-ui";
    ctx.fillText(p.active ? "REPEL" : "GRIP", p.x, z.y + 11);
    const urgent = p.remaining < .65 && Math.sin(time * 25) > 0;
    plate(ctx, z.x + 5, z.y + 51, 54, 8, "#1c334a88", 3);
    plate(ctx, z.x + 5, z.y + 51, Math.max(1, 54 * p.remaining / 3), 8, urgent ? "#fff" : "#ffe19a", 3);
    ctx.font = "bold 11px system-ui"; ctx.fillText(p.active ? "−" : "+", z.x + 8, p.y + 4); ctx.fillText(`${Math.ceil(p.remaining)}`, z.x + 55, p.y + 4);
  } else {
    const steel = ctx.createLinearGradient(0, z.y, 0, z.y + z.h);
    steel.addColorStop(0, "#f1fcff"); steel.addColorStop(.3, "#a8bbc0"); steel.addColorStop(.5, "#f5ffff"); steel.addColorStop(1, "#657e89");
    plate(ctx, z.x + 2, z.y + 3, z.w, z.h, "#21323a55", 3);
    ctx.fillStyle = steel; ctx.beginPath(); ctx.roundRect(z.x, z.y, z.w, z.h, 3); ctx.fill();
    ctx.strokeStyle = "#4a626d"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#3f6572"; ctx.font = "bold 8px system-ui"; ctx.textAlign = "center"; ctx.fillText("GRIP", p.hold.x, z.y + 10);
  }
  ctx.restore();
}
