import type { NoStickZone } from './types';

export const OBSTACLE_IDS = ['attract', 'repel', 'glass', 'plastic', 'gap', 'vent', 'dispenser', 'calendar', 'ice-tray', 'handle'] as const;
type ObstacleId = typeof OBSTACLE_IDS[number];
const images = new Map<string, HTMLImageElement>();
const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
export function setObstacleArt(id: string, image: HTMLImageElement) { images.set(id, image); }
export const obstacleArtReady = typeof Image === 'undefined' ? Promise.resolve() : Promise.all(OBSTACLE_IDS.map(id => new Promise<void>(resolve => {
  const img = new Image();
  img.onload = () => { setObstacleArt(id, img); resolve(); };
  img.onerror = () => resolve();
  img.src = `${base}art/real-v1/obstacles/${id}.png`;
}))).then(() => undefined);

/** The door-gap photo reads as a huge dark gasket when stretched across a band, so open gaps stay hand-drawn. */
const NO_PHOTO = new Set(['gap']);

function artId(z: NoStickZone): string | undefined {
  if (z.kind === 'attract' || z.kind === 'repel') return z.kind;
  if (z.hue === -1) return 'handle';
  const id = z.itemId && images.has(z.itemId) ? z.itemId : { glass: 'glass', trim: 'plastic', void: 'gap', sticker: undefined }[z.kind];
  return id && NO_PHOTO.has(id) ? undefined : id;
}

/** Fill the real collision rectangle; nine-slice preserves the molded frame thickness. */
export function drawObstacleImage(c: CanvasRenderingContext2D, z: NoStickZone): boolean {
  const id = artId(z), img = id ? images.get(id) : undefined;
  if (!img || z.w <= 0 || z.h <= 0) return false;
  c.save();
  if (id === 'ice-tray' && z.h > z.w) {
    c.translate(z.x + z.w, z.y); c.rotate(Math.PI / 2);
    c.drawImage(img, 0, 0, z.h, z.w);
  } else if (['glass', 'plastic', 'gap', 'vent'].includes(id!)) {
    const sx = [0, img.width * .14, img.width * .86, img.width];
    const sy = [0, img.height * .14, img.height * .86, img.height];
    const edge = Math.min(10, z.w / 4, z.h / 4);
    const dx = [z.x, z.x + edge, z.x + z.w - edge, z.x + z.w];
    const dy = [z.y, z.y + edge, z.y + z.h - edge, z.y + z.h];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) c.drawImage(img, sx[x], sy[y], sx[x+1]-sx[x], sy[y+1]-sy[y], dx[x], dy[y], dx[x+1]-dx[x], dy[y+1]-dy[y]);
  } else c.drawImage(img, z.x, z.y, z.w, z.h);
  c.restore(); return true;
}

/** Guide previews retain natural proportions, including the long handle. */
export function drawObstaclePreview(c: CanvasRenderingContext2D, id: string): boolean {
  const img = images.get(id as ObstacleId);
  if (!img) return false;
  const scale = Math.min(88 / img.width, 82 / img.height);
  c.drawImage(img, 50 - img.width * scale / 2, 48 - img.height * scale / 2, img.width * scale, img.height * scale);
  return true;
}
