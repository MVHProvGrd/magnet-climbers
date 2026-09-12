import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { Game } from "./game/game";
import { render, hudButtons, teamDots } from "./game/render";
import { Ui } from "./game/ui";
import { loadSave, writeSave } from "./game/save";
import { UPGRADES, W, upgradeCost, RESERVE_COST, SKINS, type UpgradeKey } from "./game/config";
import { setSound } from "./game/audio";
import { leaderboard, leaderboardEnabled } from "./game/leaderboard";

registerSW({ immediate: true });

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const uiRoot = document.getElementById("ui")!;

let save = loadSave();
setSound(save.sound);
const persist = () => writeSave(save);

let game: Game | null = null;
let paused = false;
let adUsedThisRun = false;
/** height already credited this run, so a revived run is not paid twice */
let bankedCm = 0;
let runCounted = false;
let viewH = 700;
let dpr = 1;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth || window.innerWidth;
  const ch = canvas.clientHeight || window.innerHeight;
  const scale = cw / W;
  viewH = ch / scale;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(viewH * dpr);
  if (game) game.viewH = viewH;
}
window.addEventListener("resize", resize);
resize();

const ui = new Ui(uiRoot, () => save, {
  onPlay: (rules) => startRun(rules),
  onResume: () => { paused = false; },
  onQuitRun: () => { endRun(); ui.showMenu(); },
  onBuy: (key: UpgradeKey) => {
    const def = UPGRADES.find((u) => u.key === key)!;
    const lvl = save.upgrades[key];
    const cost = upgradeCost(def, lvl);
    if (lvl >= def.max || save.coins < cost) return;
    save.coins -= cost;
    save.upgrades[key] = lvl + 1;
    persist();
  },
  onRevive: (method) => {
    if (!game) return;
    if (method === "gems") {
      if (save.gems < 5) return;
      save.gems -= 5; persist();
      game.revive(false);
    } else if (method === "token") {
      game.revive(true);
    } else {
      adUsedThisRun = true;
      ui.showAdPlaceholder(3, () => { game?.revive(false); paused = false; });
      return;
    }
    paused = false;
  },
  onBuyReserve: () => {
    if (save.coins < RESERVE_COST || save.reserves >= 5) return;
    save.coins -= RESERVE_COST; save.reserves += 1; persist();
  },
  onBuySkin: (key) => {
    const sk = SKINS.find((k) => k.key === key);
    if (!sk) return;
    if (!save.skins.includes(key)) {
      if (save.coins < sk.cost) return;
      save.coins -= sk.cost; save.skins.push(key);
    }
    save.skin = key; persist();
  },
  onToggleSound: () => { save.sound = !save.sound; setSound(save.sound); persist(); },
  onSetName: (name) => { save.name = name; persist(); },
});

let rulesNow: "solo" | "crew" = "crew";
function startRun(rules: "solo" | "crew") {
  rulesNow = rules;
  ui.clear();
  adUsedThisRun = false;
  bankedCm = 0;
  runCounted = false;
  paused = false;
  game = new Game(save.upgrades, {
    onPower: () => {},
    onCoins: () => {},
    onGems: () => {},
    onGameOver: () => {
      if (!game) return;
      paused = true;
      const cm = game.heightCm;
      const bestKey = rulesNow === "solo" ? "bestSolo" : "bestCm";
      const isRecord = cm > save[bestKey];
      const newCm = Math.max(0, cm - bankedCm);
      const earned = game.coins + Math.floor(newCm / 4);
      save.coins += earned;
      save.gems += game.gems;
      save[bestKey] = Math.max(save[bestKey], cm);
      save.totalCm += newCm;
      if (!runCounted) { save.runs += 1; runCounted = true; }
      // bank this run's pick-ups and height so a revive does not pay them twice
      bankedCm = cm;
      game.coins = 0; game.gems = 0;
      save.reserves = game.reserves;
      persist();
      const panel = ui.showGameOver({ cm, best: save[bestKey], coins: earned, tokens: game.revivesLeft, gems: save.gems, adUsed: adUsedThisRun, isRecord });
      submitScore(cm, panel);
    },
  }, { rules });
  game.reserves = save.reserves;
  game.palette = SKINS.find((k) => k.key === save.skin)?.colors ?? SKINS[0].colors;
  for (const c of game.climbers) c.color = game.palette[(c.id - 1) % game.palette.length];
  game.viewH = viewH;
  ui.setInRun(true);
}

/** Push the run to the global board (best per player is kept server-side). */
function submitScore(cm: number, panel: HTMLElement) {
  if (!leaderboardEnabled || cm <= 0) return;
  const send = () => {
    void leaderboard.submit(save.playerId, save.name || "anonymous", rulesNow, cm).then(async (r) => {
      if (!r) { ui.setGameOverRank(panel, "Scoreboard unreachable"); return; }
      const rank = await leaderboard.rank(rulesNow, save.playerId);
      ui.setGameOverRank(panel, rank?.rank ? `Global rank #${rank.rank} (${rank.cm} cm)` : "Score sent");
    });
  };
  if (!save.name) {
    // first time on the board: ask for a name, then send. Keep the game-over panel underneath.
    ui.showNamePrompt(() => { ui.showGameOver; send(); });
    return;
  }
  send();
}

function endRun() {
  game = null;
  paused = false;
  ui.setInRun(false);
}

// ---------- input ----------
const toWorld = (e: PointerEvent) => {
  const r = canvas.getBoundingClientRect();
  const s = W / r.width;
  return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s + (game?.camY ?? 0) };
};
const toScreen = (e: PointerEvent) => {
  const r = canvas.getBoundingClientRect();
  const s = W / r.width;
  return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s };
};
const hit = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
canvas.addEventListener("pointerdown", (e) => {
  if (!game || paused) return;
  const sp = toScreen(e);
  const b = hudButtons(viewH);
  for (const d of teamDots(game)) {
    if (Math.hypot(d.x - sp.x, d.y - sp.y) < 17) { game.select(d.id); return; }
  }
  if (game.freeCam && hit(sp, b.recenter)) { game.recenter(); return; }
  if (game.rules === "crew" && hit(sp, b.sync)) { game.sync = !game.sync; return; }
  if (game.rules === "crew" && hit(sp, b.mode)) { game.mode = game.mode === "fling" ? "move" : "fling"; return; }
  if (game.rules === "crew" && game.reserves > 0 && hit(sp, b.reserve)) { if (game.callReserve()) { save.reserves = game.reserves; persist(); } return; }
  canvas.setPointerCapture(e.pointerId);
  game.pointerDown(toWorld(e));
});
canvas.addEventListener("pointermove", (e) => { if (game && !paused) game.pointerMove(toWorld(e)); });
canvas.addEventListener("pointerup", () => { if (game && !paused) game.pointerUp(); });
canvas.addEventListener("pointercancel", () => { if (game) game.drag = null; });
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game && !paused && game.phase !== "dead") { paused = true; ui.showPause(); }
});

// ---------- loop ----------
let last = performance.now();
let acc = 0;
const STEP = 1 / 120;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game) {
    if (!paused) {
      acc += dt;
      while (acc >= STEP) { game.update(STEP); acc -= STEP; }
    }
    render(ctx, game, viewH, dpr);
  } else {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#1a1d24";
    ctx.fillRect(0, 0, W, viewH);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

ui.showMenu();

// Debug / QA hook (harmless in production; no secrets, no cheats persisted).
declare global { interface Window { __mc?: { game: () => Game | null; save: () => unknown } } }
window.__mc = { game: () => game, save: () => save };
