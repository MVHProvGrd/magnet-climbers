import { drawClimber, drawClimberShadow } from "./climber-render";
import { CLIMBER_COLORS, W } from "./config";
import type { Climber } from "./types";

const scene = new Image();
scene.src = `${import.meta.env.BASE_URL}art/title-fridge.png`;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/** Decorative falling toys over the user's kitchen artwork; never touches run state. */
export function renderMenuBackground(ctx: CanvasRenderingContext2D, height: number, dpr: number, seconds: number) {
  const time = reducedMotion.matches ? 0 : seconds;
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#252e38"; ctx.fillRect(0, 0, W, height);
  if (scene.complete && scene.naturalWidth > 0) {
    const scale = Math.max(W / scene.naturalWidth, height / scene.naturalHeight) * 1.06;
    const width = scene.naturalWidth * scale, imageHeight = scene.naturalHeight * scale;
    const drift = Math.sin(time * 0.12) * height * 0.018;
    ctx.drawImage(scene, (W - width) / 2, (height - imageHeight) / 2 + drift, width, imageHeight);
  }
  ctx.fillStyle = "rgba(12,20,32,0.36)"; ctx.fillRect(0, 0, W, height);
  for (let i = 0; i < 7; i++) {
    const cycle = height + 160;
    const y = ((time * (18 + i * 3) + i * cycle / 7) % cycle) - 80;
    const x = 28 + ((i * 97) % 344) + Math.sin(time * 0.45 + i) * 15;
    const c: Climber = {
      id: i, x, y, vx: 0, vy: 20, angle: time * (i % 2 ? -0.35 : 0.28) + i,
      spin: 0, state: "flying", color: CLIMBER_COLORS[i], parent: null,
      leftLauncher: true, launcherId: null, airTime: 0.5, squash: 0,
    };
    ctx.globalAlpha = 0.8;
    drawClimberShadow(ctx, c); drawClimber(ctx, c, false, time);
  }
  ctx.restore();
}
