import list from "../../art/archive/22-avatars-v1/avatars.json";

/** Chat and profile portraits. One sprite sheet, cells in list order, `COLS` per row. */
export interface AvatarDef { id: string; name: string }
export const AVATARS: AvatarDef[] = (list as [string, string, string][]).map(([id, name]) => ({ id, name }));
export const AVATAR_COLS = 12;
export const AVATAR_CELL = 96;
const index = new Map(AVATARS.map((a, i) => [a.id, i]));
/** Ids that were renamed after release, so a save made under the old one still resolves. */
const ALIASES: Record<string, string> = { possum: "opossum" };
const slot = (id?: string) => (id === undefined ? undefined : index.get(ALIASES[id] ?? id));
const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
export const AVATAR_SHEET = `${base}art/avatars/sheet.webp`;

export const avatarById = (id?: string) => { const i = slot(id); return i === undefined ? undefined : AVATARS[i]; };
export const isAvatarId = (id: unknown): id is string => typeof id === "string" && slot(id) !== undefined;

/** Inline HTML for an avatar at `size` px. Unknown or empty ids fall back to a coloured initial. */
export function avatarHtml(id: string | undefined, name: string, size = 28): string {
  const i = slot(id || undefined);
  if (i === undefined) {
    let h = 0; for (let k = 0; k < name.length; k++) h = (h * 31 + name.charCodeAt(k)) >>> 0;
    const initial = (name.trim()[0] ?? "?").toUpperCase();
    return `<span class="avi blank" style="width:${size}px;height:${size}px;background:hsl(${h % 360} 45% 40%);font-size:${Math.round(size * 0.55)}px;line-height:${size}px" aria-hidden="true">${initial.replace(/[<>&]/g, "")}</span>`;
  }
  const col = i % AVATAR_COLS, row = Math.floor(i / AVATAR_COLS), s = size / AVATAR_CELL;
  const rows = Math.ceil(AVATARS.length / AVATAR_COLS);
  return `<span class="avi" style="width:${size}px;height:${size}px;background-image:url(${AVATAR_SHEET});background-size:${AVATAR_COLS * AVATAR_CELL * s}px ${rows * AVATAR_CELL * s}px;background-position:-${col * size}px -${row * size}px" role="img" aria-label="${AVATARS[i].name}"></span>`;
}
