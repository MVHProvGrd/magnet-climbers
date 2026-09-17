/**
 * Scale bench — owner only, not linked from the game.
 *
 * A real fridge door, a real climber standing on it, and any one thing that can
 * appear on that door drawn beside them at a size you set. It answers the
 * question the placement workbench cannot: "how big should this actually be?"
 * — without guessing, because the climber is the ruler and the renderer is the
 * game's own.
 *
 * Nothing here ships a size. Read the numbers off the readout and put them in
 * `placement.ts` (surfaces and trays), `world.ts` (the zone the thing is cut
 * from) or `gadget-art.ts` (a gadget's own draw size).
 *
 * Gate: the Worker's ADMIN_KEY, same as the placement workbench.
 */
import { CFG, W } from "./game/config";
import { FRIDGE_ITEMS, PAPER_ASPECT, type FridgeItem } from "./game/items";
import { drawSurface, drawZone, drawPower, drawBumper } from "./game/scenery";
import { drawClimber } from "./game/climber-render";
import { drawGadget, gadgetArtReady, destinationArtById, drawDestination, objectArtById } from "./game/gadget-art";
import { obstacleArtReady, obstacleImage } from "./game/obstacle-art";
import { pickupArtReady, pickupImage } from "./game/pickup-art";
import { resetRagdoll } from "./game/ragdoll";
import type { Climber, NoStickZone, PowerKind } from "./game/types";

const API = "https://magnet-climbers-api.magnetclimbers.workers.dev";
const KEY = "mc-admin-key";
const root = document.getElementById("sb")!;
const VIEW_H = 720;
/** the climber's own height in px, measured off the rig the game draws */
const CLIMBER_PX = CFG.climberRadius * 2;

const css = `
  :root { color-scheme: dark; --bg:#12151b; --panel:#1b2029; --line:#2b3340; --ink:#e8eef5; --dim:#93a1b1; --accent:#ff8a3d; --good:#7ee0a8; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.45 system-ui, sans-serif; }
  .wrap { display:grid; grid-template-columns: 380px 1fr; gap:18px; padding:18px; align-items:start; }
  @media (max-width: 900px) { .wrap { grid-template-columns: 1fr; } }
  h1 { font-size:18px; margin:0 0 4px; }
  h2 { font-size:12px; text-transform:uppercase; letter-spacing:1.4px; color:var(--dim); margin:16px 0 8px; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px; }
  canvas.door { display:block; border-radius:10px; background:#000; width:100%; max-width:440px; }
  label { display:block; font-size:12px; color:var(--dim); margin:12px 0 3px; }
  select, input[type=number], input[type=password] { width:100%; padding:8px 9px; border-radius:8px; border:1px solid var(--line); background:#0f1319; color:var(--ink); font:inherit; }
  input[type=range] { width:100%; accent-color:var(--accent); }
  .row { display:grid; grid-template-columns: 1fr 92px; gap:10px; align-items:center; }
  .pair { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
  .check { display:flex; align-items:center; gap:8px; margin-top:12px; font-size:13px; color:var(--dim); }
  button { padding:9px 14px; border-radius:9px; border:1px solid var(--line); background:#242c38; color:var(--ink); font:600 13px system-ui; cursor:pointer; }
  button.primary { background:var(--accent); color:#1a1d24; border-color:transparent; }
  .bar { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
  .fine { color:var(--dim); font-size:12px; }
  .gate { max-width:360px; margin:12vh auto; }
  .readout { font:12.5px/1.7 ui-monospace, Menlo, monospace; white-space:pre-wrap; color:var(--dim); margin-top:10px; }
  .readout b { color:var(--ink); font-weight:600; }
  .desc { font-size:13px; color:var(--dim); margin:8px 0 0; }
  .warn { color:var(--accent); }
  [hidden] { display:none !important; }
`;
const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));

/* ----------------------------------------------------------------- the gate */
async function keyWorks(key: string): Promise<boolean> {
  try { return (await fetch(`${API}/admin/api/overview`, { headers: { Authorization: `Bearer ${key}` } })).ok; }
  catch { return false; }
}
function askForKey() {
  root.innerHTML = `<div class="card gate">
    <h1>Scale bench</h1>
    <p class="fine">Owner only. Paste the Worker's ADMIN_KEY; it is checked against the API and then kept on this device.</p>
    <label for="k">ADMIN_KEY</label>
    <input id="k" type="password" autocomplete="off" />
    <div class="bar"><button class="primary" id="go">Unlock</button></div>
    <p class="fine" id="msg"></p>
  </div>`;
  const input = root.querySelector<HTMLInputElement>("#k")!, msg = root.querySelector<HTMLElement>("#msg")!;
  const submit = async () => {
    msg.textContent = "Checking…";
    if (await keyWorks(input.value.trim())) { localStorage.setItem(KEY, input.value.trim()); void boot(); }
    else msg.textContent = "That key was refused, or the Worker is unreachable.";
  };
  root.querySelector("#go")!.addEventListener("click", () => void submit());
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") void submit(); });
  input.focus();
}

/* --------------------------------------------------------------- the subject */
/** Things that really do appear on a door, grouped the way an owner thinks about them. */
const GROUPS: { label: string; of: (i: FridgeItem) => boolean }[] = [
  { label: "Paper on the door", of: (i) => i.family === "paper" },
  { label: "Toy magnets", of: (i) => i.family === "bumper" && i.id.startsWith("bumper-") },
  { label: "Advertising magnets", of: (i) => i.family === "bumper" && !i.id.startsWith("bumper-") && !i.hazard },
  { label: "Hanging gadgets", of: (i) => i.family === "gadget" },
  { label: "Souvenir plates", of: (i) => i.kind === "attract" || i.kind === "repel" },
  { label: "Surfaces and fittings", of: (i) => i.family === "surface" && i.kind !== "attract" && i.kind !== "repel" },
  { label: "Pickups", of: (i) => i.family === "pickup" },
];
/** A gadget draws itself at a size baked into gadget-art, so the sliders cannot move it. */
const isGadget = (i: FridgeItem) => i.family === "gadget";
/** The advertising magnets: family "bumper", but not one of the photographed toys. */
const isAdvert = (i: FridgeItem) => i.family === "bumper" && !i.id.startsWith("bumper-");
/** Where the size a thing is drawn at actually lives, so the number has somewhere to go. */
const source = (i: FridgeItem) =>
  isGadget(i) ? "gadget-art.ts (the draw size in its branch)"
  : i.family === "paper" ? "world.ts card slots + data/paper-aspect.json"
  : i.family === "pickup" ? "scenery.ts drawPower"
  : i.id === "ice-tray" || i.id === "plastic" ? "placement.ts rule size"
  : "world.ts, where the zone is cut";

/** Pixel size of whatever bitmap a thing is actually drawn from, when there is one. */
function artPixels(item: FridgeItem): { w: number; h: number } | undefined {
  const img = item.family === "pickup" ? pickupImage(item.power as PowerKind)
    : item.kind === "attract" || item.kind === "repel" ? destinationArtById(item.id)
    : obstacleImage(item.id) ?? objectArtById(item.id);
  if (!img) return undefined;
  const w = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
  const h = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
  return w && h ? { w, h } : undefined;
}

/**
 * The shape a thing really is, so one slider can size it without ever distorting it.
 *
 * Every family has an answer: a photograph knows its own pixels, paper has a measured table,
 * an advertising magnet is authored into a hundred by sixty, and a gadget draws itself at a
 * size baked into gadget-art. Squashing was never a decision anyone wanted to make -- it only
 * ever produced a number that looked right on the bench and wrong on the door.
 */
function aspectOf(item: FridgeItem): number {
  if (item.family === "paper") return PAPER_ASPECT[item.id] ?? 1;
  if (isAdvert(item)) return 100 / 60;
  const px = artPixels(item);
  return px ? px.w / px.h : 1;
}

/** Draw one item into a rect with the game's own renderer. */
function drawItemAt(ctx: CanvasRenderingContext2D, item: FridgeItem, x: number, y: number, w: number, h: number, hang: boolean) {
  const zone = (kind: NoStickZone["kind"], extra: Partial<NoStickZone> = {}): NoStickZone =>
    ({ x, y, w, h, kind, hue: item.hue ?? 0, itemId: item.id, ...extra } as NoStickZone);
  if (item.kind === "attract" || item.kind === "repel") {
    const art = destinationArtById(item.id);
    if (art) { drawDestination(ctx, art, x, y, w, h); return; }
    drawZone(ctx, zone(item.kind), 0, 42); return;
  }
  if (isGadget(item)) {
    // drawn at its own size about the hold, so centre it in the box we were given
    drawGadget(ctx, { id: item.id, itemId: item.id, kind: item.behavior!, x: x + w / 2, y: y + h / 2, phase: 0,
      ...(item.behavior === "swing" || item.behavior === "clip" ? { swing: { angle: 0, vel: 0, cool: 0 } } : {}) }, 0);
    return;
  }
  if (item.family === "pickup") {
    // drawPickupImage lays the art out at 46px. The bench scaled from 26, so every pickup came
    // out nearly twice the size the slider claimed -- which is no use at all on a bench whose
    // entire job is judging size.
    const k = h / 46;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k);
    drawPower(ctx, { x: 0, y: 0, kind: item.power as PowerKind, taken: false, bob: 0 }, 0); ctx.restore(); return;
  }
  if (item.family === "paper") { drawZone(ctx, zone("sticker"), 0, 42); return; }
  if (isAdvert(item)) {
    // The game draws these through drawBumper, because that is what they are: a magnet
    // sliding across the door. The bench had no branch for them at all, so they fell to the
    // catch-all below and came out as a sheet of dark plastic trim -- every advertising
    // magnet in the list was being sized against a picture of the wrong object.
    drawBumper(ctx, { x, y, w, h, vx: 0, minX: x, maxX: x, vy: 0, minY: y, maxY: y,
      label: item.label ?? item.name, hue: item.hue ?? 0, itemId: item.id, motion: "slide" }, 0);
    return;
  }
  if (item.id.startsWith("bumper-")) {
    // a toy is either stuck flat on the door or hung from a keyring; both are real
    drawZone(ctx, hang ? zone("trim", { swing: { angle: 0, vel: 0, cool: 0 } }) : zone("repel", { power: 0.2 }), 0, 42);
    return;
  }
  drawZone(ctx, zone(item.kind ?? "trim"), 0, 42);
}

/* ------------------------------------------------------------------ the bench */
/** Everything the bench can walk, in the order the groups are listed. */
/**
 * Cooper's hand and the cat's paw are guide cards, not things on the door. They are animated
 * by kid-hand.ts and cat-paw.ts at their own scale, they never become a zone, and the bench
 * drew each as a red rectangle with its name in it -- nothing you could judge and nothing a
 * number would reach. They stay as they are, so the walk no longer asks about them.
 */
const WALK: FridgeItem[] = GROUPS.flatMap((gr) => FRIDGE_ITEMS.filter(gr.of)).filter((i) => !i.hazard);
/**
 * v2: every number recorded before this was taken against whatever the bench happened to
 * draw, and for the sixteen advertising magnets that was a sheet of dark plastic trim rather
 * than the magnet. Rather than leave a list of sizes measured from the wrong object, the key
 * moves and the walk starts clean.
 */
const SIZES = "mc-scale-sizes:v2";
type Audit = Record<string, { w: number; h: number; at: string }>;
const readAudit = (): Audit => { try { return JSON.parse(localStorage.getItem(SIZES) ?? "{}") as Audit; } catch { return {}; } };
const writeAudit = (a: Audit) => { try { localStorage.setItem(SIZES, JSON.stringify(a)); } catch { /* private window */ } };
let audit: Audit = readAudit();

let item: FridgeItem = WALK[0];
let boxW = 150, boxH = 150, hang = false;

function poseClimber(x: number, y: number): Climber {
  const c: Climber = { id: 1, x, y, vx: 0, vy: 0, angle: 0, spin: 0, state: "stuck", color: "#4fc3f7",
    creature: "human", pattern: "classic", parent: null, leftLauncher: true, launcherId: null,
    airTime: 0, squash: 0, hp: 3, iframes: 0 };
  resetRagdoll(c);
  return c;
}

function paint(canvas: HTMLCanvasElement, readout: HTMLElement) {
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(canvas.width / W, canvas.width / W);
  drawSurface(ctx, 0, VIEW_H);

  // the thing under test, centred on the left door
  const x = Math.round(110 - boxW / 2), y = Math.round(300 - boxH / 2);
  drawItemAt(ctx, item, x, y, boxW, boxH, hang);

  // the ruler: a climber standing on the right door, at the size the game draws one
  const climber = poseClimber(300, 300);
  drawClimber(ctx, climber, false, 0, {});
  ctx.fillStyle = "rgba(126,224,168,.9)"; ctx.font = "600 11px system-ui"; ctx.textAlign = "center";
  ctx.fillText("climber", 300, 300 + CLIMBER_PX + 14);

  // a height scale down the seam, in the game's own centimetres
  ctx.textAlign = "left"; ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.fillStyle = "rgba(255,255,255,.45)";
  ctx.font = "10px ui-monospace, monospace"; ctx.lineWidth = 1;
  for (let cm = 0; cm <= VIEW_H / CFG.pxPerCm; cm += 10) {
    const py = VIEW_H - cm * CFG.pxPerCm;
    ctx.beginPath(); ctx.moveTo(196, py); ctx.lineTo(cm % 20 ? 202 : 208, py); ctx.stroke();
    if (!(cm % 20)) ctx.fillText(`${cm}`, 210, py + 3.5);
  }

  ctx.restore();

  const cm = (px: number) => (px / CFG.pxPerCm).toFixed(1);
  const times = (boxH / CLIMBER_PX).toFixed(2);
  readout.innerHTML =
    `<b>${esc(item.name)}</b>  ·  ${esc(item.id)}\n` +
    `box      <b>${boxW} × ${boxH} px</b>   (${cm(boxW)} × ${cm(boxH)} cm)\n` +
    `climber  ${CLIMBER_PX} px   ·   this is <b>${times}×</b> a climber tall\n` +
    `aspect   ${(boxW / boxH).toFixed(3)}${aspectOf(item) ? `   (art is ${aspectOf(item)!.toFixed(3)})` : ""}\n` +
    `${audit[item.id] ? `recorded  <b>✓ ${audit[item.id].w} × ${audit[item.id].h}</b>  on ${audit[item.id].at}\n` : ""}` +
    `set it in ${esc(source(item))}` +
    (isGadget(item) ? `\n<span class="warn">a gadget draws at its own size: the box is a ruler here, not a control</span>` : "");
}

function boot() {
  root.innerHTML = `<div class="wrap">
    <div class="card">
      <h1>Scale bench</h1>
      <p class="fine">The real door, a real climber for scale, and anything that can appear on it at whatever size you like. Nothing here ships — read the numbers and put them in the code.</p>
      <h2>What to look at</h2>
      <label for="item">Object</label>
      <select id="item"></select>
      <p class="desc" id="desc"></p>
      <div class="check"><input type="checkbox" id="hang" /><label for="hang" style="margin:0">Hang it from a keyring (toys only)</label></div>

      <h2>Size</h2>
      <label for="h">Size — <span id="hv"></span></label>
      <div class="row"><input type="range" id="h" min="8" max="560" step="1" /><input type="number" id="hn" min="1" max="560" /></div>
      <div class="readout" id="out"></div>

      <h2>Audit</h2>
      <p class="fine" id="progress"></p>
      <div class="bar">
        <button id="prev">‹ Back</button>
        <button id="skip">Next ›</button>
      </div>
      <div class="bar">
        <button class="primary" id="keep">Keep this size</button>
      </div>
      <div class="bar">
        <button id="export">Show the file</button>
        <button id="copyall">Copy the file</button>
        <button id="wipe">Start over</button>
      </div>
      <textarea id="file" hidden readonly></textarea>
    </div>
    <div class="card">
      <canvas class="door" id="door" width="880" height="1584"></canvas>
      <p class="fine" style="margin-top:10px">Ticks down the seam are the game's centimetres, ten pixels each. The art keeps its own shape: set how tall it should be and the width follows.</p>
    </div>
  </div>`;

  const canvas = root.querySelector<HTMLCanvasElement>("#door")!;
  const picker = root.querySelector<HTMLSelectElement>("#item")!;
  const out = root.querySelector<HTMLElement>("#out")!;
  const desc = root.querySelector<HTMLElement>("#desc")!;
  const hR = root.querySelector<HTMLInputElement>("#h")!;
  const hN = root.querySelector<HTMLInputElement>("#hn")!;
  const hV = root.querySelector<HTMLElement>("#hv")!;
  const hangBox = root.querySelector<HTMLInputElement>("#hang")!;

  const sync = () => {
    hR.value = hN.value = String(boxH);
    hV.textContent = `${boxH} px tall · ${(boxH / CFG.pxPerCm).toFixed(1)} cm · ${boxW}×${boxH}`;
    desc.textContent = item.description;
    hangBox.disabled = !item.id.startsWith("bumper-");
    paint(canvas, out);
  };
  /** One number. The width follows the art's own shape, so nothing here can distort anything. */
  const setH = (v: number) => {
    boxH = Math.max(1, Math.min(560, Math.round(v)));
    boxW = Math.max(1, Math.round(boxH * aspectOf(item)));
    sync();
  };
  hR.addEventListener("input", () => setH(+hR.value));
  hN.addEventListener("change", () => setH(+hN.value));
  hangBox.addEventListener("change", () => { hang = hangBox.checked; sync(); });
  picker.addEventListener("change", (e) => {
    item = FRIDGE_ITEMS.find((i) => i.id === (e.target as HTMLSelectElement).value)!;
    // Jumping to a thing you already sized used to throw that size away and show a fresh 150,
    // which is why a kept size looked as though it had never been kept: step to it with the
    // arrows and it was there, pick it from the list and it was gone.
    load();
    sync(); tell();
  });

  /** The picker doubles as the checklist: a tick marks every size already recorded. */
  const fillPicker = () => {
    const keep = item.id;
    picker.innerHTML = GROUPS.map((gr) => {
      const of = FRIDGE_ITEMS.filter(gr.of);
      const done = of.filter((i) => audit[i.id]).length;
      return of.length ? `<optgroup label="${esc(gr.label)} — ${done}/${of.length}">${of.map((i) =>
        `<option value="${esc(i.id)}">${audit[i.id] ? "✓ " : "◻︎ "}${esc(i.name)}${audit[i.id] ? ` · ${audit[i.id].w}×${audit[i.id].h}` : ""}</option>`).join("")}</optgroup>` : "";
    }).join("");
    picker.value = keep;
  };
  const progress = root.querySelector<HTMLElement>("#progress")!;
  const file = root.querySelector<HTMLTextAreaElement>("#file")!;
  const fileText = () => {
    const rows = WALK.filter((i) => audit[i.id]).map((i) => ({ id: i.id, name: i.name, family: i.family,
      w: audit[i.id].w, h: audit[i.id].h, cm: [+(audit[i.id].w / CFG.pxPerCm).toFixed(1), +(audit[i.id].h / CFG.pxPerCm).toFixed(1)],
      climbers: +(audit[i.id].h / CLIMBER_PX).toFixed(2), where: source(i) }));
    return JSON.stringify({ audited: rows.length, of: WALK.length, pxPerCm: CFG.pxPerCm, climberPx: CLIMBER_PX, sizes: rows }, null, 2);
  };
  const tell = () => {
    const done = WALK.filter((i) => audit[i.id]).length;
    const at = WALK.indexOf(item) + 1;
    const mine = audit[item.id];
    progress.innerHTML = `${at} of ${WALK.length} · ${done} recorded` +
      (mine ? ` · this one is <b>${mine.w}×${mine.h}</b>` : " · not recorded yet");
    if (!file.hidden) file.value = fileText();
  };
  /** The box to show this item in: the size already recorded, or its own natural shape. */
  const load = () => {
    const mine = audit[item.id];
    boxH = mine ? mine.h : 150;
    boxW = Math.max(1, Math.round(boxH * aspectOf(item)));
  };
  const go = (step: number) => {
    const at = (WALK.indexOf(item) + step + WALK.length) % WALK.length;
    item = WALK[at];
    load();
    picker.value = item.id;
    sync(); tell();
  };
  root.querySelector("#keep")!.addEventListener("click", () => {
    audit[item.id] = { w: boxW, h: boxH, at: new Date().toISOString().slice(0, 10) };
    writeAudit(audit); fillPicker(); go(1);
  });
  root.querySelector("#skip")!.addEventListener("click", () => go(1));
  root.querySelector("#prev")!.addEventListener("click", () => go(-1));
  root.querySelector("#export")!.addEventListener("click", () => { file.hidden = !file.hidden; file.value = fileText(); });
  // Copying silently is the same as not copying: you cannot tell, so you click it again and
  // still cannot tell. The button says what happened, and falls back to showing the text when
  // the clipboard is refused -- which it is on any page that is not served over https.
  root.querySelector("#copyall")!.addEventListener("click", (e) => {
    const btn = e.target as HTMLButtonElement, was = btn.textContent;
    const rows = WALK.filter((i) => audit[i.id]).length;
    navigator.clipboard.writeText(fileText()).then(
      () => { btn.textContent = `Copied ${rows} of ${WALK.length}`; },
      () => { file.hidden = false; file.value = fileText(); file.select(); btn.textContent = "Copy it from the box"; },
    ).finally(() => setTimeout(() => { btn.textContent = was; }, 2200));
  });
  root.querySelector("#wipe")!.addEventListener("click", () => {
    if (!confirm("Forget every size recorded on this device?")) return;
    audit = {}; writeAudit(audit); fillPicker(); tell();
  });
  addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  });

  fillPicker();
  // open on the first item at its own shape, not at a square nobody chose
  const first = aspectOf(item); if (first) boxH = Math.round(boxW / first);
  void Promise.all([obstacleArtReady, gadgetArtReady, pickupArtReady]).then(() => { sync(); tell(); });
  sync(); tell();
}

const saved = localStorage.getItem(KEY);
if (saved) void keyWorks(saved).then((ok) => (ok ? boot() : askForKey()));
else askForKey();
