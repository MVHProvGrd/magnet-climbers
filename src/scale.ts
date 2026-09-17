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
import { drawSurface, drawZone, drawPower } from "./game/scenery";
import { drawClimber } from "./game/climber-render";
import { drawGadget, gadgetArtReady, destinationArtById, drawDestination } from "./game/gadget-art";
import { obstacleArtReady } from "./game/obstacle-art";
import { pickupArtReady } from "./game/pickup-art";
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
  { label: "Advertising magnets", of: (i) => i.family === "bumper" && !i.id.startsWith("bumper-") },
  { label: "Hanging gadgets", of: (i) => i.family === "gadget" },
  { label: "Souvenir plates", of: (i) => i.kind === "attract" || i.kind === "repel" },
  { label: "Surfaces and fittings", of: (i) => i.family === "surface" && i.kind !== "attract" && i.kind !== "repel" },
  { label: "Pickups", of: (i) => i.family === "pickup" },
];
/** A gadget draws itself at a size baked into gadget-art, so the sliders cannot move it. */
const isGadget = (i: FridgeItem) => i.family === "gadget";
/** Where the size a thing is drawn at actually lives, so the number has somewhere to go. */
const source = (i: FridgeItem) =>
  isGadget(i) ? "gadget-art.ts (the draw size in its branch)"
  : i.family === "paper" ? "world.ts card slots + data/paper-aspect.json"
  : i.family === "pickup" ? "scenery.ts drawPower"
  : i.id === "ice-tray" || i.id === "plastic" ? "placement.ts rule size"
  : "world.ts, where the zone is cut";

/** The natural shape of a thing's art, when we know it. */
function aspectOf(item: FridgeItem): number | undefined {
  if (item.family === "paper") return PAPER_ASPECT[item.id];
  return undefined;
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
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(w / 26, w / 26);
    drawPower(ctx, { x: 0, y: 0, kind: item.power as PowerKind, taken: false, bob: 0 }, 0); ctx.restore(); return;
  }
  if (item.family === "paper") { drawZone(ctx, zone("sticker"), 0, 42); return; }
  if (item.id.startsWith("bumper-")) {
    // a toy is either stuck flat on the door or hung from a keyring; both are real
    drawZone(ctx, hang ? zone("trim", { swing: { angle: 0, vel: 0, cool: 0 } }) : zone("repel", { power: 0.2 }), 0, 42);
    return;
  }
  drawZone(ctx, zone(item.kind ?? "trim"), 0, 42);
}

/* ------------------------------------------------------------------ the bench */
let item: FridgeItem = FRIDGE_ITEMS.find((i) => i.id === "clip-lost-cat") ?? FRIDGE_ITEMS[0];
let boxW = 150, boxH = 150, lockAspect = true, hang = false;

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

  // the box we are sizing, so an odd-shaped photo still reads as its collider
  ctx.strokeStyle = "rgba(255,138,61,.75)"; ctx.setLineDash([5, 4]); ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, boxW, boxH); ctx.setLineDash([]);
  ctx.restore();

  const cm = (px: number) => (px / CFG.pxPerCm).toFixed(1);
  const times = (boxH / CLIMBER_PX).toFixed(2);
  readout.innerHTML =
    `<b>${esc(item.name)}</b>  ·  ${esc(item.id)}\n` +
    `box      <b>${boxW} × ${boxH} px</b>   (${cm(boxW)} × ${cm(boxH)} cm)\n` +
    `climber  ${CLIMBER_PX} px   ·   this is <b>${times}×</b> a climber tall\n` +
    `aspect   ${(boxW / boxH).toFixed(3)}${aspectOf(item) ? `   (art is ${aspectOf(item)!.toFixed(3)})` : ""}\n` +
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
      <select id="item">${GROUPS.map((gr) => {
        const of = FRIDGE_ITEMS.filter(gr.of);
        return of.length ? `<optgroup label="${esc(gr.label)}">${of.map((i) =>
          `<option value="${esc(i.id)}"${i.id === item.id ? " selected" : ""}>${esc(i.name)}</option>`).join("")}</optgroup>` : "";
      }).join("")}</select>
      <p class="desc" id="desc"></p>
      <div class="check"><input type="checkbox" id="hang" /><label for="hang" style="margin:0">Hang it from a keyring (toys only)</label></div>

      <h2>Size</h2>
      <label for="w">Width — <span id="wv"></span></label>
      <div class="row"><input type="range" id="w" min="16" max="400" step="1" /><input type="number" id="wn" min="1" max="400" /></div>
      <label for="h">Height — <span id="hv"></span></label>
      <div class="row"><input type="range" id="h" min="16" max="560" step="1" /><input type="number" id="hn" min="1" max="560" /></div>
      <div class="check"><input type="checkbox" id="lock" checked /><label for="lock" style="margin:0">Keep the art's own shape</label></div>

      <div class="bar">
        <button id="fit">Fit the art</button>
        <button id="match">Match the climber</button>
        <button class="primary" id="copy">Copy numbers</button>
      </div>
      <div class="readout" id="out"></div>
    </div>
    <div class="card">
      <canvas class="door" id="door" width="880" height="1584"></canvas>
      <p class="fine" style="margin-top:10px">Ticks down the seam are the game's centimetres, ten pixels each. The dashed box is the collider, which is what the world actually places — art may sit inside it.</p>
    </div>
  </div>`;

  const canvas = root.querySelector<HTMLCanvasElement>("#door")!;
  const out = root.querySelector<HTMLElement>("#out")!;
  const desc = root.querySelector<HTMLElement>("#desc")!;
  const wR = root.querySelector<HTMLInputElement>("#w")!, hR = root.querySelector<HTMLInputElement>("#h")!;
  const wN = root.querySelector<HTMLInputElement>("#wn")!, hN = root.querySelector<HTMLInputElement>("#hn")!;
  const wV = root.querySelector<HTMLElement>("#wv")!, hV = root.querySelector<HTMLElement>("#hv")!;
  const lock = root.querySelector<HTMLInputElement>("#lock")!;
  const hangBox = root.querySelector<HTMLInputElement>("#hang")!;

  const sync = () => {
    wR.value = wN.value = String(boxW); hR.value = hN.value = String(boxH);
    wV.textContent = `${boxW} px · ${(boxW / CFG.pxPerCm).toFixed(1)} cm`;
    hV.textContent = `${boxH} px · ${(boxH / CFG.pxPerCm).toFixed(1)} cm`;
    desc.textContent = item.description;
    hangBox.disabled = !item.id.startsWith("bumper-");
    paint(canvas, out);
  };
  const setW = (v: number) => { boxW = Math.max(1, Math.min(400, Math.round(v)));
    const a = aspectOf(item); if (lockAspect && a) boxH = Math.round(boxW / a); sync(); };
  const setH = (v: number) => { boxH = Math.max(1, Math.min(560, Math.round(v)));
    const a = aspectOf(item); if (lockAspect && a) boxW = Math.round(boxH * a); sync(); };

  wR.addEventListener("input", () => setW(+wR.value));
  wN.addEventListener("change", () => setW(+wN.value));
  hR.addEventListener("input", () => setH(+hR.value));
  hN.addEventListener("change", () => setH(+hN.value));
  lock.addEventListener("change", () => { lockAspect = lock.checked; setW(boxW); });
  hangBox.addEventListener("change", () => { hang = hangBox.checked; sync(); });
  root.querySelector("#item")!.addEventListener("change", (e) => {
    item = FRIDGE_ITEMS.find((i) => i.id === (e.target as HTMLSelectElement).value)!;
    const a = aspectOf(item);
    if (a) { boxW = 150; boxH = Math.round(150 / a); }
    sync();
  });
  root.querySelector("#fit")!.addEventListener("click", () => {
    const a = aspectOf(item) ?? 1; boxW = 150; boxH = Math.round(150 / a); sync();
  });
  root.querySelector("#match")!.addEventListener("click", () => { setH(CLIMBER_PX); });
  root.querySelector("#copy")!.addEventListener("click", () => {
    void navigator.clipboard.writeText(`${item.id}: ${boxW} x ${boxH} px (${(boxW / CFG.pxPerCm).toFixed(1)} x ${(boxH / CFG.pxPerCm).toFixed(1)} cm, ${(boxH / CLIMBER_PX).toFixed(2)}x climber)`);
  });

  void Promise.all([obstacleArtReady, gadgetArtReady, pickupArtReady]).then(sync);
  sync();
}

const saved = localStorage.getItem(KEY);
if (saved) void keyWorks(saved).then((ok) => (ok ? boot() : askForKey()));
else askForKey();
