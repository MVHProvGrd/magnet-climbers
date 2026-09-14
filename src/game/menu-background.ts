import { drawClimber } from "./climber-render";
import { CLIMBER_COLORS, W } from "./config";
import { CREATURES, appearanceFor } from "./creatures";
import type { Climber } from "./types";
import { resetRagdoll } from "./ragdoll";

const scene = new Image();
scene.src = `${import.meta.env.BASE_URL}art/title-fridge.webp`;
// Title toys always fall: decorative, slow, and the owner wants them moving even under OS "reduce motion".

/** Decorative falling toys over the user's kitchen artwork; never touches run state. */
/** The photo pre-scaled and tinted once per canvas size; per frame it is a 1:1 blit instead of a resample. */
let plate: { key: string; canvas: HTMLCanvasElement; x: number; y: number } | null = null;
function scenePlate(width: number, height: number, dpr: number) {
  const key = `${width}x${height}@${dpr}`;
  if (plate?.key === key) return plate;
  const scale = Math.max(width / scene.naturalWidth, height / scene.naturalHeight) * 1.06;
  const w = Math.ceil(scene.naturalWidth * scale), h = Math.ceil(scene.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * dpr); canvas.height = Math.ceil(h * dpr);
  const g = canvas.getContext("2d")!; g.scale(dpr, dpr);
  g.drawImage(scene, 0, 0, w, h);
  g.fillStyle = "rgba(12,20,32,0.36)"; g.fillRect(0, 0, w, h);
  plate = { key, canvas, x: (width - w) / 2, y: (height - h) / 2 };
  return plate;
}

export function renderMenuBackground(ctx: CanvasRenderingContext2D, height: number, dpr: number, seconds: number, width = W) {
  const time = seconds;
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (scene.complete && scene.naturalWidth > 0) {
    const p = scenePlate(width, height, dpr);
    const drift = Math.sin(time * 0.12) * height * 0.018;
    ctx.drawImage(p.canvas, 0, 0, p.canvas.width, p.canvas.height, p.x, p.y + drift, p.canvas.width / dpr, p.canvas.height / dpr);
  } else {
    ctx.fillStyle = "#252e38"; ctx.fillRect(0, 0, width, height);
  }
  // more toys on wider windows, spread across the full width
  // toys are drawn at game scale (about 60 px tall); blow them up on big windows so they read as toys, not confetti
  const scale = Math.max(1.6, Math.min(2.6, width / 420));
  const count = Math.max(6, Math.min(14, Math.round(width / (60 * scale) + 4)));
  for (let i = 0; i < count; i++) {
    const cycle = height + 160 * scale;
    const y = ((time * (18 + (i % 7) * 3) + i * cycle / count) % cycle) - 80 * scale;
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
    ctx.globalAlpha = 1;
    const look = appearanceFor(c);
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.translate(-x, -y);
    // no drop shadow here: its blur pass is the single most expensive thing on a full-window canvas
    drawClimber(ctx, c, false, time, look);
    ctx.restore();
  }
  ctx.restore();
  return scene.complete;
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
