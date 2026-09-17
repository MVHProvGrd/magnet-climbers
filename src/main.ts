import "./style.css";
import { setLang, detectLang } from "./game/i18n";
import { registerSW } from "virtual:pwa-register";
import { Game, type RunSnapshot } from "./game/game";
import { render, setKeyboardHints, teamTapRects, offscreenMarkers, setSafeBottom, setHintLeft } from "./game/render";
import { renderMenuBackground, renderRunBackdrop } from "./game/menu-background";
import { Ui } from "./game/ui";
import { loadPlacement } from "./game/placement";
import { loadSave, writeSave, migrateLooks } from "./game/save";
import { CFG, UPGRADES, W, upgradeCost, type UpgradeKey } from "./game/config";
import { creaturesEarned, drawPrize, prizeCost, type Look } from "./game/creatures";
import { refill, settle, type RunTally } from "./game/missions";
import { setSound, setMusic, unlockAudio, updateAudio, silenceAudio, stopPullSound, sfx } from "./game/audio";
import { leaderboard, leaderboardEnabled, cloud, chat, dailySeed, todayKey } from "./game/leaderboard";
import { parseChallenge, clearChallengeParam, shareChallenge } from "./game/share";

/**
 * Update flow: the service worker checks for a new build every 5 minutes and whenever
 * the app returns to the foreground. A ready update applies immediately on the menu;
 * during a run it waits (with a small banner) and applies when the run ends.
 * Run snapshots make the reload safe either way.
 */
let updateReady = false;
let swReg: ServiceWorkerRegistration | undefined;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateReady = true;
    if (!game) applyUpdate(); else ui.showUpdateBanner(() => applyUpdate());
  },
  onRegisteredSW(_url, r) {
    swReg = r;
    setInterval(() => void r?.update(), 5 * 60 * 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) void r?.update(); });
  },
});
function applyUpdate() {
  if (game) saveSnapshot();
  ui.toast("Updating…");
  setTimeout(() => void updateSW(true), 300);
}
/** Manual update check from the menu. */
async function checkForUpdate() {
  ui.toast("Checking for update…");
  try {
    await swReg?.update();
    if (swReg?.waiting || updateReady) { applyUpdate(); return; }
  } catch { /* fall through */ }
  setTimeout(() => location.reload(), 600);
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const menubg = document.getElementById("menubg") as HTMLCanvasElement;
const menubgCtx = menubg.getContext("2d")!;
/** The in-run backdrop is static: redrawn only after a resize or once the art loads. */
let backdropDrawn = false;
const appEl = document.getElementById("app")!;
const ctx = canvas.getContext("2d")!;
const uiRoot = document.getElementById("ui")!;

// owner workbench override, if this device has one saved (see src/placement.ts)
loadPlacement();
let save = loadSave();
setSound(save.sound);
setMusic(save.music);
document.addEventListener("pointerdown", unlockAudio, { passive: true });
document.addEventListener("keydown", unlockAudio);
const persist = () => writeSave(save);

/** Fields that travel between devices. Device-local prefs (sound, chill) stay put. */
const CLOUD_FIELDS = ["coins", "gems", "bestCm", "bestSolo", "runs", "totalCm", "upgrades", "skin", "skins", "creature", "pattern", "creatures", "patterns", "picked", "hitsTotal", "spins", "intros", "name", "avatar", "introSeen", "tutorialDone", "namePrompted"] as const;
function cloudBlob(): string {
  const out: Record<string, unknown> = {};
  for (const k of CLOUD_FIELDS) out[k] = save[k];
  return JSON.stringify(out);
}
function applyCloudBlob(blob: string) {
  try {
    const data = JSON.parse(blob) as Partial<typeof save>;
    for (const k of CLOUD_FIELDS) if (data[k] !== undefined) (save as unknown as Record<string, unknown>)[k] = data[k];
  } catch { /* ignore bad blobs */ }
}
/** Merge a newer cloud copy without losing local gains: max of records, max of wallets. */
function mergeCloudBlob(blob: string) {
  try {
    const c = JSON.parse(blob) as Partial<typeof save>;
    save.coins = Math.max(save.coins, c.coins ?? 0);
    save.gems = Math.max(save.gems, c.gems ?? 0);
    save.bestCm = Math.max(save.bestCm, c.bestCm ?? 0);
    save.bestSolo = Math.max(save.bestSolo, c.bestSolo ?? 0);
    save.runs = Math.max(save.runs, c.runs ?? 0);
    save.totalCm = Math.max(save.totalCm, c.totalCm ?? 0);
    for (const k of Object.keys(save.upgrades) as (keyof typeof save.upgrades)[]) save.upgrades[k] = Math.max(save.upgrades[k], c.upgrades?.[k] ?? 0);
    save.skins = Array.from(new Set([...save.skins, ...(c.skins ?? [])]));
    save.creatures = Array.from(new Set([...save.creatures, ...(c.creatures ?? [])]));
    save.patterns = Array.from(new Set([...save.patterns, ...(c.patterns ?? [])]));
    save.hitsTotal = Math.max(save.hitsTotal, c.hitsTotal ?? 0); save.spins = Math.max(save.spins, c.spins ?? 0);
    save.intros = Array.from(new Set([...save.intros, ...(c.intros ?? [])]));
    migrateLooks(save);
    if (c.name) save.name = c.name;
  } catch { /* ignore */ }
}
let syncing = false;
async function cloudSync(reason: string) {
  if (!leaderboardEnabled || syncing) return;
  syncing = true;
  try {
    const r = await cloud.push(save.playerId, save.token, cloudBlob(), save.cloudRev);
    if (r && "ok" in r) { save.cloudRev = r.rev; persist(); }
    else if (r && "conflict" in r) {
      mergeCloudBlob(r.blob);
      save.cloudRev = r.rev;
      persist();
      const again = await cloud.push(save.playerId, save.token, cloudBlob(), save.cloudRev);
      if (again && "ok" in again) { save.cloudRev = again.rev; persist(); }
      ui.toast("Synced with your other device");
    }
  } finally { syncing = false; }
  void reason;
}

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
let uiReady = false;
function resize(force = false) {
  const r = canvas.getBoundingClientRect();
  const cw = r.width || window.innerWidth;
  const ch = r.height || window.innerHeight;
  if (!force && cw === lastCw && ch === lastCh) return;
  lastCw = cw; lastCh = ch;
  // Panels are laid out for a 400 x 780 CSS-px phone. When the viewport is effectively smaller
  // (system font / page zoom on Android, tiny phones) they shrink to fit instead of overflowing.
  const fit = Math.min(1, window.innerWidth / 400);
  uiRoot.style.setProperty("--fit", fit.toFixed(3));
  if (uiReady) ui.refit();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const scale = cw / W;
  viewH = ch / scale;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(viewH * dpr);
  const insetPx = parseFloat(getComputedStyle(safeProbe).paddingBottom) || 0;
  // The DOM mirrors this exactly in CSS as --safe-px (scale and --px are the same number),
  // so the canvas dock and the DOM furniture agree without JS having to publish a variable
  // the stylesheet might read before it is set.
  setSafeBottom(Math.max(28, insetPx / scale + 12));
  if (game) game.viewH = viewH;
}
window.addEventListener("resize", () => resize(true));
window.visualViewport?.addEventListener("resize", () => resize(true));
window.addEventListener("orientationchange", () => setTimeout(() => resize(true), 300));
if ("ResizeObserver" in window) new ResizeObserver(() => resize(true)).observe(canvas);
resize(true);
// iOS Safari ignores user-scalable=no; block pinch/double-tap zoom explicitly
document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
canvas.addEventListener("touchmove", (e) => { if ((e as TouchEvent).touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
canvas.addEventListener("touchend", (e) => { const now = Date.now(); if (now - lastTouchEnd < 300) e.preventDefault(); lastTouchEnd = now; }, { passive: false });

setLang(save.lang || detectLang());
const ui = new Ui(uiRoot, () => save, {
  onPlay: () => startRun("solo"),
  onPlayDaily: () => startRun("solo", false, true),
  onIntroSeen: (key) => { if (!save.intros.includes(key)) { save.intros.push(key); persist(); } },
  onResume: () => { paused = false; },
  onPause: () => { paused = true; },
  onEndRun: () => { if (game) { paused = false; game.forceEnd(); } },
  onQuitRun: () => {
    void cloudSync("quit");
    if (game && game.phase !== "dead" && !game.chill) { save.coins += game.coins; save.gems += game.gems; persist(); }
    endRun(); ui.showMenu();
  },
  onBuy: (key: UpgradeKey) => {
    const def = UPGRADES.find((u) => u.key === key)!;
    const lvl = save.kit[key];
    const cost = upgradeCost(def, lvl);
    if (lvl >= def.max || save.coins < cost) return;
    save.coins -= cost;
    save.kit[key] = lvl + 1;
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
  onWear: (look) => {
    if (!save.creatures.includes(look.creature) || !save.patterns.includes(look.pattern)) return;
    save.creature = look.creature; save.pattern = look.pattern; save.skin = look.pattern; persist();
  },
  onPickFirst: (creature) => {
    if (save.picked) return;
    if (!save.creatures.includes(creature)) save.creatures.push(creature);
    save.creature = creature; save.picked = true; persist();
  },
  onSpin: () => {
    const cost = prizeCost(save.spins);
    if (save.coins < cost) return null;
    const prize = drawPrize(save.patterns);
    if (!prize) return null;
    save.coins -= cost; save.spins += 1;
    save.patterns.push(prize.id); save.skins = save.patterns;
    save.pattern = prize.id; save.skin = prize.id; persist();
    return prize;
  },
  onToggleSound: () => { save.sound = !save.sound; setSound(save.sound); persist(); },
  onToggleMusic: () => { save.music = !save.music; setMusic(save.music); persist(); },
  onSetLang: (l) => { save.lang = l; setLang(l); persist(); },
  onToggleMute: () => {
    const on = !save.sound && !save.music;
    save.sound = on; save.music = on; setSound(on); setMusic(on); persist();
  },
  onToggleChill: () => { save.chill = !save.chill; persist(); },
  onOpenBoard: () => { void resubmitBests(); },
  onLinkDevice: () => {
    void (async () => {
      await cloudSync("link");
      const r = await cloud.link(save.playerId, save.token);
      if (!r) { ui.toast("Could not reach the server"); return; }
      ui.showLinkCode(r.code, r.expiresAt);
    })();
  },
  onEnterCode: (code) => {
    void (async () => {
      const r = await cloud.claim(code);
      if (!r) { ui.showClaimError("Code not found or expired. Codes last 10 minutes."); return; }
      // remember this device's old profile so it can be folded in rather than lost
      const old = { id: save.playerId, token: save.token, coins: save.coins, gems: save.gems, bestCm: save.bestCm, bestSolo: save.bestSolo, totalCm: save.totalCm, runs: save.runs, upgrades: { ...save.upgrades }, skins: [...save.skins], creatures: [...save.creatures], patterns: [...save.patterns] };
      save.playerId = r.playerId; save.token = r.token; save.cloudRev = r.rev;
      applyCloudBlob(r.blob);
      const hadProgress = old.totalCm > 0 || old.coins > 0 || old.runs > 0;
      if (hadProgress && old.id !== save.playerId) {
        // wallet and lifetime add; records and upgrades take the higher; skins union
        save.coins += old.coins; save.gems += old.gems;
        save.totalCm += old.totalCm; save.runs += old.runs;
        save.bestCm = Math.max(save.bestCm, old.bestCm); save.bestSolo = Math.max(save.bestSolo, old.bestSolo);
        for (const k of Object.keys(save.upgrades) as (keyof typeof save.upgrades)[]) save.upgrades[k] = Math.max(save.upgrades[k], old.upgrades[k] ?? 0);
        save.skins = Array.from(new Set([...save.skins, ...old.skins]));
        save.creatures = Array.from(new Set([...save.creatures, ...old.creatures]));
        save.patterns = Array.from(new Set([...save.patterns, ...old.patterns]));
        migrateLooks(save);
        void cloud.merge(old.id, old.token, save.playerId, save.token);
      }
      persist();
      clearSnapshot();
      await cloudSync("link");
      ui.toast(hadProgress ? `Linked and merged. Welcome back, ${save.name}` : `Linked. Welcome back, ${save.name}`);
      ui.showMenu();
    })();
  },
  onSetAvatar: (id) => { save.avatar = id; persist(); void cloudSync("avatar"); },
  onSetName: (name) => {
    const changed = name !== save.name;
    save.name = name; persist();
    if (changed && leaderboardEnabled) {
      void leaderboard.rename(save.playerId, name).then((r) => {
        if (r?.ok) ui.toast(r.name === name ? "Scoreboard name updated" : `Scoreboard shows "${r.name}"`);
      });
    }
  },
  onUpdate: () => { void checkForUpdate(); },
  onTutorial: () => startRun("solo", true),
  onPerf: () => perfReport(),
  onShare: (c) => {
    const go = () => void shareChallenge({ ...c, name: save.name || "a friend", playerId: save.playerId }).then((r) => {
      if (r === "copied") ui.toast("Link copied. Paste it to a friend.");
      if (r === "failed") ui.toast("Could not share on this device");
    });
    if (!save.name) ui.showNamePrompt(go); else go();
  },
  onAcceptChallenge: () => startRun("solo"),
  onChat: async (text) => {
    if (!leaderboardEnabled) return "Chat is offline";
    if (save.cloudRev === 0) await cloudSync("chat");
    const r = await chat.send(save.playerId, save.token, save.name, text, save.avatar);
    if (!r) return "Could not reach the chat";
    // hand the stored row back: the panel shows that instead of its own optimistic copy
    return "error" in r ? r.error : r.message;
  },
});
uiReady = true;

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

let rulesNow: "solo" = "solo";
function runEvents() {
  return {
    onPower: () => {},
    onCoins: (n: number) => { runCoinsTotal += n; },
    onGems: () => {},
    onGameOver: () => {
      if (!game) return;
      paused = true;
      clearSnapshot();
      // the kit was bought for this climb and this climb is over. The run keeps the stats it
      // started with (they were read once, at the top), so a revive still climbs with the gear.
      for (const k of Object.keys(save.kit) as UpgradeKey[]) save.kit[k] = 0;
      const cm = game.heightCm;
      const chill = game.chill;
      const bestKey = rulesNow === "solo" ? "bestSolo" : "bestCm";
      const isRecord = !chill && cm > save[bestKey];
      const newCm = Math.max(0, cm - bankedCm);
      // chill runs earn no coins, gems or records; distance still counts toward the totals
      const earned = chill ? 0 : game.coins + Math.floor(newCm / 4);
      save.totalCm += newCm;
      if (!chill) {
        save.coins += earned;
        save.gems += game.gems;
        if (cm > save[bestKey]) {
          save[bestKey] = cm;
          save[rulesNow === "solo" ? "bestSoloAt" : "bestCmAt"] = Date.now();
          save[rulesNow === "solo" ? "bestSoloSeconds" : "bestCmSeconds"] = Math.round(game.runTime);
        }
        if (!runCounted) { save.runs += 1; runCounted = true; }
      }
      bankedCm = cm;
      game.coins = 0; game.gems = 0;
      game.walletCoins = save.coins; game.walletGems = save.gems;
      save.hitsTotal += game.feats.hits; game.feats.hits = 0;
      // missions read the run that just ended, pay out, and the board tops itself back up
      const tally: RunTally = { cm, coins: runCoinsTotal, gadgetRides: game.feats.gadgetRides,
        hits: game.feats.hits, paints: game.feats.paints ?? 0, seconds: Math.round(game.runTime), daily: dailyRun ? 1 : 0 };
      const settled = settle(save.missions, tally);
      save.missions = settled.board;
      if (settled.finished.length) {
        save.coins += settled.paid;
        save.missionsDone += settled.finished.length;
        save.missions = refill(save.missions, save.missionsDone);
        ui.toast(settled.finished.length === 1 ? `Mission done · $${settled.paid}` : `${settled.finished.length} missions done · $${settled.paid}`);
      }
      if (dailyRun) {
        const day = todayKey();
        save.daily = { day, cm };
        // yesterday's climb keeps the streak; a missed day starts it again at one
        const yesterday = todayKey(Date.now() - 86_400_000);
        save.streak = save.streak.last === day ? save.streak
          : { days: save.streak.last === yesterday ? save.streak.days + 1 : 1, last: day };
      }
      const earnedCreatures = creaturesEarned(save.creatures, { mode: rulesNow, cm, chill, maxChain: game.feats.maxChain, gadgetRides: game.feats.gadgetRides, coins: runCoinsTotal, hitsTotal: save.hitsTotal, paints: game.feats.paints ?? 0 });
      for (const c of earnedCreatures) save.creatures.push(c.id);
      persist();
      if (leaderboardEnabled && newCm > 0) void leaderboard.run(save.playerId, save.name, rulesNow, newCm);
      const panel = ui.showGameOver({ missions: save.missions, missionsPaid: settled.paid, cm, best: save[bestKey], cause: game.lastCause, coins: earned, tokens: game.revivesLeft, gems: save.gems, adUsed: adUsedThisRun, isRecord, mode: rulesNow, ended: game.ended, chill, unlocked: earnedCreatures, walletCoins: save.coins, walletGems: save.gems });
      if (!chill) submitScore(cm, panel);
    },
  };
}

/** The climber's look for a run. */
function lineupFor(_rules: "solo"): Look[] {
  return [{ creature: save.creature, pattern: save.pattern }];
}

function resumeRun() {
  const r = loadSnapshot();
  if (!r) { ui.showMenu(); return; }
  adUsedThisRun = r.adUsedThisRun; bankedCm = r.bankedCm; runCounted = r.runCounted; runCoinsTotal = 0;
  ui.clear();
  paused = false;
  game = Game.restore(save.kit, runEvents(), r.snap, undefined, lineupFor("solo"));
  if (!game.chill) {
    const best = game.rules === "solo" ? save.bestSolo : save.bestCm;
    if (best > 0) game.best = { cm: best, beaten: game.heightCm > best };
  }
  game.walletCoins = save.coins; game.walletGems = save.gems;
  game.viewH = viewH;
  game.effects.slowmo = Math.max(game.effects.slowmo, 1.5);
  ui.setInRun(true);
  backdropDrawn = false; appEl.classList.add("in-run");
  ui.toast("Run resumed");
}

/** Guided first run: a solo run on a fixed seed with coaching tips driven by game state. */
const TUTORIAL_SEED = 20260913;
/** Idle hint: 10 s on screen, fading over the last 3, and gone for good after the first fling. */
const HINT_SECONDS = 10;
let hintLeft: number | null = null;
function tickHint(dt: number) {
  if (hintLeft === null) return;
  hintLeft -= dt;
  if (hintLeft <= 0) { hintLeft = null; setHintLeft(null); return; }
  setHintLeft(hintLeft);
}
/** Called when a run starts; never re-shown mid-run. */
function armHint() { hintLeft = HINT_SECONDS; setHintLeft(hintLeft); }
/** First fling kills it immediately. */
function cancelHint() { if (hintLeft !== null) { hintLeft = null; setHintLeft(null); } }

let tutorial: { step: number; t: number } | null = null;
const keyboardDevice = typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches && !("ontouchstart" in window);
setKeyboardHints(keyboardDevice);
const tutorialSteps: { tip: string; done: (g: Game, t: number) => boolean }[] = [
  { tip: keyboardDevice ? "⌨️ Hold SPACE to charge the pull-back, aim with WASD, let go to fling." : "👆 Put a finger anywhere, drag DOWN to pull back, let go to fling up.", done: (g) => g.phase === "running" },
  { tip: "🧲 You stick to bare steel only. Glass, paper and plastic slide you straight off.", done: (g) => g.heightCm >= 15 },
  { tip: "🟡 Grab coins on the way up. They buy a higher jump before your next climb.", done: (g, t) => g.coins > 0 || t > 12 },
  { tip: "🔴 The red line is Cooper's reach. It speeds up the higher you get, so never stop climbing.", done: (_g, t) => t > 6 },
  { tip: "✅ That's it. When a hand lights up its path, fling clear of it. Go climb.", done: (_g, t) => t > 5 },
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
/** coins picked up this run, across revives; feeds the dino unlock */
let runCoinsTotal = 0;
/** True while the current run is today's shared climb. */
let dailyRun = false;
function startRun(rules: "solo", withTutorial = false, daily = false) {
  if (save.missions.length < 3) { save.missions = refill(save.missions, save.missionsDone); persist(); }
  void cloudPull(true);
  rulesNow = rules;
  ui.clear();
  clearSnapshot();
  adUsedThisRun = false;
  bankedCm = 0;
  runCounted = false;
  runCoinsTotal = 0;
  paused = false;
  const lineup = lineupFor(rules);
  dailyRun = daily;
  // everyone climbs the same door with the same gear, so a daily leaves the kit in the drawer
  const kit = daily ? ({ magnet: 0, power: 0, floor: 0 } as Record<UpgradeKey, number>) : save.kit;
  game = new Game(kit, runEvents(),
    withTutorial ? { rules, seed: TUTORIAL_SEED, lineup }
    : daily ? { rules, seed: dailySeed(), lineup }
    : { rules, chill: save.chill, lineup });
  tutorial = withTutorial ? { step: 0, t: 0 } : null;
  // the coached tutorial has its own bubbles; the idle hint would sit on top of them
  if (withTutorial) cancelHint(); else armHint();
  if (!withTutorial && !save.chill && !daily) {
    const best = save.bestSolo;
    if (best > 0) game.best = { cm: best, beaten: false };
  }
  if (pendingChallenge && pendingChallenge.mode === rules) {
    game.target = { cm: pendingChallenge.cm, name: pendingChallenge.name, beaten: false };
    pendingChallenge = null;
  }
  ui.hideTip();
  if (withTutorial) ui.showTip(tutorialSteps[0].tip);
  game.walletCoins = save.coins; game.walletGems = save.gems;
  game.viewH = viewH;
  ui.setInRun(true);
  backdropDrawn = false; appEl.classList.add("in-run");
}

/**
 * Re-post local bests; the server keeps the max, so a post lost to a dead connection heals
 * itself. It asks first: when the owner clears a score from the admin panel the Worker
 * remembers that, and a device whose best predates the clear drops it instead of putting
 * it straight back. Without that a deleted row simply reappeared, timeless, on the next boot.
 */
async function resubmitBests() {
  if (!leaderboardEnabled) return;
  for (const mode of ["crew", "solo"] as const) {
    const bestKey = mode === "solo" ? "bestSolo" : "bestCm";
    const atKey = mode === "solo" ? "bestSoloAt" : "bestCmAt";
    const secKey = mode === "solo" ? "bestSoloSeconds" : "bestCmSeconds";
    if (save[bestKey] <= 0) continue;
    const r = await leaderboard.rank(mode, save.playerId);
    if (r?.resetAt && r.resetAt >= (save[atKey] ?? 0)) {
      save[bestKey] = 0; save[atKey] = 0; save[secKey] = 0; persist();
      continue;
    }
    void leaderboard.submit(save.playerId, save.name, mode, save[bestKey], save[secKey] || undefined, save[atKey] || undefined);
  }
}

/** Push the run to the global board (best per player is kept server-side). */
function submitScore(cm: number, panel: HTMLElement) {
  if (!leaderboardEnabled || cm <= 0) return;
  const seconds = game ? Math.round(game.runTime) : 0;
  const board = dailyRun ? "daily" as const : rulesNow;
  const send = (target: HTMLElement = panel) => {
    panel = target;
    void leaderboard.submit(save.playerId, save.name, board, cm, seconds, Date.now()).then(async (r) => {
      if (!r) { ui.setGameOverRank(panel, "Scoreboard unreachable"); return; }
      const rank = await leaderboard.rank(board, save.playerId);
      const where = dailyRun ? "Today" : "Global";
      ui.setGameOverRank(panel, rank?.rank ? `${where} rank #${rank.rank} (${rank.cm} cm)` : "Score sent");
    });
  };
  // every finished run posts; the name is whatever the player has (a guest name if they skipped)
  send();
}

function endRun() {
  clearSnapshot();
  // the kit was for that climb: it is used up whether it carried you far or not
  for (const k of Object.keys(save.kit) as UpgradeKey[]) save.kit[k] = 0;
  persist();
  if (updateReady) setTimeout(applyUpdate, 400);
  tutorial = null;
  ui.hideTip();
  game = null;
  paused = false;
  ui.setInRun(false);
  menubg.hidden = false; appEl.classList.remove("in-run");
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
  for (const r of teamTapRects(game, viewH)) {
    if (hit(sp, r)) { game.select(r.id); return; }
  }
  for (const m of offscreenMarkers(game, viewH)) {
    if (Math.abs(m.x - sp.x) < 28 && Math.abs(m.y - sp.y) < 20) { game.select(m.id); return; }
  }
  canvas.setPointerCapture(e.pointerId);
  game.pointerDown(toWorld(e));
});
canvas.addEventListener("pointermove", (e) => { if (game && !paused) game.pointerMove(toWorld(e)); });
// Keyboard (PC): hold Space to charge the pull-back, WASD or arrows to aim (W up, S down, A/D sideways),
// release Space to fling. Tab or Q/E cycles the selected climber; C toggles move/fling; X toggles sync.
const keys = new Set<string>();
let charge = 0;
const typing = (e: KeyboardEvent) => (e.target as HTMLElement | null)?.closest?.("input, textarea, select") != null;
window.addEventListener("keydown", (e) => {
  if (typing(e) || !game || paused) return;
  const k = e.key.toLowerCase();
  if ([" ", "w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { e.preventDefault(); keys.add(k); }
  if (k === " " && !e.repeat) charge = 0;
  if (k === "tab" || k === "q" || k === "e") {
    e.preventDefault();
    const pool = game.anchored.filter((c) => !game!.climbers.some((o) => o.parent === c.id && o.state === "linked")).sort((a, b) => a.x - b.x);
    if (pool.length) { const i = pool.findIndex((c) => c.id === game!.selectedId); game.select(pool[(i + (k === "q" ? pool.length - 1 : 1)) % pool.length].id); }
  }
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase(); keys.delete(k);
  if (k === " " && game && !paused && game.drag && keyDrag) { keyDrag = false; game.pointerUp(); charge = 0; }
});
window.addEventListener("blur", () => { stopPullSound(); keys.clear(); if (game && keyDrag) { game.drag = null; keyDrag = false; } });
let keyDrag = false;
let aimAngle = 0; // radians from straight up, positive = right
/** Per frame: build the drag vector from the held keys so the usual aim dots and launch code apply. */
function tickKeys(dt: number) {
  if (!game || paused) return;
  if (!keys.has(" ")) { if (keyDrag) { stopPullSound(); game.drag = null; keyDrag = false; } return; }
  const c = game.byId(game.selectedId);
  if (!c || (c.state !== "stuck" && c.state !== "linked")) return;
  const wasCharge = charge;
  charge = Math.min(CFG.maxDrag, charge + CFG.maxDrag * dt / 0.9); // full pull after about a second
  // the sling creaks as it is drawn, same as dragging with a finger
  if (Math.floor(charge / 22) > Math.floor(wasCharge / 22)) sfx.stretch(1 + (charge / CFG.maxDrag) * 0.8);
  // aim is an angle from straight up that the keys steer smoothly: A/D swing it sideways, W brings it back up,
  // S tips it on down past the horizontal. It is kept between flings so a second shot starts where the last one aimed.
  const rate = 1.7 * dt; // radians per second
  if (keys.has("a") || keys.has("arrowleft")) aimAngle -= rate;
  if (keys.has("d") || keys.has("arrowright")) aimAngle += rate;
  if (keys.has("w") || keys.has("arrowup")) aimAngle -= Math.sign(aimAngle) * Math.min(Math.abs(aimAngle), rate);
  if (keys.has("s") || keys.has("arrowdown")) aimAngle += (aimAngle < 0 ? -1 : 1) * rate;
  aimAngle = Math.max(-Math.PI * 0.95, Math.min(Math.PI * 0.95, aimAngle));
  const ax = Math.sin(aimAngle), ay = -Math.cos(aimAngle);
  const start = { x: c.x, y: c.y };
  // launch = start - cur, so the pull-back point sits opposite the aim
  game.drag = { start, cur: { x: start.x - ax * charge, y: start.y - ay * charge } };
  keyDrag = true;
}
canvas.addEventListener("pointerup", () => { if (game && !paused) game.pointerUp(); });
canvas.addEventListener("pointercancel", () => { stopPullSound(); if (game) game.drag = null; });
// Android back gesture / browser back: open the pause menu instead of leaving the run
history.replaceState({ mc: "root" }, "");
history.pushState({ mc: "trap" }, "");
window.addEventListener("popstate", () => {
  history.pushState({ mc: "trap" }, "");
  if (game && !paused && game.phase !== "dead") { paused = true; ui.showPause(); }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) silenceAudio();
  if (document.hidden && game && !paused && game.phase !== "dead") { paused = true; ui.showPause(); }
});

// ---------- loop ----------
let last = performance.now();
let lastBgFrame = 0;
let acc = 0;
const STEP = 1 / 120;

/**
 * Frame sampler for real-phone QA: read it with `__mc.perf()` on the device.
 * A ring of the last 600 frames with sim and render timed separately, so a slow
 * frame can be attributed instead of guessed at. Costs three numbers per frame.
 */
const PERF_N = 600;
const perfFrame = new Float32Array(PERF_N), perfSim = new Float32Array(PERF_N), perfDraw = new Float32Array(PERF_N);
let perfAt = 0, perfSeen = 0;
function perfPush(frameMs: number, simMs: number, drawMs: number) {
  perfFrame[perfAt] = frameMs; perfSim[perfAt] = simMs; perfDraw[perfAt] = drawMs;
  perfAt = (perfAt + 1) % PERF_N; perfSeen++;
}
function perfReport() {
  const n = Math.min(perfSeen, PERF_N);
  if (!n) return { frames: 0 };
  const take = (a: Float32Array) => Array.from(a.subarray(0, n)).sort((x, y) => x - y);
  const f = take(perfFrame), sim = take(perfSim), draw = take(perfDraw);
  const q = (a: number[], p: number) => +a[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(2);
  return {
    frames: n,
    fps: +(1000 / (f[Math.floor(n * 0.5)] || 16.7)).toFixed(1),
    frameMs: { median: q(f, 0.5), p90: q(f, 0.9), p99: q(f, 0.99), worst: q(f, 1) },
    simMs: { median: q(sim, 0.5), p99: q(sim, 0.99), worst: q(sim, 1) },
    drawMs: { median: q(draw, 0.5), p99: q(draw, 0.99), worst: q(draw, 1) },
    janky: { over20ms: f.filter((x) => x > 20).length, over33ms: f.filter((x) => x > 33).length },
  };
}
let guideBackgroundDrawn = false;
let simMs = 0;
function frame(now: number) {
  updateAudio(!document.hidden && !paused, game && !game.chill ? Math.max(0, 1 - (game.floorY - Math.max(game.highestY, ...game.alive.map((c) => c.y))) / 400) : 0, game?.chill ?? true);
  // ResizeObserver and viewport events handle sizing without a layout read on
  // every scrolling frame. Keep the polling fallback for older WebViews.
  if (!("ResizeObserver" in window)) resize();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!ui.staticBackground || game) guideBackgroundDrawn = false;
  if (game) {
    if (!paused) {
      acc += dt;
      tickKeys(dt);
      const simT0 = performance.now();
      while (acc >= STEP) { game.update(STEP); acc -= STEP; }
      simMs = performance.now() - simT0;
      tickTutorial(dt);
      if (game.phase === "idle") tickHint(dt); else cancelHint();
    }
    const drawT0 = performance.now();
    render(ctx, game, viewH, dpr);
    // Only sample while actually playing. The ring holds 600 frames, about 10 seconds, and
    // pausing to walk to Settings takes longer than that -- sampling paused frames would
    // quietly overwrite the laggy stretch with idle menu frames and report it as healthy.
    if (!paused) perfPush(dt * 1000, simMs, performance.now() - drawT0);
    simMs = 0;
    const bw = window.innerWidth, bh = window.innerHeight;
    if (!backdropDrawn || menubg.width !== Math.round(bw * dpr) || menubg.height !== Math.round(bh * dpr)) {
      menubg.width = Math.round(bw * dpr); menubg.height = Math.round(bh * dpr);
      backdropDrawn = renderRunBackdrop(menubgCtx, bw, bh, dpr);
    }
  } else {
    // draw the title scene across the whole window (behind the centred game column).
    // It is decorative: capped pixel density and 30 fps keep it cheap on phones and big monitors.
    const bw = window.innerWidth, bh = window.innerHeight, bgDpr = Math.min(dpr, 1.5);
    if (menubg.width !== Math.round(bw * bgDpr) || menubg.height !== Math.round(bh * bgDpr)) {
      menubg.width = Math.round(bw * bgDpr); menubg.height = Math.round(bh * bgDpr);
      guideBackgroundDrawn = false;
    }
    if (!guideBackgroundDrawn && now - lastBgFrame >= 1000 / 30) {
      lastBgFrame = now;
      const ready = renderMenuBackground(menubgCtx, bh, bgDpr, now / 1000, bw);
      guideBackgroundDrawn = ui.staticBackground && ready;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, viewH);
  }
  requestAnimationFrame(frame);
}
// The canvas HUD is set in Barlow Condensed; starting before the face is ready paints one
// frame in the fallback and reflows every number. Never block the loop for long, though.
const hudFontReady = typeof document !== "undefined" && document.fonts
  ? Promise.race([
      Promise.all([
        document.fonts.load('900 46px "Barlow Condensed"'),
        document.fonts.load('800 12px "Barlow Condensed"'),
        document.fonts.load('700 16px "Barlow Condensed"'),
      ]),
      new Promise((done) => setTimeout(done, 1200)),
    ])
  : Promise.resolve();
void hudFontReady.then(() => requestAnimationFrame(frame));

/** Pull the cloud copy if another device moved it forward. Safe to call often. */
async function cloudPull(quiet = false) {
  if (!leaderboardEnabled || game) return;
  const c = await cloud.pull(save.playerId, save.token);
  if (c && c.rev > save.cloudRev) {
    mergeCloudBlob(c.blob); save.cloudRev = c.rev; persist();
    if (!quiet) ui.toast("Progress synced from your other device");
    if (!game) ui.showMenu();
  } else if (!c) void cloudSync("launch");
}
void cloudPull();
document.addEventListener("visibilitychange", () => { if (!document.hidden) void cloudPull(); });
void resubmitBests();
pendingChallenge = parseChallenge();
clearChallengeParam();
if (pendingChallenge) { save.introSeen = true; persist(); ui.showChallenge(pendingChallenge); }
else if (loadSnapshot()) resumeRun();
else if (!save.introSeen) {
  ui.showStory(() => {
    save.introSeen = true; persist();
    const next = () => (!save.tutorialDone ? startRun("solo", true) : ui.showMenu());
    if (!save.namePrompted) { save.namePrompted = true; persist(); ui.showNamePrompt(next, true); } else next();
  });
} else if (!save.namePrompted) { save.namePrompted = true; persist(); ui.showNamePrompt(() => ui.showMenu(), true); }
else ui.showMenu();

// Debug / QA hook (harmless in production; no secrets, no cheats persisted).
// Scripted-playtest hook (see CLAUDE.md). `ui` is here so screenshot QA can open a
// panel directly instead of driving the sim into the state that produces it.
declare global { interface Window { __mc?: { game: () => Game | null; save: () => unknown; ui: Ui; perf: () => unknown } } }
window.__mc = { game: () => game, save: () => save, ui, perf: perfReport };
