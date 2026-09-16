import type { Vec } from "./types";
import { objectArtById } from "./gadget-art";
import { t as tr } from "./i18n";

/** The cat's paw: comes down from the top of the screen at a random x, taps three times, retreats. */
export interface CatPaw { x: number; t: number; hit: Set<number>; marked?: number }
export const PAW_DURATION = 1.65;
/**
 * Lead time before the paw starts moving, so the warning is readable.
 * The kid's hand warns for CFG.handWarn (1.1 s); the paw used to warn for 0.3 s and the
 * ring vanished 0.18 s BEFORE the first tap landed, which is why nobody saw it coming.
 */
export const PAW_WARN = 0.75;
/** leg length above the pad centre at game scale (pack 18 art): how deep a tap can go before the root would show */
const PAW_LEG = 1840 * (120 / 454);
/** when each tap first touches the door */
export const PAW_TAPS = [0.48, 0.87, 1.25];
/** Codex pack 18 long foreleg (725x2170): pad centre and claw row as fractions; the paw is drawn ~120 px wide */
const PAW = { padX: 365 / 725, padY: 1840 / 2170, width: 454 / 725 };
/** the four claw tips relative to the pad centre at game scale */
export const CLAW_TIPS: readonly [number, number][] = [[-38, 50], [-13, 64], [12, 64], [37, 50]];
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
/** How deep the deepest tap goes: onto the climber band, capped so the leg's root never shows. */
export const pawReach = (viewH: number) => Math.min(viewH * 0.55 + 30, PAW_LEG - 40);
/** Half-width of the pad's hit zone, so the warning can cover exactly what will hurt. */
export const PAW_HALF_W = 46;
/** Pad centre in world coordinates (the paw hangs from the camera's top edge) and whether it is touching the door. */
export function pawPose(p: CatPaw, camY: number, viewH: number): Vec & { contact: boolean; warn: number } {
  // p.t runs from 0; the paw holds off screen for PAW_WARN, then plays the motion study
  const t = Math.min(Math.max(0, p.t - PAW_WARN), PAW_DURATION);
  const reach = pawReach(viewH);
  const depth = (k: number) => (k < 0 ? k : k * reach);
  let y = -70;
  for (let i = 1; i < KEYS.length; i++) if (t <= KEYS[i][0]) {
    const [a, ya] = KEYS[i - 1], [b, yb] = KEYS[i];
    y = depth(ya) + (depth(yb) - depth(ya)) * smooth((t - a) / (b - a)); break;
  }
  const contact = (t >= 0.48 && t <= 0.57) || (t >= 0.87 && t <= 0.95) || (t >= 1.25 && t <= 1.31);
  // held at full strength through the approach, fading out only as the first tap arrives
  const untilStrike = PAW_WARN + PAW_TAPS[0] - p.t;
  const warn = Math.max(0, Math.min(1, untilStrike / 0.25));
  return { x: p.x + Math.sin(t * 4) * 7, y: camY + y, contact, warn };
}
/** Photo cutout (pack 15) at the study's scale; the offscreen foreleg is decorative. */
export function drawCatPaw(ctx: CanvasRenderingContext2D, p: CatPaw, camY: number, viewH: number) {
  const pose = pawPose(p, camY, viewH), art = objectArtById("cat-paw");
  if (pose.warn > 0) {
    // Same language as the hand: shade the real danger zone, not a token marker. The band is
    // the pad's hit width over the depth the taps actually reach, so what is shaded is what hurts.
    const pulse = 0.6 + Math.sin(p.t * 14) * 0.15;
    const w = PAW_HALF_W * 2, x0 = pose.x - PAW_HALF_W, depth = pawReach(viewH);
    ctx.save();
    ctx.globalAlpha = pose.warn;
    ctx.fillStyle = `rgba(255,189,90,${pulse * 0.26})`;
    ctx.fillRect(x0, camY, w, depth);
    ctx.strokeStyle = `rgba(255,236,167,${pulse})`; ctx.lineWidth = 2; ctx.setLineDash([6, 9]);
    ctx.beginPath(); ctx.moveTo(pose.x, camY); ctx.lineTo(pose.x, camY + depth); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(255,189,90,${pulse * 0.7})`; ctx.lineWidth = 2;
    ctx.strokeRect(x0, camY, w, depth);
    const ly = camY + depth + 8;
    ctx.fillStyle = "#302b30";
    ctx.beginPath(); ctx.roundRect(pose.x - 56, ly, 112, 26, 9); ctx.fill();
    ctx.fillStyle = "#ffe0a1"; ctx.font = "800 11px system-ui"; ctx.textAlign = "center";
    ctx.fillText(tr("LOOK OUT!  PAW"), pose.x, ly + 17);
    ctx.restore();
  }
  if (art) {
    const iw = (art as HTMLImageElement).naturalWidth || 1, ih = (art as HTMLImageElement).naturalHeight || 1;
    const s = 120 / (PAW.width * iw); // about 120 px of paw, like the study
    const x0 = pose.x - iw * PAW.padX * s, y0 = pose.y - ih * PAW.padY * s;
    ctx.save(); ctx.shadowColor = "rgba(30,28,35,0.30)"; ctx.shadowBlur = 12; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 12;
    ctx.drawImage(art, x0, y0, iw * s, ih * s);
    // the leg never ends on screen: repeat a plain band of foreleg fur upward past the camera's top edge
    const band0 = Math.round(ih * 0.06), band = Math.round(ih * 0.12);
    for (let y = y0, flip = false; y > camY - 40; y -= band * s, flip = !flip) {
      if (!flip) ctx.drawImage(art, 0, band0, iw, band, x0, y - band * s, iw * s, band * s);
      else { ctx.save(); ctx.translate(0, (y - band * s) + y); ctx.scale(1, -1); ctx.drawImage(art, 0, band0, iw, band, x0, y - band * s, iw * s, band * s); ctx.restore(); }
    }
    ctx.restore();
  } else {
    ctx.save(); ctx.fillStyle = "#e8a25c"; ctx.beginPath(); ctx.ellipse(pose.x, pose.y, 46, 36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(pose.x - 30, camY - 400, 60, pose.y - camY + 400); ctx.restore();
  }
}
