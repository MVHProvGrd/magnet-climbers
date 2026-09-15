/**
 * Image pickups (public/art/pickups/<kind>.png, 256 px, generated per art/ASSET_SPEC.md).
 * Until an image loads (or when Image is unavailable, e.g. tests) callers fall back to the canvas art.
 */
import type { PowerKind } from "./types";

const KINDS: PowerKind[] = ["coin", "gem", "heart", "magnet", "extra", "slowmo", "reach", "candy"];
const images = new Map<PowerKind, HTMLImageElement>();
const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

export const pickupArtReady: Promise<void> = typeof Image === "undefined" ? Promise.resolve() : Promise.all(KINDS.map((kind) => new Promise<void>((resolve) => {
  const img = new Image();
  img.onload = () => { images.set(kind, img); resolve(); };
  img.onerror = () => resolve();
  img.src = `${base}art/real-v1/pickups/${kind}.png`;
}))).then(() => undefined);

/** The loaded pickup photo, if any (guide zoom). */
export const pickupImage = (kind: PowerKind) => images.get(kind);
export function setPickupArt(kind: PowerKind, image: HTMLImageElement) { images.set(kind, image); }

/** Drawn centred on the origin at the game's pickup size (about 32 px). Returns false when no image is ready. */
export function drawPickupImage(ctx: CanvasRenderingContext2D, kind: PowerKind, size = 46): boolean {
  const img = images.get(kind);
  if (!img) return false;
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  return true;
}
