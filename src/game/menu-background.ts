import { drawClimber, drawClimberShadow } from "./climber-render";
import { CLIMBER_COLORS, W } from "./config";
import { CREATURES, appearanceFor } from "./creatures";
import type { Climber } from "./types";
import { resetRagdoll } from "./ragdoll";

const scene = new Image();
scene.src = `${import.meta.env.BASE_URL}art/title-fridge.webp`;
// Title toys always fall: decorative, slow, and the owner wants them moving even under OS "reduce motion".

/** Decorative falling toys over the user's kitchen artwork; never touches run state. */
export function renderMenuBackground(ctx: CanvasRenderingContext2D, height: number, dpr: number, seconds: number, width = W) {
  const time = seconds;
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#252e38"; ctx.fillRect(0, 0, width, height);
  if (scene.complete && scene.naturalWidth > 0) {
    const scale = Math.max(width / scene.naturalWidth, height / scene.naturalHeight) * 1.06;
    const imgW = scene.naturalWidth * scale, imageHeight = scene.naturalHeight * scale;
    const drift = Math.sin(time * 0.12) * height * 0.018;
    ctx.drawImage(scene, (width - imgW) / 2, (height - imageHeight) / 2 + drift, imgW, imageHeight);
  }
  ctx.fillStyle = "rgba(12,20,32,0.36)"; ctx.fillRect(0, 0, width, height);
  // more toys on wider windows, spread across the full width
  const count = Math.max(7, Math.min(16, Math.round(width / 60)));
  for (let i = 0; i < count; i++) {
    const cycle = height + 160;
    const y = ((time * (18 + (i % 7) * 3) + i * cycle / count) % cycle) - 80;
    const x = 28 + ((i * 97) % Math.max(1, width - 56)) + Math.sin(time * 0.45 + i) * 15;
    const c: Climber = {
      id: i, x, y, vx: 0, vy: 20, angle: time * (i % 2 ? -0.35 : 0.28) + i,
      spin: 0, state: "flying", color: CLIMBER_COLORS[i % CLIMBER_COLORS.length], parent: null,
      leftLauncher: true, launcherId: null, airTime: 0.5, squash: 0, hp: 3, iframes: 0,
      creature: CREATURES[i % CREATURES.length].id,
    };
    resetRagdoll(c);
    for (const [limb, joint] of c.ragdoll!.limbs.entries()) {
      joint.angle += Math.sin(time * 1.8 + i + limb * 1.7) * 0.55;
      joint.bend += Math.sin(time * 2.1 + i * 2 + limb) * 0.7;
    }
    ctx.globalAlpha = 0.8;
    const look = appearanceFor(c);
    drawClimberShadow(ctx, c, time, look); drawClimber(ctx, c, false, time, look);
  }
  ctx.restore();
}

/** Static blurred kitchen behind the game column, for windows wider than 9:16 (tablets, desktops). */
export function renderRunBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number): boolean {
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#0e1014"; ctx.fillRect(0, 0, width, height);
  const ready = scene.complete && scene.naturalWidth > 0;
  if (ready) {
    const scale = Math.max(width / scene.naturalWidth, height / scene.naturalHeight) * 1.12;
    const w = scene.naturalWidth * scale, h = scene.naturalHeight * scale;
    ctx.filter = "blur(12px)";
    ctx.drawImage(scene, (width - w) / 2, (height - h) / 2, w, h);
    ctx.filter = "none";
    ctx.fillStyle = "rgba(8,12,18,0.62)"; ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
  return ready;
}
