import type { NoStickZone } from './types';

export const OBSTACLE_IDS = ['attract', 'repel', 'glass', 'plastic', 'gap', 'vent', 'dispenser', 'calendar', 'ice-tray', 'handle'] as const;
const images = new Map<string, HTMLImageElement>();
const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
export function setObstacleArt(id: string, image: HTMLImageElement) { images.set(id, image); }
export const obstacleArtReady = typeof Image === 'undefined' ? Promise.resolve() : Promise.all(OBSTACLE_IDS.map(id => new Promise<void>(resolve => {
  const img = new Image();
  img.onload = () => { setObstacleArt(id, img); resolve(); };
  img.onerror = () => resolve();
  img.src = `${base}art/real-v1/obstacles/${id}.png`;
})).concat(['glass-door', 'glass-wide'].map(id => new Promise<void>(resolve => {
  // Codex's bottle doors (pack 07): whole single-door panels, tall and squat; never nine-sliced
  const img = new Image();
  img.onload = () => { setObstacleArt(id, img); resolve(); };
  img.onerror = () => resolve();
  img.src = `${base}art/real-v1/obstacles/${id}.webp`;
})))).then(() => undefined);

/** The door-gap photo reads as a huge dark gasket when stretched across a band, so open gaps stay hand-drawn. */
const NO_PHOTO = new Set(['gap']);

function artId(z: NoStickZone): string | undefined {
  // N/S plates are souvenir magnets now (scenery.ts); the flat photos stay as the guide's fallback
  if (z.kind === 'attract' || z.kind === 'repel') return undefined;
  if (z.hue === -1) return 'handle';
  const id = z.itemId && images.has(z.itemId) ? z.itemId : { glass: 'glass', trim: 'plastic', void: 'gap', sticker: undefined }[z.kind];
  return id && NO_PHOTO.has(id) ? undefined : id;
}

/** Whole-door bottle art for a glass zone: the tall door for portrait windows (under 0.7:1), the squat one otherwise; none for full-width bands. */
function doorArt(z: NoStickZone): HTMLImageElement | undefined {
  if (z.w > 260) return undefined;
  const id = z.w / z.h < 0.7 ? 'glass-door' : 'glass-wide';
  return images.get(id) ?? images.get('glass-door');
}
/** Fill the real collision rectangle; nine-slice preserves the molded frame thickness. */
export function drawObstacleImage(c: CanvasRenderingContext2D, z: NoStickZone): boolean {
  const id = artId(z), img = id ? images.get(id) : undefined;
  if (!img || z.w <= 0 || z.h <= 0) return false;
  c.save();
  if (id === 'ice-tray' && z.h > z.w) {
    c.translate(z.x + z.w, z.y); c.rotate(Math.PI / 2);
    c.drawImage(img, 0, 0, z.h, z.w);
  } else if (id === 'glass' && doorArt(z)) {
    // one-door window: the bottle door itself (tall or squat by aspect), cover-fit and clipped so the frame stays proportional
    const door = doorArt(z)!;
    const s = Math.max(z.w / door.width, z.h / door.height), dw = door.width * s, dh = door.height * s;
    c.beginPath(); c.roundRect(z.x, z.y, z.w, z.h, 6); c.clip();
    c.drawImage(door, z.x + (z.w - dw) / 2, z.y + (z.h - dh) / 2, dw, dh);
  } else if (['glass', 'plastic', 'gap', 'vent'].includes(id!)) {
    const sx = [0, img.width * .14, img.width * .86, img.width];
    const sy = [0, img.height * .14, img.height * .86, img.height];
    const edge = Math.min(10, z.w / 4, z.h / 4);
    const dx = [z.x, z.x + edge, z.x + z.w - edge, z.x + z.w];
    const dy = [z.y, z.y + edge, z.y + z.h - edge, z.y + z.h];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) c.drawImage(img, sx[x], sy[y], sx[x+1]-sx[x], sy[y+1]-sy[y], dx[x], dy[y], dx[x+1]-dx[x], dy[y+1]-dy[y]);
    const door = id === 'glass' ? images.get('glass-door') : undefined;
    if (door) {
      // wide band: the frosted frame is the collider; the shelf interior shows through it, cropped not stretched
      const ix = door.width * .15, iy = door.height * .08, iw = door.width * .70, ih = door.height * .84;
      const px = dx[1], py = dy[1], pw = dx[2] - dx[1], ph = dy[2] - dy[1];
      // scale the shelf to the band height and repeat it sideways: a row of small bottles, never a giant one
      const s = ph / ih, dw = iw * s, tiles = Math.ceil(pw / dw);
      c.save(); c.beginPath(); c.rect(px, py, pw, ph); c.clip();
      const x0 = px + (pw - tiles * dw) / 2;
      for (let i = 0; i < tiles; i++) c.drawImage(door, ix, iy, iw, ih, x0 + i * dw, py, dw, ph);
      c.globalAlpha = .35; c.drawImage(img, sx[1], sy[1], sx[2] - sx[1], sy[2] - sy[1], px, py, pw, ph);
      c.restore();
    }
  } else c.drawImage(img, z.x, z.y, z.w, z.h);
  c.restore(); return true;
}

/** Guide previews retain natural proportions, including the long handle. */
export function drawObstaclePreview(c: CanvasRenderingContext2D, id: string): boolean {
  const img = images.get(id === 'glass' && images.has('glass-door') ? 'glass-door' : id);
  if (!img) return false;
  const scale = Math.min(88 / img.width, 82 / img.height);
  c.drawImage(img, 50 - img.width * scale / 2, 48 - img.height * scale / 2, img.width * scale, img.height * scale);
  return true;
}
