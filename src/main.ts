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
import { creaturesEarned, drawPrize, patternById, prizeCost, type Look } from "./game/creatures";
import { dailyBoard, liveProgress, missionById, missionText, settle, streakReward, type RunTally } from "./game/missions";
import { monthKey, themeFor, setPlainSteel } from "./game/fridge-theme";
import { setSound, setMusic, unlockAudio, updateAudio, silenceAudio, stopPullSound, sfx } from "./game/audio";
import { leaderboard, leaderboardEnabled, cloud, chat, dailySeed, todayKey } from "./game/leaderboard";
import { parseChallenge, clearChallengeParam, shareChallenge } from "./game/share";
import { groupNum } from "./game/hud";
import { Ghost, LiveGhost, loadBestTape, saveBestTape } from "./game/ghost";
import { makeRng, World } from "./game/world";
import { LiveMatch, createMatch, matchLink, type LiveResultRow } from "./game/live";
import { accountsEnabled, signIn, signOut, finishRedirect, type AuthResult } from "./game/account";
import { pushSupported, enableReminders, disableReminders } from "./game/push";
import type { Tape } from "./game/recorder";

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
setPlainSteel(save.plainSteel);
document.addEventListener("pointerdown", unlockAudio, { passive: true });
document.addEventListener("keydown", unlockAudio);
/** Bring the ledger up to the balance: whatever changed since it last looked is income or spend. */
function settleLedger() {
  const l = save.ledger;
  const dc = save.coins - l.coinsSeen, dg = save.gems - l.gemsSeen;
  if (dc > 0) l.coinsIn += dc; else l.coinsOut -= dc;
  if (dg > 0) l.gemsIn += dg; else l.gemsOut -= dg;
  l.coinsSeen = save.coins; l.gemsSeen = save.gems;
}
const persist = () => { settleLedger(); writeSave(save); };

/** Fields that travel between devices. Device-local prefs (sound, chill) stay put. */
const CLOUD_FIELDS = ["coins", "gems", "bestCm", "bestSolo", "runs", "totalCm", "upgrades", "skin", "skins", "creature", "pattern", "creatures", "patterns", "picked", "hitsTotal", "spins", "intros", "name", "avatar", "introSeen", "tutorialDone", "namePrompted", "daily", "streak", "missions", "missionsDone", "missionsDay", "ledger"] as const;
function cloudBlob(): string {
  settleLedger();
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
    settleLedger();
    if (c.ledger) {
      // both books only ever grow, so the higher figure on each side is what really happened
      // and the balance is what came in minus what went out: money spent on one phone stays spent
      const l = save.ledger;
      l.coinsIn = Math.max(l.coinsIn, c.ledger.coinsIn); l.coinsOut = Math.max(l.coinsOut, c.ledger.coinsOut);
      l.gemsIn = Math.max(l.gemsIn, c.ledger.gemsIn); l.gemsOut = Math.max(l.gemsOut, c.ledger.gemsOut);
      save.coins = Math.max(0, l.coinsIn - l.coinsOut); save.gems = Math.max(0, l.gemsIn - l.gemsOut);
      l.coinsSeen = save.coins; l.gemsSeen = save.gems;
    } else {
      // a copy from before the ledger: the higher balance, as before
      save.coins = Math.max(save.coins, c.coins ?? 0);
      save.gems = Math.max(save.gems, c.gems ?? 0);
    }
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
    // one daily climb per player, not per device: the later day wins, and on the same day
    // the better score; the streak likewise follows whichever device counted most recently
    if (c.daily && (!save.daily || c.daily.day > save.daily.day || (c.daily.day === save.daily.day && c.daily.cm > save.daily.cm))) save.daily = c.daily;
    if (c.streak && (c.streak.last > save.streak.last || (c.streak.last === save.streak.last && c.streak.days > save.streak.days))) save.streak = c.streak;
    // the day's three missions are one board, not one per device: a newer day's board replaces
    // an older one; the same day's merges by mission, keeping whichever side got further, so a
    // mission finished and paid on one phone cannot be finished and paid again on the other
    if (Array.isArray(c.missions) && typeof c.missionsDay === "string") {
      if (c.missionsDay > save.missionsDay) { save.missions = c.missions; save.missionsDay = c.missionsDay; }
      else if (c.missionsDay === save.missionsDay) {
        // two boards for one day that share nothing were rolled apart (an older build, or a
        // different done count): the cloud copy is the shared one, so it stands
        if (!save.missions.some((m) => c.missions!.some((x) => x.id === m.id))) save.missions = c.missions;
        save.missions = save.missions.map((m) => {
          const o = c.missions!.find((x) => x.id === m.id && x.n === m.n);
          return o ? { ...m, at: Math.max(m.at, o.at), done: m.done || o.done } : m;
        });
      }
    }
    save.missionsDone = Math.max(save.missionsDone, c.missionsDone ?? 0);
  } catch { /* ignore */ }
}
/**
 * Take over another profile on this phone (a link code, or an account that already plays as
 * one), folding this phone's progress into it rather than losing it. Returns whether there
 * was anything here worth folding in.
 */
async function adoptProfile(r: { playerId: string; token: string; blob: string; rev: number }): Promise<boolean> {
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
  return hadProgress && old.id !== save.playerId;
}

/** A sign-in came back from the Worker: either this profile is now the account's, or the account's profile is now this phone's. */
async function signedIn(r: AuthResult): Promise<void> {
  let merged = false;
  if (r.adopted) merged = await adoptProfile(r);
  save.account = { uid: r.uid, provider: r.provider, email: r.email }; persist();
  ui.toast(r.adopted ? (merged ? `Signed in and merged. Welcome back, ${save.name}` : `Signed in. Welcome back, ${save.name}`) : "Signed in. This climber now follows your account.");
  ui.showMenu();
}

/** Reminders on or off: the browser's permission, the Worker's list, and the switch in the save. */
async function toggleReminders(): Promise<void> {
  if (save.push) {
    await disableReminders(save.playerId, save.token);
    save.push = false; persist(); ui.showSettings(); ui.toast("Reminders off"); return;
  }
  await cloudSync("push");
  const r = await enableReminders(save.playerId, save.token);
  if (r === "on") { save.push = true; persist(); ui.toast("Reminders on: today's fridge at 6, the league on Monday, a new door on the first"); }
  else if (r === "denied") ui.toast("Notifications are blocked for this site in your browser settings");
  else if (r === "off") ui.toast("Reminders are not switched on yet");
  else ui.toast("Could not set up reminders on this device");
  ui.showSettings();
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
  // a live race has another player in it: the sheet can open, the climb does not stop for it
  onPause: () => { if (!(live && game?.tape.onEvent)) paused = true; },
  onEndRun: () => { if (game) { paused = false; game.forceEnd(); } },
  onQuitRun: () => {
    // leaving for the menu leaves the room too; a rematch needs both phones on the card
    if (live) { live.close(); live = null; }
    // quitting is ending: the height, records, missions and coins bank exactly as they do
    // when the run ends on its own, then the menu comes up over the summary
    if (game && game.phase !== "dead") game.forceEnd();
    endRun(); ui.showMenu();
    void cloudSync("quit");
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
    // One fridge, one go. A bought or watched-for second life on the daily is a longer run
    // than everyone else got on the same door, which is the whole point of a shared board.
    if (dailyRun) return;
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
  onToggleReminders: () => { void toggleReminders(); },
  onTogglePlainSteel: () => { save.plainSteel = !save.plainSteel; setPlainSteel(save.plainSteel); backdropDrawn = false; persist(); },
  onSetLang: (l) => { save.lang = l; setLang(l); persist(); },
  onToggleMute: () => {
    const on = !save.sound && !save.music;
    save.sound = on; save.music = on; setSound(on); setMusic(on); persist();
  },
  onToggleChill: () => { save.chill = !save.chill; persist(); },
  onToggleAutoKit: (on: boolean) => { save.autoKit = on; persist(); },
  onRaceBest: () => { const tape = loadBestTape(); if (tape) startRun("solo", false, false, tape); },
  onLiveRace: async () => {
    const id = await createMatch();
    if (!id) { ui.toast("Live races are offline right now"); return; }
    joinLive(id, true);
  },
  bestTapeCm: () => { const tape = loadBestTape(); return tape && !tape.chill ? tape.cm : null; },
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
      const merged = await adoptProfile(r);
      ui.toast(merged ? `Linked and merged. Welcome back, ${save.name}` : `Linked. Welcome back, ${save.name}`);
      ui.showMenu();
    })();
  },
  onSignIn: (provider) => {
    void (async () => {
      if (!accountsEnabled) { ui.toast("Accounts are not switched on yet"); return; }
      try {
        // the account is tied to the profile on file, so the profile goes up first
        await cloudSync("auth");
        ui.toast("Opening sign-in…");
        const r = await signIn(provider, save.playerId, save.token);
        if (r) await signedIn(r);
      } catch (err) {
        ui.toast(`Sign-in failed: ${String((err as Error).message ?? err).slice(0, 60)}`);
      }
    })();
  },
  onSignOut: () => {
    void signOut().catch(() => {});
    // the profile stays on this phone; only the tie to the account is forgotten here
    save.account = null; persist(); ui.showSettings();
    ui.toast("Signed out. Your climber is still here.");
  },
  onSetAvatar: (id) => { save.avatar = id; persist(); void cloudSync("avatar"); },
  onSetName: (name) => {
    const changed = name !== save.name;
    save.name = name; persist();
    if (changed && leaderboardEnabled) {
      void leaderboard.rename(save.playerId, save.token, name).then((r) => {
        if (r?.ok) ui.toast(r.name === name ? "Scoreboard name updated" : `Scoreboard shows "${r.name}"`);
      });
    }
  },
  onUpdate: () => { void checkForUpdate(); },
  onTutorial: () => startRun("solo", true),
  onPerf: () => perfReport(),
  onShare: (c) => {
    const go = async () => {
      if (c.mode === "daily") {
        // the day's card: the Worker looks the rank up itself, the streak rides the link
        const r = await shareChallenge({ mode: "daily", cm: c.cm, name: save.name || "a friend", playerId: save.playerId, day: save.daily?.day ?? todayKey(), streak: save.streak.days });
        if (r === "copied") ui.toast("Link copied. Paste it to a friend.");
        if (r === "failed") ui.toast("Could not share on this device");
        return;
      }
      // the run behind the number: the one just climbed, or the best on this device
      const best = loadBestTape();
      const tape = lastTape && lastTape.cm === c.cm ? lastTape : best && best.cm === c.cm ? best : null;
      const posted = tape && leaderboardEnabled ? await leaderboard.race.post(save.playerId, save.token, save.name || "a friend", tape) : null;
      const r = await shareChallenge({ mode: "solo", cm: c.cm, name: save.name || "a friend", playerId: save.playerId, ...(posted?.id ? { raceId: posted.id } : {}) });
      if (r === "copied") ui.toast(posted?.id ? "Race link copied. Paste it to a friend." : "Link copied. Paste it to a friend.");
      if (r === "failed") ui.toast("Could not share on this device");
    };
    if (!save.name) ui.showNamePrompt(go); else go();
  },
  onAcceptChallenge: async (mode) => {
    // a daily card: today's climb, with their height as the line, if today's is still open
    if (mode === "daily") {
      if (save.daily?.day === todayKey()) { pendingChallenge = null; ui.showBoard("daily"); return; }
      if (pendingChallenge?.day !== todayKey()) pendingChallenge = null;
      startRun("solo", false, true); return;
    }
    // a race link brings the friend's tape down and their ghost climbs the same fridge; a
    // tape that cannot be had, or is from another shape of recorder, leaves the line alone
    const id = pendingChallenge?.raceId;
    if (id) {
      ui.toast("Fetching their run…");
      const r = await leaderboard.race.get(id);
      const t = r?.tape as Tape | undefined;
      if (t && t.v === 1 && Array.isArray(t.events) && t.events.length) { startRun("solo", false, false, t); return; }
      ui.toast("Could not fetch their run; racing the line instead");
    }
    startRun("solo");
  },
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
    if (snap) localStorage.setItem(SNAP_KEY, JSON.stringify({ snap, adUsedThisRun, bankedCm, runCounted, dailyRun, runCoinsTotal }));
    else localStorage.removeItem(SNAP_KEY);
  } catch { /* storage unavailable */ }
}
function clearSnapshot() {
  try { localStorage.removeItem(SNAP_KEY); } catch { /* ignore */ }
}
function loadSnapshot(): { snap: RunSnapshot; adUsedThisRun: boolean; bankedCm: number; runCounted: boolean; dailyRun?: boolean; runCoinsTotal?: number } | null {
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
      save.hitsTotal += game.feats.hits;
      // the tape of your best climb is kept for the ghost that will draw it; a daily's tape
      // always goes with its score, because the Worker replays it rather than trusting the number
      const tape = !chill && cm > 0 ? game.sealTape(dailyRun, { creature: save.creature, pattern: save.pattern }) : null;
      if (tape && cm >= save.bestSolo) saveBestTape(tape);
      dailyTape = dailyRun ? tape : null;
      lastTape = dailyRun ? null : tape;
      const wasLive = !!(live && game.tape.onEvent);
      if (wasLive) { game.tape.onEvent = null; live!.finish(tape, cm); }
      // the fridge of the month pays its pattern the first time you finish a climb on it
      const month = monthKey();
      if (save.themeMonth !== month) {
        const theme = themeFor();
        save.themeMonth = month;
        if (!save.patterns.includes(theme.pattern)) {
          save.patterns.push(theme.pattern); save.skins = save.patterns;
          ui.toast(`${theme.name} · ${patternById(theme.pattern).name} is yours`);
        }
      }
      // missions read the run that just ended, pay out, and the board tops itself back up
      const tally: RunTally = { cm, coins: runCoinsTotal, gadgetRides: game.feats.gadgetRides,
        hits: game.feats.hits, paints: game.feats.paints ?? 0, seconds: Math.floor(game.time), daily: dailyRun ? 1 : 0,
        unhurtCm: game.feats.hits === 0 ? game.heightCm : game.feats.unhurtCm ?? 0 };
      const settled = settle(save.missions, tally);
      // banked into the lifetime count above; zeroed only now the tally has read them
      game.feats.hits = 0;
      save.missions = settled.board;
      if (settled.finished.length) {
        save.coins += settled.paid;
        save.missionsDone += settled.finished.length;
        ui.toast(settled.finished.length === 1 ? `Mission done · $${settled.paid}` : `${settled.finished.length} missions done · $${settled.paid}`);
      }
      if (dailyRun) {
        const day = todayKey();
        save.daily = { day, cm };
        // yesterday's climb keeps the streak; a missed day starts it again at one
        const yesterday = todayKey(Date.now() - 86_400_000);
        if (save.streak.last !== day) {
          save.streak = { days: save.streak.last === yesterday ? save.streak.days + 1 : 1, last: day };
          // the climb itself pays: coins that grow with the streak, a pattern on the seventh day
          const reward = streakReward(save.streak.days);
          if (reward.pattern) {
            const prize = drawPrize(save.patterns);
            if (prize) {
              save.patterns.push(prize.id); save.skins = save.patterns;
              ui.toast(`${save.streak.days} days running · ${prize.name} unlocked`);
            } else { save.coins += 200; ui.toast(`${save.streak.days} days running · $200`); }
          } else if (reward.coins) {
            save.coins += reward.coins;
            ui.toast(`Day ${save.streak.days} · $${reward.coins}`);
          }
        }
      }
      const earnedCreatures = creaturesEarned(save.creatures, { mode: rulesNow, cm, chill, maxChain: game.feats.maxChain, gadgetRides: game.feats.gadgetRides, coins: runCoinsTotal, hitsTotal: save.hitsTotal, paints: game.feats.paints ?? 0 });
      for (const c of earnedCreatures) save.creatures.push(c.id);
      persist();
      // the daily climb is spent for every device the moment it ends, not when this one quits
      if (dailyRun) void cloudSync("daily");
      if (leaderboardEnabled && newCm > 0) void leaderboard.run(save.playerId, save.token, save.name, rulesNow, newCm, save.totalCm);
      const panel = ui.showGameOver({ missions: save.missions, missionsPaid: settled.paid, cm, best: save[bestKey], cause: game.lastCause, coins: earned, tokens: game.revivesLeft, gems: save.gems, adUsed: adUsedThisRun, isRecord, mode: rulesNow, ended: game.ended, chill, daily: dailyRun, race: wasLive, unlocked: earnedCreatures, walletCoins: save.coins, walletGems: save.gems });
      if (wasLive) { livePanel = panel; ui.setGameOverRank(panel, `Waiting for ${liveThem || "your friend"}…`); }
      // once, after a daily: the moment a reminder for tomorrow's makes sense
      if (dailyRun && !save.push && !save.pushAsked && pushSupported()) {
        save.pushAsked = true; persist();
        ui.addGameOverAction(panel, "REMIND ME TOMORROW", () => { void toggleReminders(); });
      }
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
  adUsedThisRun = r.adUsedThisRun; bankedCm = r.bankedCm; runCounted = r.runCounted;
  // a daily climb reloaded mid-run is still the daily climb: one go, no revives, its own board
  dailyRun = r.dailyRun ?? false; runCoinsTotal = r.runCoinsTotal ?? 0;
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
/** The recorded climb running beside this one, when the player asked to race it. */
let ghost: Ghost | LiveGhost | null = null;
/** the live race this phone is in, from the lobby until the result lands */
let live: LiveMatch | null = null;
let liveThem = "";
/** the two seats, in order, when this phone is watching a race rather than in it */
let liveWatching: string[] = [];
/** the game-over card of a live run, where the result goes when the room has replayed both tapes */
let livePanel: HTMLElement | null = null;
/** the generator's version on this build: both phones in a race must agree, or the fridges differ */
const WORLD_VERSION = new World(1, 0).version;

/**
 * Join a live race room, as its maker or by a friend's link. The lobby stays up until the
 * room says start; the run then begins on the seed the room dealt, with the other player's
 * inputs arriving as they happen and driving a ghost beside your own toy.
 */
function joinLive(id: string, host = false): void {
  if (!leaderboardEnabled) { ui.toast("Live races are offline"); ui.showMenu(); return; }
  live?.close();
  const link = matchLink(id);
  const share = async () => {
    const text = `Race me live up the fridge in Magnet Climbers:`;
    try { if (navigator.share) { await navigator.share({ title: "Magnet Climbers", text, url: link }); return; } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(`${text} ${link}`); ui.toast("Link copied. Send it to a friend."); } catch { ui.toast("Could not copy the link"); }
  };
  const panel = ui.showLiveLobby({ link, status: "Connecting…", host, onShare: () => void share(), onCancel: () => { live?.bye(); live = null; ui.showMenu(); } });
  let liveSeed = 0;
  const m = new LiveMatch(id, {
    // the other seat may be held by a phone that stepped away (off texting the link, say)
    wait: (others) => {
      const o = others[0];
      ui.setLiveStatus(panel, !o ? (host ? "Waiting for a friend to open the link…" : "Nobody else here yet. Waiting…")
        : o.present ? `${o.name} is here. Starting…` : `Waiting for ${o.name} to come back to the game…`);
    },
    start: (seed, world, them, countdownMs, players) => {
      // the room resends the start to a phone that reconnects mid-race: same seed, same run, carry on
      if (game && seed === liveSeed) return;
      liveSeed = seed; liveThem = them.name;
      startRun("solo", false, false, null, { seed, world, look: them.look, countdownMs, watch: players });
    },
    input: (e, from) => {
      const g2 = game?.ghost2;
      if (game?.spectator && from && liveWatching[1] === from && g2 instanceof LiveGhost) g2.feed(e);
      else if (ghost instanceof LiveGhost) ghost.feed(e);
    },
    again: () => ui.toast(`${liveThem || "Your friend"} wants another go`),
    watching: (players) => { liveWatching = players.map((p) => p.id); ui.setLiveStatus(panel, players.length ? `Watching ${players.map((p) => p.name).join(" v ")}…` : "Watching. Waiting for two climbers…"); },
    // the ghost stops where the friend's run did and stays drawn there, so you can see what you are beating
    ended: (cm) => {
      if (ghost instanceof LiveGhost) ghost.end();
      // their climb is over; if you are already above where it ended the race is decided, and
      // the result comes now rather than after you fall
      if (game && !game.spectator && game.phase !== "dead" && game.tape.onEvent && game.heightCm > cm) {
        ui.toast(`${liveThem} finished at ${groupNum(cm)} cm · you are above it`);
        paused = false; game.forceEnd();
        return;
      }
      ui.toast(`${liveThem} finished at ${groupNum(cm)} cm · their ghost stays where it got to`);
    },
    left: (name) => {
      // before the start there is no race to leave, only a lobby the other phone closed
      if (!game) { ui.setLiveStatus(panel, `${name || "Your friend"} closed the race. Send the link back to try again, or cancel.`); return; }
      if (ghost instanceof LiveGhost) ghost.end(); ui.toast(`${liveThem} left the race · their ghost stays where it got to`);
    },
    result: (rows, winner) => showLiveResult(rows, winner),
    refused: (why) => {
      // a full room is still worth a look: the phone goes back in as a watcher
      if (why === "full") { ui.setLiveStatus(panel, "Two climbers already. Watching instead…"); m.watch(); return; }
      ui.toast("Your friend is on another build; update and try again"); live = null; ui.showMenu();
    },
    closed: () => { if (game && live) ui.toast("Lost the race connection"); },
  });
  live = m;
  m.connect({ id: save.playerId, name: save.name || "a friend", world: WORLD_VERSION, look: { creature: save.creature, pattern: save.pattern } });
}

function showLiveResult(rows: LiveResultRow[], winner: string | null): void {
  const me = rows.find((r) => r.id === save.playerId), them = rows.find((r) => r.id !== save.playerId);
  const mine = me ? `${groupNum(me.cm)} cm` : "—", theirs = them ? `${groupNum(them.cm)} cm` : "—";
  const text = !me || !them ? "Race over"
    : winner === save.playerId ? `You won the race · ${mine} vs ${theirs}`
    : winner ? `${them.name} won the race · ${theirs} vs ${mine}`
    : `Dead heat · ${mine} each`;
  const note = me && !me.verified ? " · your run could not be verified" : "";
  if (livePanel) {
    ui.setGameOverRank(livePanel, text + note);
    // the room stays open for another go; both phones have to ask
    if (live && !game?.spectator) { const m = live; ui.addGameOverAction(livePanel, "RACE AGAIN", () => m.again()); }
  } else ui.toast(text);
  if (game?.spectator) { endRun(); ui.showMenu(); }
  livePanel = null;
}
/**
 * A ghost is only meaningful on the door it was recorded on, so racing one and generating a
 * fresh fridge are the same decision: the tape hands over its seed, or there is no ghost.
 */
/**
 * Three missions for the day, rolled once and then left alone. They used to be replaced the
 * instant one was finished, so the board a player looked at after a run was rarely the board
 * they had been climbing for: the thing they had just earned disappeared and a stranger stood
 * in its place. Now the day's three stay up, finished ones included, until tomorrow.
 */
/**
 * The mission nearest to finishing, refreshed a few times a second rather than every frame:
 * the numbers it reads only move when something is collected, and a DOM write per frame is a
 * cost the run does not need to pay to tell a player they are two gadgets short.
 */
let missionTick = 0;
/** Missions already at their target this run, and how long the banner has left on one. */
const missionHit = new Set<string>();
let missionCheer = 0;
let missionCheerId = "";
export function resetMissionStrip(): void { missionHit.clear(); missionCheer = 0; missionCheerId = ""; }

function updateMissionStrip(dt: number): void {
  if (!game) return;
  // the game-over card covers the door and carries the same three rows itself
  if (game.phase === "dead") { ui.setMissionStrip(null); return; }
  missionCheer = Math.max(0, missionCheer - dt);
  missionTick -= dt;
  if (missionTick > 0) return;
  missionTick = 0.25;
  // seconds comes off game.time, the same clock the HUD's TIME shows. runTime does not start
  // until the first fling, so a mission counting that always ran a few seconds behind the
  // number on screen -- 80/120 under a clock reading 1:23.
  const run: RunTally = { cm: game.heightCm, coins: runCoinsTotal, gadgetRides: game.feats.gadgetRides,
    hits: game.feats.hits, paints: game.feats.paints ?? 0, seconds: Math.floor(game.time), daily: dailyRun ? 1 : 0,
        unhurtCm: game.feats.hits === 0 ? game.heightCm : game.feats.unhurtCm ?? 0 };

  // A mission that hits its target has to say so and then get out of the way. Holding the
  // strip on a finished one, as it first did, meant the next mission was never mentioned --
  // you could complete two in a run and only ever be told about the first.
  let next: { text: string; pct: number; done: boolean } | null = null;
  for (const m of save.missions) {
    if (m.done) continue;
    if (missionById(m.id)?.stat === "daily" && !dailyRun) continue;
    const at = liveProgress(m, run);
    if (at >= m.n) {
      if (!missionHit.has(m.id)) { missionHit.add(m.id); missionCheer = 3; missionCheerId = m.id; sfx.chime(); }
      continue;
    }
    const pct = (at / m.n) * 100;
    const text = `${missionText(m)} \u00b7 ${groupNum(Math.floor(at))}/${groupNum(m.n)}`;
    if (!next || pct > next.pct) next = { text, pct, done: false };
  }

  // the cheer wins the slot while it lasts, then the next unfinished mission takes over
  if (missionCheer > 0 && missionCheerId) {
    const m = save.missions.find((x) => x.id === missionCheerId);
    if (m) { ui.setMissionStrip(`${missionText(m)} \u00b7 DONE`, 100, true); return; }
  }
  // nothing left to chase: say what the run has banked rather than sitting on a stale bar
  if (!next && missionHit.size) { ui.setMissionStrip(`${missionHit.size} missions done this run`, 100, true); return; }
  ui.setMissionStrip(next?.text ?? null, next?.pct ?? 0, false);
}

function ensureDailyMissions(): void {
  const today = todayKey();
  // A board already in a save may hold a mission from before the targets were day-sized --
  // "take the daily climb 2 days running", which a board that forgets overnight can never
  // finish. Anything asking for more than its definition now offers is rolled away.
  const stale = save.missions.some((m) => {
    const def = missionById(m.id);
    return !def || !def.targets.includes(m.n);
  });
  if (!stale && save.missionsDay === today && save.missions.length === 3) return;
  // rolled from the player and the day, not from chance, so a second device rolls the same
  // three and the boards merge by mission instead of standing side by side
  save.missions = dailyBoard(save.missionsDone, makeRng(dailySeed(`${save.playerId}:${today}`)));
  save.missionsDay = today;
  persist();
}

/** 3, 2, 1, GO before a race: the door is up and frozen, then both climbers are let go together. */
function countdown(ms: number, then?: () => void): void {
  paused = true;
  const beat = Math.max(400, Math.floor(ms / 3));
  let n = 3;
  const tick = () => {
    if (!game) return;
    if (n > 0) { ui.showCountdown(String(n), beat); sfx.tick(); n--; setTimeout(tick, beat); return; }
    ui.showCountdown("🏁 GO", 900); sfx.bell();
    paused = false; then?.();
  };
  tick();
}

function startRun(rules: "solo", withTutorial = false, daily = false, raceTape: Tape | null = null, liveRace: { seed: number; world: number; look?: { creature: string; pattern: string }; countdownMs?: number; watch?: { id: string; name: string; look?: { creature: string; pattern: string } }[] } | null = null) {
  ensureDailyMissions();
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
  // everyone climbs the same door with the same gear, so a daily or a live race leaves the kit in the drawer
  const kit = daily || liveRace ? ({ magnet: 0, power: 0, floor: 0 } as Record<UpgradeKey, number>) : save.kit;
  // a first-ever run's first three flings catch from a little further: the first lesson is
  // that flinging works, not that it can miss
  const forgiveFlings = save.runs === 0 && !liveRace && !raceTape ? 3 : 0;
  game = new Game(kit, runEvents(),
    withTutorial ? { rules, seed: TUTORIAL_SEED, lineup, forgiveFlings }
    : daily ? { rules, seed: dailySeed(), lineup, forgiveFlings }
    : liveRace ? { rules, seed: liveRace.seed, worldVersion: liveRace.world, chill: !!liveRace.watch, lineup }
    : raceTape ? { rules, seed: raceTape.seed, worldVersion: raceTape.world, chill: save.chill, lineup }
    : { rules, chill: save.chill, lineup, forgiveFlings });
  // the ghost wears last time's colours so the two climbers are never mistaken for each other
  // the ghost wears the look its run was climbed in (a friend's, from the room or the tape),
  // or last time's colours for your own best, so the two climbers are never mistaken
  const mine = { creature: save.creature, pattern: save.pattern };
  ghost = liveRace ? new LiveGhost(liveRace.seed, liveRace.world, ((liveRace.watch?.[0]?.look ?? liveRace.look) as Look | undefined) ?? mine)
    : raceTape ? new Ghost(raceTape, mine) : null;
  game.ghost = ghost;
  if (liveRace?.watch) {
    // watching: the two seats are the two ghosts, nothing here is played, the line is off
    game.spectator = true;
    game.ghost2 = new LiveGhost(liveRace.seed, liveRace.world, (liveRace.watch[1]?.look as Look | undefined) ?? mine);
    liveWatching = liveRace.watch.map((p) => p.id);
    liveThem = liveRace.watch.map((p) => p.name).join(" v ");
  }
  // every input goes to the room the moment it is played; the other phone's ghost is driven by it
  if (liveRace && live && !liveRace.watch) { const m = live; game.tape.onEvent = (e) => m.input(e); }
  if (!liveRace) livePanel = null;
  tutorial = withTutorial ? { step: 0, t: 0 } : null;
  // the coached tutorial has its own bubbles; the idle hint would sit on top of them
  if (withTutorial) cancelHint(); else armHint();
  if (!withTutorial && !save.chill && !daily) {
    const best = save.bestSolo;
    if (best > 0) game.best = { cm: best, beaten: false };
  }
  if (pendingChallenge && (pendingChallenge.mode === rules || (pendingChallenge.mode === "daily" && daily))) {
    game.target = { cm: pendingChallenge.cm, name: pendingChallenge.name, beaten: false };
    pendingChallenge = null;
  }
  ui.hideTip();
  if (withTutorial) ui.showTip(tutorialSteps[0].tip);
  game.walletCoins = save.coins; game.walletGems = save.gems;
  game.viewH = viewH;
  ui.setInRun(true);
  backdropDrawn = false; appEl.classList.add("in-run");
  // every run starts on a count: a full one for a race, a brisk one on your own; the coached
  // first run skips it so its first bubble is the first thing seen
  if (!withTutorial) countdown(liveRace?.countdownMs ?? (raceTape ? 3000 : 1800));
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
    void leaderboard.submit(save.playerId, save.token, save.name, mode, save[bestKey], save[secKey] || undefined, save[atKey] || undefined);
  }
}

/** Push the run to the global board (best per player is kept server-side). */
/** The tape of the daily run that just ended, sealed at game over for the score post. */
let dailyTape: Tape | null = null;
/** the tape of the run just finished, so sharing it can send the ghost along with the number */
let lastTape: Tape | null = null;
function submitScore(cm: number, panel: HTMLElement) {
  if (!leaderboardEnabled || cm <= 0) return;
  const seconds = game ? Math.round(game.runTime) : 0;
  const board = dailyRun ? "daily" as const : rulesNow;
  const send = (target: HTMLElement = panel) => {
    panel = target;
    void leaderboard.submit(save.playerId, save.token, save.name, board, cm, seconds, Date.now(), dailyRun ? dailyTape ?? undefined : undefined).then(async (r) => {
      if (!r) { ui.setGameOverRank(panel, "Scoreboard unreachable"); return; }
      // the Worker could not confirm the climb: say so rather than pretend it counted
      if (dailyRun && r.verified === false) { ui.setGameOverRank(panel, r.reason === "no tape" ? "Update the app to post to the daily" : "Climb could not be verified"); return; }
      const rank = await leaderboard.rank(board, save.playerId);
      const where = dailyRun ? "Today" : "Global";
      // the Worker is still climbing the tape again; the row stands meanwhile and is cut if the replay disagrees
      const pending = dailyRun && r.verified === "pending" ? " · being checked" : "";
      ui.setGameOverRank(panel, (rank?.rank ? `${where} rank #${rank.rank} (${rank.cm} cm)` : "Score sent") + pending);
    });
  };
  // every finished run posts; the name is whatever the player has (a guest name if they skipped)
  send();
}

function endRun() {
  clearSnapshot();
  ghost = null;
  ui.setMissionStrip(null);
  resetMissionStrip();
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
      while (acc >= STEP) {
        game.update(STEP);
        // the ghost takes the same step, so a pause or a slow-motion pickup moves both; a live
        // friend does not wait for your first fling, their run is already going
        if (ghost && !ghost.done && (game.phase === "running" || ghost instanceof LiveGhost)) ghost.step(STEP);
        const g2 = game.ghost2;
        if (g2 instanceof LiveGhost && !g2.done) g2.step(STEP);
        if (game.spectator) {
          // the toy that is not played sits where the leading ghost is, so the camera follows the race
          const lead = [game.ghost, g2].map((x) => x?.climber).filter((c): c is NonNullable<typeof c> => !!c).sort((a, b) => a.y - b.y)[0];
          const me = game.climbers[0];
          if (lead && me) { me.x = lead.x; me.y = lead.y; game.highestY = Math.min(game.highestY, lead.y); }
        }
        acc -= STEP;
      }
      simMs = performance.now() - simT0;
      tickTutorial(dt);
      updateMissionStrip(dt);
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
  // The daily board on the Worker knows whether today's climb was taken, whichever device
  // took it and whatever build that device was on: a row there marks the day here too.
  const today = todayKey();
  if (save.daily?.day !== today) {
    const r = await leaderboard.rank("daily", save.playerId).catch(() => null);
    if (r && r.cm != null && (r as { day?: string }).day === today && !game) {
      save.daily = { day: today, cm: r.cm }; persist();
      ui.showMenu();
    }
  }
}
void cloudPull();
document.addEventListener("visibilitychange", () => { if (!document.hidden) void cloudPull(); });
// an installed app that left for Google or Apple to sign in lands back here with the result
void finishRedirect(save.playerId, save.token).then((r) => { if (r) void signedIn(r); }).catch((err) => ui.toast(`Sign-in failed: ${String((err as Error).message ?? err).slice(0, 60)}`));
void resubmitBests();
// before anything draws a menu, so the board is today's rather than yesterday's
ensureDailyMissions();
pendingChallenge = parseChallenge();
clearChallengeParam();
// a live race link: straight into the room, the story can wait
const liveId = new URLSearchParams(location.search).get("m") ?? "";
if (/^[a-z0-9]{6,16}$/.test(liveId)) { const u = new URL(location.href); u.searchParams.delete("m"); history.replaceState(history.state, "", u.pathname + u.search + u.hash); }
const openWhat = new URLSearchParams(location.search).get("open") ?? "";
if (openWhat) { const u = new URL(location.href); u.searchParams.delete("open"); history.replaceState(history.state, "", u.pathname + u.search + u.hash); }
if (/^[a-z0-9]{6,16}$/.test(liveId)) { save.introSeen = true; persist(); joinLive(liveId, false); }
else if (openWhat === "daily" && save.introSeen) { ui.showMenu(); if (save.daily?.day === todayKey()) ui.showBoard("daily"); }
else if (openWhat === "league" && save.introSeen) ui.showBoard("league");
else if (pendingChallenge) { save.introSeen = true; persist(); ui.showChallenge(pendingChallenge); }
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
