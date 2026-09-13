import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { Game, type RunSnapshot } from "./game/game";
import { render, hudButtons, teamDots, setSafeBottom } from "./game/render";
import { renderMenuBackground } from "./game/menu-background";
import { Ui } from "./game/ui";
import { loadSave, writeSave } from "./game/save";
import { UPGRADES, W, upgradeCost, RESERVE_COST, SKINS, type UpgradeKey } from "./game/config";
import { setSound } from "./game/audio";
import { leaderboard, leaderboardEnabled } from "./game/leaderboard";
import { parseChallenge, clearChallengeParam, shareChallenge } from "./game/share";

const updateSW = registerSW({ immediate: true });
/** Manual update check from the menu; reloads if a new build is waiting. */
async function checkForUpdate() {
  ui.toast("Checking for update…");
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    if (reg?.waiting) { await updateSW(true); return; }
  } catch { /* fall through */ }
  setTimeout(() => location.reload(), 600);
}

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

// probe the safe-area inset so canvas buttons clear the gesture bar / home indicator
const safeProbe = document.createElement("div");
safeProbe.style.cssText = "position:fixed;left:0;bottom:0;width:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none";
document.body.appendChild(safeProbe);

let lastCw = 0, lastCh = 0;
function resize(force = false) {
  const r = canvas.getBoundingClientRect();
  const cw = r.width || window.innerWidth;
  const ch = r.height || window.innerHeight;
  if (!force && cw === lastCw && ch === lastCh) return;
  lastCw = cw; lastCh = ch;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const scale = cw / W;
  viewH = ch / scale;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(viewH * dpr);
  const insetPx = parseFloat(getComputedStyle(safeProbe).paddingBottom) || 0;
  setSafeBottom(insetPx / scale + 12);
  if (game) game.viewH = viewH;
}
window.addEventListener("resize", () => resize(true));
window.visualViewport?.addEventListener("resize", () => resize(true));
window.addEventListener("orientationchange", () => setTimeout(() => resize(true), 300));
if ("ResizeObserver" in window) new ResizeObserver(() => resize(true)).observe(canvas);
resize(true);
// iOS Safari ignores user-scalable=no; block pinch/double-tap zoom explicitly
document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
document.addEventListener("touchmove", (e) => { if ((e as TouchEvent).touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener("touchend", (e) => { const now = Date.now(); if (now - lastTouchEnd < 300) e.preventDefault(); lastTouchEnd = now; }, { passive: false });

const ui = new Ui(uiRoot, () => save, {
  onPlay: (rules) => startRun(rules),
  onResume: () => { paused = false; },
  onEndRun: () => { if (game) { paused = false; game.forceEnd(); } },
  onQuitRun: () => {
    if (game && game.phase !== "dead" && !game.chill) { save.coins += game.coins; save.gems += game.gems; save.reserves = game.reserves; persist(); }
    endRun(); ui.showMenu();
  },
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
  onToggleChill: () => { save.chill = !save.chill; persist(); },
  onSetName: (name) => { save.name = name; persist(); },
  onUpdate: () => { void checkForUpdate(); },
  onTutorial: () => startRun("solo", true),
  onShare: (c) => {
    const go = () => void shareChallenge({ ...c, name: save.name || "a friend" }).then((r) => {
      if (r === "copied") ui.toast("Link copied. Paste it to a friend.");
      if (r === "failed") ui.toast("Could not share on this device");
    });
    if (!save.name) ui.showNamePrompt(go); else go();
  },
  onAcceptChallenge: (mode) => startRun(mode),
});

const SNAP_KEY = "magnet-climbers:run:v1";
function saveSnapshot() {
  if (!game) return;
  const snap = game.snapshot();
  try {
    if (snap) localStorage.setItem(SNAP_KEY, JSON.stringify({ snap, adUsedThisRun, bankedCm, runCounted }));
    else localStorage.removeItem(SNAP_KEY);
  } catch { /* storage unavailable */ }
}
function clearSnapshot() {
  try { localStorage.removeItem(SNAP_KEY); } catch { /* ignore */ }
}
function loadSnapshot(): { snap: RunSnapshot; adUsedThisRun: boolean; bankedCm: number; runCounted: boolean } | null {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.snap?.v === 1 ? parsed : null;
  } catch { return null; }
}
setInterval(saveSnapshot, 2000);
window.addEventListener("pagehide", saveSnapshot);

let rulesNow: "solo" | "crew" = "crew";
function runEvents() {
  return {
    onPower: () => {},
    onCoins: () => {},
    onGems: () => {},
    onGameOver: () => {
      if (!game) return;
      paused = true;
      clearSnapshot();
      const cm = game.heightCm;
      const chill = game.chill;
      const bestKey = rulesNow === "solo" ? "bestSolo" : "bestCm";
      const isRecord = !chill && cm > save[bestKey];
      const newCm = Math.max(0, cm - bankedCm);
      // chill runs earn nothing: no coins, gems, records, board or global total
      const earned = chill ? 0 : game.coins + Math.floor(newCm / 4);
      if (!chill) {
        save.coins += earned;
        save.gems += game.gems;
        save[bestKey] = Math.max(save[bestKey], cm);
        save.totalCm += newCm;
        if (!runCounted) { save.runs += 1; runCounted = true; }
      }
      bankedCm = cm;
      game.coins = 0; game.gems = 0;
      save.reserves = game.reserves;
      persist();
      if (!chill && leaderboardEnabled && newCm > 0) void leaderboard.run(save.playerId, rulesNow, newCm);
      const panel = ui.showGameOver({ cm, best: save[bestKey], coins: earned, tokens: game.revivesLeft, gems: save.gems, adUsed: adUsedThisRun, isRecord, mode: rulesNow, ended: game.ended, chill });
      if (!chill) submitScore(cm, panel);
    },
  };
}

function resumeRun() {
  const r = loadSnapshot();
  if (!r) { ui.showMenu(); return; }
  rulesNow = r.snap.rules;
  adUsedThisRun = r.adUsedThisRun; bankedCm = r.bankedCm; runCounted = r.runCounted;
  ui.clear();
  paused = false;
  const palette = SKINS.find((k) => k.key === save.skin)?.colors ?? SKINS[0].colors;
  game = Game.restore(save.upgrades, runEvents(), r.snap, palette);
  game.viewH = viewH;
  game.effects.slowmo = Math.max(game.effects.slowmo, 1.5);
  ui.setInRun(true);
  ui.toast("Run resumed");
}

/** Guided first run: a solo run on a fixed seed with coaching tips driven by game state. */
const TUTORIAL_SEED = 20260913;
let tutorial: { step: number; t: number } | null = null;
const tutorialSteps: { tip: string; done: (g: Game, t: number) => boolean }[] = [
  { tip: "👆 Put a finger anywhere, drag DOWN to pull back, let go to fling up.", done: (g) => g.phase === "running" },
  { tip: "🧲 Magnets stick to steel. Aim for the shiny metal, not glass or stickers.", done: (g) => g.heightCm >= 15 },
  { tip: "🟡 Grab coins on the way. They buy upgrades and reserves between runs.", done: (g, t) => g.coins > 0 || t > 12 },
  { tip: "🔴 The red line is the kid's reach. It rises faster the higher you get. Keep moving.", done: (_g, t) => t > 6 },
  { tip: "✅ That's it. Crew mode flings the whole gang at once. Go climb.", done: (_g, t) => t > 5 },
];
function tickTutorial(dt: number) {
  if (!tutorial || !game) return;
  tutorial.t += dt;
  const step = tutorialSteps[tutorial.step];
  if (!step) { tutorial = null; ui.hideTip(); return; }
  if (step.done(game, tutorial.t)) {
    tutorial.step++; tutorial.t = 0;
    const next = tutorialSteps[tutorial.step];
    if (next) ui.showTip(next.tip);
    else { ui.hideTip(); tutorial = null; save.tutorialDone = true; persist(); }
  }
}

let pendingChallenge: ReturnType<typeof parseChallenge> = null;
function startRun(rules: "solo" | "crew", withTutorial = false) {
  rulesNow = rules;
  ui.clear();
  clearSnapshot();
  adUsedThisRun = false;
  bankedCm = 0;
  runCounted = false;
  paused = false;
  game = new Game(save.upgrades, runEvents(), withTutorial ? { rules, seed: TUTORIAL_SEED } : { rules, chill: save.chill });
  tutorial = withTutorial ? { step: 0, t: 0 } : null;
  if (pendingChallenge && pendingChallenge.mode === rules) {
    game.target = { cm: pendingChallenge.cm, name: pendingChallenge.name, beaten: false };
    pendingChallenge = null;
  }
  ui.hideTip();
  if (withTutorial) ui.showTip(tutorialSteps[0].tip);
  game.reserves = save.reserves;
  game.palette = SKINS.find((k) => k.key === save.skin)?.colors ?? SKINS[0].colors;
  for (const c of game.climbers) c.color = game.palette[(c.id - 1) % game.palette.length];
  game.viewH = viewH;
  ui.setInRun(true);
}

/** Push the run to the global board (best per player is kept server-side). */
function submitScore(cm: number, panel: HTMLElement) {
  if (!leaderboardEnabled || cm <= 0) return;
  const send = (target: HTMLElement = panel) => {
    panel = target;
    void leaderboard.submit(save.playerId, save.name || "anonymous", rulesNow, cm).then(async (r) => {
      if (!r) { ui.setGameOverRank(panel, "Scoreboard unreachable"); return; }
      const rank = await leaderboard.rank(rulesNow, save.playerId);
      ui.setGameOverRank(panel, rank?.rank ? `Global rank #${rank.rank} (${rank.cm} cm)` : "Score sent");
    });
  };
  if (!save.name) {
    // first time on the board: ask for a name, then send
    ui.showNamePrompt(() => { const again = ui.reshowGameOver(); if (again) send(again); });
    return;
  }
  send();
}

function endRun() {
  clearSnapshot();
  tutorial = null;
  ui.hideTip();
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
// Android back gesture / browser back: open the pause menu instead of leaving the run
history.replaceState({ mc: "root" }, "");
history.pushState({ mc: "trap" }, "");
window.addEventListener("popstate", () => {
  history.pushState({ mc: "trap" }, "");
  if (game && !paused && game.phase !== "dead") { paused = true; ui.showPause(); }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game && !paused && game.phase !== "dead") { paused = true; ui.showPause(); }
});

// ---------- loop ----------
let last = performance.now();
let acc = 0;
const STEP = 1 / 120;
function frame(now: number) {
  resize();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game) {
    if (!paused) {
      acc += dt;
      while (acc >= STEP) { game.update(STEP); acc -= STEP; }
      tickTutorial(dt);
    }
    render(ctx, game, viewH, dpr);
  } else {
    renderMenuBackground(ctx, viewH, dpr, now / 1000);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

pendingChallenge = parseChallenge();
clearChallengeParam();
if (pendingChallenge) { save.introSeen = true; persist(); ui.showChallenge(pendingChallenge); }
else if (loadSnapshot()) resumeRun();
else if (!save.introSeen) {
  ui.showStory(() => {
    save.introSeen = true; persist();
    const next = () => (!save.tutorialDone ? startRun("solo", true) : ui.showMenu());
    if (!save.name) ui.showNamePrompt(next, true); else next();
  });
} else if (!save.name) ui.showNamePrompt(() => ui.showMenu(), true);
else ui.showMenu();

// Debug / QA hook (harmless in production; no secrets, no cheats persisted).
declare global { interface Window { __mc?: { game: () => Game | null; save: () => unknown } } }
window.__mc = { game: () => game, save: () => save };
