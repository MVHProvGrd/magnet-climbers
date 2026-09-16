import type { NoStickZone } from './types';
import { DOOR_SEAM } from './world';

/** Below this a plastic zone is trim, not a bin, and the moulded surface draws instead. */
const BIN_MIN_H = 58;

/** Split a horizontal span into the parts that fall on each door, dropping the seam
 *  itself. A zone on one door comes back as one part. */
function doorSpans(x: number, w: number): [number, number][] {
  const s0 = DOOR_SEAM.x, s1 = DOOR_SEAM.x + DOOR_SEAM.w;
  const parts: [number, number][] = [];
  if (x < s0) parts.push([x, Math.min(x + w, s0) - x]);
  if (x + w > s1) { const px = Math.max(x, s1); parts.push([px, x + w - px]); }
  return parts.length ? parts.filter(([, pw]) => pw > 1) : [[x, w]];
}
export const OBSTACLE_IDS = ['attract', 'repel', 'glass', 'plastic', 'gap', 'vent', 'dispenser', 'calendar', 'ice-tray', 'handle'] as const;
const images = new Map<string, HTMLImageElement>();
const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
export function setObstacleArt(id: string, image: HTMLImageElement) { images.set(id, image); }
export const obstacleArtReady = typeof Image === 'undefined' ? Promise.resolve() : Promise.all(OBSTACLE_IDS.map(id => new Promise<void>(resolve => {
  const img = new Image();
  img.onload = () => { setObstacleArt(id, img); resolve(); };
  img.onerror = () => resolve();
  img.src = `${base}art/real-v1/obstacles/${id}.png`;
})).concat(['glass-door', 'glass-door-2', 'glass-door-3', 'glass-wide', 'glass-wide-2', 'glass-wide-3'].map(id => new Promise<void>(resolve => {
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
  if (z.kind === 'attract' || z.kind === 'repel' || z.swing) return undefined;
  if (z.hue === -1) return 'handle';
  const id = z.itemId && images.has(z.itemId) ? z.itemId : { glass: 'glass', trim: 'plastic', void: 'gap', sticker: undefined }[z.kind];
  return id && NO_PHOTO.has(id) ? undefined : id;
}

/** Whole-door bottle art for a glass zone: the tall door or the wide one, whichever is nearer the zone's shape; the wide one also stretches across full-width bands. */
function doorArt(z: NoStickZone): HTMLImageElement | undefined {
  // Three stocked windows of each shape now (pack 26). Pick by the zone's own position so a
  // door keeps the same contents every frame instead of flickering between variants.
  const variant = Math.abs(Math.round(z.x) * 73 + Math.round(z.y) * 31) % 3;
  const suffix = variant === 0 ? '' : `-${variant + 1}`;
  const tall = images.get(`glass-door${suffix}`) ?? images.get('glass-door');
  const wide = images.get(`glass-wide${suffix}`) ?? images.get('glass-wide');
  if (!tall || !wide) return tall ?? wide;
  // whichever door is nearer the window's proportions (log ratio), so a stretch stays mild
  const a = z.w / z.h;
  return Math.abs(Math.log(a / (tall.width / tall.height))) <= Math.abs(Math.log(a / (wide.width / wide.height))) ? tall : wide;
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
    const sx = z.w / door.width, sy = z.h / door.height, stretch = Math.max(sx, sy) / Math.min(sx, sy);
    c.beginPath(); c.roundRect(z.x, z.y, z.w, z.h, 6); c.clip();
    // full-width bands always show the whole door (owner's call); one-door windows crop only past a 2x stretch
    if (stretch <= 2 || z.w > 260) c.drawImage(door, z.x, z.y, z.w, z.h);
    else { const s = Math.max(sx, sy), dw = door.width * s, dh = door.height * s; c.drawImage(door, z.x + (z.w - dw) / 2, z.y + (z.h - dh) / 2, dw, dh); }
  } else if (id === 'plastic') {
    // A door of bins, drawn per door rather than across the pair: the seam is a real
    // gap between two doors, so a bin that spans it looks wrong however well it fits.
    // Each side gets a whole number of rows, sized from the bin's own proportions, so
    // no row is ever cut in half; the sideways repeat is centred, sharing any crop.
    if (z.h < BIN_MIN_H) { c.restore(); return false; }
    const a = img.width / img.height;
    c.beginPath(); c.roundRect(z.x, z.y, z.w, z.h, 4); c.clip();
    for (const [px, pw] of doorSpans(z.x, z.w)) {
      const rows = Math.max(1, Math.round(z.h / (pw / a)));
      const bh = z.h / rows, bw = bh * a;
      const cols = Math.max(1, Math.ceil(pw / bw - 0.01));
      const x0 = px + (pw - cols * bw) / 2;
      for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) {
        c.save(); c.beginPath(); c.rect(px, z.y, pw, z.h); c.clip();
        c.drawImage(img, x0 + cx * bw, z.y + ry * bh, bw, bh);
        c.restore();
      }
    }
  } else if (['glass', 'gap', 'vent'].includes(id!)) {
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

/** The loaded obstacle photo for a guide item (glass shows the bottle door). */
export const obstacleImage = (id: string) => images.get(id === 'glass' && images.has('glass-door') ? 'glass-door' : id);
/** Guide previews retain natural proportions, including the long handle. */
export function drawObstaclePreview(c: CanvasRenderingContext2D, id: string): boolean {
  const img = images.get(id === 'glass' && images.has('glass-door') ? 'glass-door' : id);
  if (!img) return false;
  const scale = Math.min(88 / img.width, 82 / img.height);
  c.drawImage(img, 50 - img.width * scale / 2, 48 - img.height * scale / 2, img.width * scale, img.height * scale);
  return true;
}
