import type { Vec } from "./types";
import { objectArtById } from "./gadget-art";

/** The cat's paw: comes down from the top of the screen at a random x, taps three times, retreats. */
export interface CatPaw { x: number; t: number; hit: Set<number>; marked?: number }
export const PAW_DURATION = 1.65;
/** when each tap first touches the door */
export const PAW_TAPS = [0.48, 0.87, 1.25];
/** the four claw tips relative to the pose centre (Codex's study, same 0.24 scale as the game) */
export const CLAW_TIPS: readonly [number, number][] = [[-36, 35], [-8, 55], [21, 54], [48, 31]];
/** A claw mark on the door: world coordinates, fades over SCRATCH_LIFE seconds. */
export interface Scratch { x: number; y: number; born: number }
export const SCRATCH_LIFE = 1.6;
export function drawScratches(ctx: CanvasRenderingContext2D, marks: readonly Scratch[], now: number) {
  for (const m of marks) {
    const age = now - m.born; if (age < 0 || age > SCRATCH_LIFE) continue;
    const grow = Math.min(1, age / 0.1), fade = Math.pow(1 - age / SCRATCH_LIFE, 1.5);
    ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = "round";
    ctx.strokeStyle = "#49565d"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.quadraticCurveTo(m.x - 1, m.y + 9 * grow, m.x - 3, m.y + 20 * grow); ctx.stroke();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(m.x + 0.8, m.y); ctx.quadraticCurveTo(m.x - 0.2, m.y + 9 * grow, m.x - 2.2, m.y + 20 * grow); ctx.stroke();
    ctx.restore();
  }
}
/** Codex's motion study timings; depths are fractions of the deepest tap, which reaches the climber band (about 60% of the view). */
const KEYS: [number, number][] = [[0, -70], [0.3, -25], [0.48, 205 / 242], [0.57, 205 / 242], [0.72, 125 / 242], [0.87, 1], [0.95, 1], [1.10, 145 / 242], [1.25, 219 / 242], [1.31, 219 / 242], [1.65, -70]];
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Pad centre in world coordinates (the paw hangs from the camera's top edge) and whether it is touching the door. */
export function pawPose(p: CatPaw, camY: number, viewH: number): Vec & { contact: boolean; warn: number } {
  const t = Math.min(p.t, PAW_DURATION);
  const reach = viewH * 0.55 + 30; // the selected climber sits at 55% of the view; the deepest tap lands on it
  const depth = (k: number) => (k < 0 ? k : k * reach);
  let y = -70;
  for (let i = 1; i < KEYS.length; i++) if (t <= KEYS[i][0]) {
    const [a, ya] = KEYS[i - 1], [b, yb] = KEYS[i];
    y = depth(ya) + (depth(yb) - depth(ya)) * smooth((t - a) / (b - a)); break;
  }
  const contact = (t >= 0.48 && t <= 0.57) || (t >= 0.87 && t <= 0.95) || (t >= 1.25 && t <= 1.31);
  return { x: p.x + Math.sin(t * 4) * 7, y: camY + y, contact, warn: t < 0.3 ? t / 0.3 : 0 };
}
/** Photo cutout (pack 15) at the study's scale; the offscreen foreleg is decorative. */
export function drawCatPaw(ctx: CanvasRenderingContext2D, p: CatPaw, camY: number, viewH: number) {
  const pose = pawPose(p, camY, viewH), art = objectArtById("cat-paw");
  if (pose.warn > 0) {
    ctx.save(); ctx.strokeStyle = "#ffc663"; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(pose.x, camY + 32, 12 + 10 * pose.warn, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  if (art) {
    const iw = (art as HTMLImageElement).naturalWidth || 1, ih = (art as HTMLImageElement).naturalHeight || 1;
    const s = 246 / iw; // about 120 px of paw, like the study
    ctx.save(); ctx.shadowColor = "rgba(30,28,35,0.30)"; ctx.shadowBlur = 12; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 12;
    ctx.drawImage(art, pose.x - iw * (510 / 1024) * s, pose.y - ih * (1080 / 1536) * s, iw * s, ih * s); ctx.restore();
  } else {
    ctx.save(); ctx.fillStyle = "#e8a25c"; ctx.beginPath(); ctx.ellipse(pose.x, pose.y, 46, 36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(pose.x - 30, camY - 400, 60, pose.y - camY + 400); ctx.restore();
  }
}
