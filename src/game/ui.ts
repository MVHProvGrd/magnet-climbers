import { SHOP_ENABLED, UPGRADES, statsFor, upgradeCost, type UpgradeKey } from "./config";
import { accountsEnabled } from "./account";
import { nextDayStart } from "./day";
import { pushSupported } from "./push";
import { sfx } from "./audio";
import { missionText, streakReward, type Mission } from "./missions";
import { FRIDGE_THEMES, themeFor } from "./fridge-theme";
import { CREATURES, PATTERNS, prizeCost, PRIZE_ODDS, appearanceFor, creatureById, patternColors, unlockText, type CreatureDef, type CreatureId, type Look, type PatternDef } from "./creatures";
import { drawClimber } from "./climber-render";
import { resetRagdoll } from "./ragdoll";
import type { Climber } from "./types";
import type { DeathCause } from "./game";
import type { SaveData } from "./save";
import { leaderboard, leaderboardEnabled, chat, apiBase, checkAdminKey, todayKey, type BoardMode, type ScoreRow, type ChatMessage, type LeagueStanding } from "./leaderboard";
import { AVATARS, avatarHtml, avatarById } from "./avatars";
import { nameReason } from "./profanity";
import { howToSections } from "./how-to-play";
import { LANGS, lang, t, translateTree, watchTree, type Lang } from "./i18n";
import { setChatStrip, groupNum } from "./hud";
import { installState, promptInstall, onInstallChange, markInstallAsked, shouldOfferInstall } from "./install";

export interface UiHandlers {
  onPlay(rules: "solo"): void;
  /** Today's shared climb: same fridge for everyone, one attempt. */
  onPlayDaily(): void;
  onIntroSeen(key: string): void;
  onResume(): void;
  /** the MENU button: freeze the sim before the pause panel shows */
  onPause(): void;
  onQuitRun(): void;
  onEndRun(): void;
  onBuy(key: UpgradeKey): void;
  /** Wear a creature and a pattern. */
  onWear(look: Look): void;
  /** The one-time free creature choice. */
  onPickFirst(creature: string): void;
  /** Spend coins on the prize machine; null when unaffordable or the collection is complete. */
  onSpin(): PatternDef | null;
  onRevive(method: "token" | "ad" | "gems"): void;
  onToggleSound(): void;
  onToggleMusic(): void;
  /** Keep the plain stainless door all year; the month's pattern is still earned. */
  onTogglePlainSteel(): void;
  /** Reminders: today's fridge at six, the league on Monday, the month's door on the first. */
  onToggleReminders(): void;
  /** Public chat is opt-in and off by default; this is the only thing that turns it on. */
  onToggleChat(): void;
  /** HUD speaker button: silences (or restores) both music and effects. */
  onToggleMute(): void;
  onToggleChill(): void;
  /** Buy the kit without asking, every climb. */
  onToggleAutoKit(on: boolean): void;
  /** Climb the door your best run was recorded on, with that run drawn beside you. */
  onRaceBest(): void;
  /** Open a live race room and wait for a friend to join by link. */
  onLiveRace(): void;
  /** Whether there is a tape to race, and how far it got. */
  bestTapeCm(): number | null;
  onSetLang(lang: Lang): void;
  onSetName(name: string): void;
  onSetAvatar(id: string): void;
  onUpdate(): void;
  onLinkDevice(): void;
  /** Sign in with Google or Apple; the profile follows the account across phones. */
  onSignIn(provider: "google" | "apple"): void;
  onSignOut(): void;
  onOpenBoard(): void;
  onEnterCode(code: string): void;
  onTutorial(): void;
  /** Frame-time report for on-device performance QA (see main.ts perfReport). */
  onPerf(): unknown;
  onShare(c: { mode: "solo" | "daily"; cm: number }): void;
  onAcceptChallenge(mode: "solo" | "daily"): void;
  /** Global chat send: the stored message on success, an error string, or null if unreachable. */
  onChat(text: string): Promise<ChatMessage | string | null>;
}

/** newest chat id the player has looked at (per device) */
/**
 * Last messages we saw, kept in memory and mirrored to localStorage.
 *
 * The panel used to open on "Loading..." and sit blank for the round trip. Chat is a
 * read-mostly list, so paint the last known messages immediately and let the poll correct
 * them. A reopen is then instant, and a cold start still shows the previous session.
 */
/** Kept on the device for an instant reopen. The open panel holds more than this:
 *  scrolling to the top pulls older pages from the Worker, which are not cached. */
const CHAT_CACHE_KEY = "mc-chat-cache", CHAT_CACHE_MAX = 60;
/** Rows the open panel will render at once, live plus whatever has been scrolled back to. */
const CHAT_VIEW_MAX = 400;
/**
 * Players this device has blocked. Blocking is local and immediate: their messages
 * stop rendering here whatever the Worker sends. The flag is also posted so the
 * owner can see who is being complained about, but nothing waits on that.
 */
/**
 * The owner's ADMIN_KEY, typed once on this device. It is never in the bundle: the door in
 * Settings asks for it, the Worker says whether it is right, and only then is it kept here.
 * The same storage key the placement workbench reads, so both open without asking twice.
 */
const ADMIN_KEY = "mc-admin-key";
const adminKey = () => { try { return localStorage.getItem(ADMIN_KEY) ?? ""; } catch { return ""; } };
const setAdminKey = (key: string) => { try { key ? localStorage.setItem(ADMIN_KEY, key) : localStorage.removeItem(ADMIN_KEY); } catch { /* private mode */ } };
const BLOCK_KEY = "mc-blocked";
let blockedIds: Set<string> = (() => {
  try { return new Set(JSON.parse(localStorage.getItem(BLOCK_KEY) ?? "[]") as string[]); } catch { return new Set(); }
})();
export const isBlocked = (playerId: string) => blockedIds.has(playerId);
function setBlocked(playerId: string, on: boolean) {
  if (on) blockedIds.add(playerId); else blockedIds.delete(playerId);
  try { localStorage.setItem(BLOCK_KEY, JSON.stringify([...blockedIds])); } catch { /* private mode */ }
}
let chatCache: ChatMessage[] = (() => {
  try { const raw = localStorage.getItem(CHAT_CACHE_KEY); return raw ? (JSON.parse(raw) as ChatMessage[]) : []; } catch { return []; }
})();
function rememberChat(messages: ChatMessage[]) {
  const byId = new Map(chatCache.map((m) => [m.id, m]));
  for (const m of messages) byId.set(m.id, m);
  chatCache = [...byId.values()].sort((a, b) => a.id - b.id).slice(-CHAT_CACHE_MAX);
  try { localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(chatCache)); } catch { /* private mode */ }
}
/** HH:MM in local time; the API sends seconds or milliseconds depending on age. */
function chatTime(at: number) {
  const ms = at > 1e12 ? at : at * 1000;
  const d = new Date(ms);
  return Number.isFinite(d.getTime()) ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}` : "";
}

const chatSeen = () => { try { return Number(localStorage.getItem("mc-chat-seen") ?? 0) || 0; } catch { return 0; } };
/** a stable hue per name so the ticker reads like a chat */
const nameColor = (name: string) => { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return `hsl(${h % 360} 70% 68%)`; };
/**
 * What the bottom of the screen actually measures on this device.
 *
 * Desktop always reports env(safe-area-inset-bottom) as 0, so the inset branch of the
 * layout can only ever be checked on a real phone. This prints the resolved numbers and
 * where the chat strip's text really lands, so a screenshot answers it instead of a guess.
 */
function layoutReport() {
  if (typeof document === "undefined") return null;
  const ui = document.getElementById("ui");
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden";
  document.body.appendChild(probe);
  const envBottom = probe.getBoundingClientRect().height;
  probe.remove();
  const px = ui ? parseFloat(getComputedStyle(ui).paddingBottom) : 0;
  const strip = document.querySelector<HTMLElement>(".chat-strip");
  const lines = strip?.querySelector<HTMLElement>(".lines");
  const r = (el: HTMLElement | null | undefined) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
  const measure = (expr: string) => {
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;left:0;bottom:0;width:0;pointer-events:none;visibility:hidden;height:${expr}`;
    (ui ?? document.body).appendChild(el);
    const h = el.getBoundingClientRect().height; el.remove(); return Math.round(h * 100) / 100;
  };
  const stripRect = r(strip), linesRect = r(lines);
  return {
    innerH: innerHeight, visualH: Math.round(visualViewport?.height ?? 0), dpr: devicePixelRatio,
    envBottom, pxUnit: measure("calc(1 * var(--px))"), safePx: measure("var(--safe-px)"),
    strip: stripRect, lines: linesRect,
    linesClipped: linesRect ? linesRect.bottom > innerHeight : null,
    gapUnderLines: linesRect ? Math.round(innerHeight - linesRect.bottom) : null,
    uiPad: px,
  };
}

const fmtDistance = (cm: number) => (cm >= 100000 ? `${(cm / 100000).toFixed(2)} km` : `${(cm / 100).toFixed(1)} m`);
/** m:ss for a run duration */
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const el = (tag: string, cls: string, html = "") => {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
};

/** All non-canvas UI: menus, shop, pause, game over. Plain DOM so it ports to a WebView untouched. */
/**
 * One mission as a row. The bar on its own was a mystery -- a blue stripe of no stated
 * length -- so the row now says the count beside it, and a finished one says it is finished
 * and what it paid, rather than quietly turning green and being replaced by a stranger.
 */
function missionRow(m: Mission, live = m.at): string {
  const at = Math.max(m.at, Math.min(m.n, live));
  const pct = Math.max(0, Math.min(100, Math.round((at / m.n) * 100)));
  return `<div class="mission ${m.done ? "done" : ""}">
    <span class="mission-txt">${esc(missionText(m))}</span>
    <span class="mission-bar"><i style="width:${m.done ? 100 : pct}%"></i></span>
    <span class="mission-pay">${m.done ? `<em>EARNED</em>$${m.pay}` : `<em>${groupNum(at)}/${groupNum(m.n)}</em>$${m.pay}`}</span>
  </div>`;
}

export class Ui {
  root: HTMLElement;
  private panel: HTMLElement | null = null;
  private panelCleanup: (() => void) | null = null;
  /** Only the title menu gets the animated kitchen; every other panel sits on a still frame so it stays smooth. */
  get staticBackground() { return !!this.panel && !this.panel.classList.contains("home"); }
  private pauseBtn: HTMLButtonElement;
  private muteBtn: HTMLButtonElement;

  constructor(root: HTMLElement, private save: () => SaveData, private h: UiHandlers) {
    this.root = root;
    this.pauseBtn = document.createElement("button");
    this.pauseBtn.className = "pause-btn";
    this.pauseBtn.textContent = "☰"; this.pauseBtn.setAttribute("aria-label", t("Menu"));
    this.pauseBtn.hidden = true;
    this.pauseBtn.addEventListener("click", () => { this.h.onPause(); this.showPause(); });
    root.appendChild(this.pauseBtn);
    this.muteBtn = document.createElement("button");
    this.muteBtn.className = "pause-btn mute-btn";
    this.muteBtn.hidden = true;
    this.muteBtn.addEventListener("click", () => { this.h.onToggleMute(); this.refreshMute(); });
    root.appendChild(this.muteBtn);
    this.refreshMute();
    watchTree(root);
  }

  /** Re-render the fixed buttons after a language change. */
  refreshLang() {
    this.pauseBtn.textContent = "☰"; this.pauseBtn.setAttribute("aria-label", t("Menu"));
    this.refreshMute();
  }

  refreshMute() {
    const s = this.save();
    const muted = !s.sound && !s.music;
    this.muteBtn.textContent = muted ? "🔇" : "🔊";
    this.muteBtn.title = t(muted ? "Unmute" : "Mute");
    this.muteBtn.setAttribute("aria-label", this.muteBtn.title);
  }

  private show(panel: HTMLElement) {
    this.clear();
    this.panel = panel;
    // Any panel with a bottom "back"-style button also gets a top-left arrow and a tap-outside
    // backdrop that do the same thing, so nobody has to scroll to the bottom to leave.
    const exit = panel.querySelector<HTMLButtonElement>('button.shell-back, button.ghost[data-a="back"], button.ghost[data-a="menu"], button.ghost[data-a="map"]');
    if (exit && !panel.classList.contains("menu")) {
      const ownsBack = panel.classList.contains("shell");
      const backdrop = el("div", "backdrop");
      backdrop.addEventListener("click", () => exit.click());
      this.root.appendChild(backdrop);
      if (!ownsBack) {
        const arrow = el("button", "back-arrow", "‹");
        arrow.setAttribute("aria-label", exit.textContent?.trim() || t("Back"));
        arrow.addEventListener("click", () => exit.click());
        panel.prepend(arrow);
        panel.classList.add("has-arrow");
      }
      // scrolling panels lose their bottom button; the arrow replaces it
      // Scrolling panels used to lose their bottom BACK button because the floating arrow
      // replaced it. A shell panel's exit IS its header back button, so hiding it leaves
      // the panel with no way out but the backdrop.
      if (!ownsBack && (panel.classList.contains("shop") || panel.classList.contains("collection"))) exit.hidden = true;
    }
    // any panel that is not the home screen covers the strip; do not leave it peeking out
    if (!panel.classList.contains("home")) this.setChatStripVisible(false);
    translateTree(panel);
    this.root.appendChild(panel);
    this.fit(panel);
  }

  /** Re-measure the open panel after a viewport change. */
  refit() { if (this.panel) this.fit(this.panel); }

  /** Scale a panel so its whole content fits the screen (phone text/page zoom shrinks the viewport).
   * Reading panels that are meant to scroll only shrink a little; menus and dialogs shrink until they fit. */
  private fit(panel: HTMLElement) {
    if (panel.classList.contains("home") || panel.classList.contains("shell")) return; // positions itself
    const scroller = panel.classList.contains("shop") || panel.classList.contains("collection") ||   panel.classList.contains("how-to") || panel.classList.contains("board") || panel.classList.contains("chat");
    panel.style.zoom = "1"; panel.style.width = "";
    const vw = window.innerWidth, vh = window.innerHeight;
    const need = panel.scrollHeight + 24;
    let z = Math.min(1, vw / 400, vh / need);
    z = Math.max(scroller ? 0.85 : 0.6, z);
    if (z >= 0.999) return;
    panel.style.zoom = z.toFixed(3);
    // vw units shrink with zoom too; keep the panel at its full designed width
    panel.style.width = `min(${(92 / z).toFixed(1)}vw, 380px)`;
    panel.style.maxHeight = `${(92 / z).toFixed(1)}vh`;
  }

  clear() {
    this.root.querySelectorAll(".backdrop").forEach((b) => b.remove());
    this.panelCleanup?.();
    this.panelCleanup = null;
    if (this.previewLoop !== null) cancelAnimationFrame(this.previewLoop);
    this.previewLoop = null;
    this.panel?.remove();
    this.panel = null;
  }

  setInRun(inRun: boolean) {
    this.pauseBtn.hidden = !inRun;
    this.muteBtn.hidden = !inRun;
    this.refreshMute();
    // The strip is a home-screen thing: there is no time to read it mid-climb.
    this.setChatStripVisible(false);
  }

  /* ---------------------------------------------------------- in-run chat strip */
  /** Bottom 64 px: the two latest global lines, unread badge, tap to open (handoff 1a). */
  private chatStrip: HTMLElement | null = null;
  private chatStripTimer: number | null = null;
  private setChatStripVisible(on: boolean) {
    if (on === !!this.chatStrip) return;
    if (!on) {
      this.chatStrip?.remove(); this.chatStrip = null;
      if (this.chatStripTimer !== null) { clearInterval(this.chatStripTimer); this.chatStripTimer = null; }
      this.root.classList.remove("has-chat");
      setChatStrip(false);
      return;
    }
    const el = document.createElement("button");
    el.className = "chat-strip";
    el.setAttribute("aria-label", t("Global chat"));
    el.innerHTML = `<span class="bubble"><img src="${import.meta.env.BASE_URL}art/ui/chat.webp" alt="" /><em class="badge" hidden></em></span><span class="lines"><i>${t("Global chat")}</i></span>`;
    el.addEventListener("click", () => this.showChat());
    translateTree(el);
    this.root.appendChild(el);
    this.chatStrip = el;
    // the dock rides 74 px up instead of 34 so it clears the strip
    this.root.classList.add("has-chat");
    setChatStrip(true);
    this.refreshChatStrip();
    // slow poll: this is ambient furniture during a run, not the chat panel
    this.chatStripTimer = setInterval(() => this.refreshChatStrip(), 20000) as unknown as number;
  }
  private refreshChatStrip() {
    const el = this.chatStrip; if (!el) return;
    void chat.list(0, this.save().playerId).then((r) => {
      if (!r || el !== this.chatStrip || !el.isConnected) return;
      const lines = el.querySelector<HTMLElement>(".lines"), badge = el.querySelector<HTMLElement>(".badge");
      const last = r.messages.filter((m) => !isBlocked(m.player_id)).slice(-2);
      if (lines) lines.innerHTML = last.length
        ? last.map((m) => { const face = m.player_id === this.save().playerId ? this.save().avatar : m.avatar ?? undefined;
            // always a tile, portrait or initial, so the two lines start at the same x
            return `<span>${avatarHtml(face, m.name, "calc(20 * var(--px))")}<b style="color:${nameColor(m.name)}">${esc(m.name)}:</b> ${esc(m.text)}</span>`; }).join("")
        : `<i>${t("Global chat")} · ${r.online} ${t("online")}</i>`;
      const unread = r.messages.filter((m) => m.id > chatSeen() && m.player_id !== this.save().playerId).length;
      if (badge) { badge.hidden = !unread; badge.textContent = unread > 99 ? "99+" : String(unread); }
    });
  }

  /** How long until the day turns over: the daily and the missions both run on the Central date. */
  private static resetIn(): string {
    const m = Math.max(0, Math.ceil((nextDayStart() - Date.now()) / 60_000));
    return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
  }

  showMenu() {
    const s = this.save();
    if (!s.picked && s.runs >= 1) { this.showFirstPick(); return; }
    // Once, after a few climbs, and never again whatever the answer.
    if (shouldOfferInstall(s.runs)) { this.showInstallOffer(() => this.showMenu()); return; }
    // No full-height panel: the title fridge is the background, a scrim carries the text (handoff 2a).
    // Collapsed 2026-09-21: solo is the one thing a new thumb needs to find in under a second.
    // Everything else the old menu put beside it (story, board, kit icon, how-to, both race
    // rows, the month's door) moved into the "more" sheet or the wallet chip; chill moved to
    // Settings, where every other device-local preference already lives.
    const p = el("div", "home");
    const today = todayKey();
    const done = s.daily?.day === today;
    const streak = s.streak.last === today || s.streak.last === todayKey(Date.now() - 86_400_000) ? s.streak.days : 0;
    // what taking it right now would pay, so the chip makes the case for itself
    const next = streakReward(done ? streak : streak + 1);
    const missionsDone = s.missions.filter((m) => m.done).length;
    const missionsPay = s.missions.reduce((sum, m) => sum + (m.done ? m.pay : 0), 0);
    p.innerHTML = `
      <div class="home-top">
        <button class="home-settings" data-a="settings" aria-label="Settings"><img src="${import.meta.env.BASE_URL}art/ui/settings.webp" alt="" /></button>
        <button class="wallet-chip" data-a="collection" aria-label="Creatures &amp; patterns">
          <b class="coin">${groupNum(s.coins)}</b><b class="gem">◆ ${groupNum(s.gems)}</b>
        </button>
      </div>
      <img class="home-wordmark" src="${import.meta.env.BASE_URL}art/title-logo.webp" alt="Magnet Climbers" width="1100" height="495" fetchpriority="high" />
      <div class="home-bottom">
      <div class="home-dock">
        <button class="mode-tile solo full" data-a="solo">
          <b>SOLO CLIMB</b><small>Endless fridge, outrun the line.</small>
          <i>BEST ${groupNum(s.bestSolo)} CM</i>
        </button>
        <div class="home-chips">
          <button class="chip daily-chip ${done ? "spent" : ""}" data-a="daily">
            ${done ? `Today's fridge · done (${groupNum(s.daily!.cm)} cm) · new in ${Ui.resetIn()}` : `Today's fridge · pays ${next.pattern ? "a pattern" : `$${next.coins}`}`}${streak ? ` · ${streak}🔥` : ""}
          </button>
          <button class="chip more-chip" data-a="more">MORE ›</button>
        </div>
        ${s.missions.length ? `<button class="home-row missions-line" data-a="more">
          <b>MISSIONS</b><small>${missionsDone}/${s.missions.length} · $${missionsPay}</small>
        </button>` : ""}
        <p class="home-stats">${s.runs.toLocaleString()} runs · ${fmtDistance(s.totalCm)} climbed lifetime</p>
        <p class="home-stats global" hidden></p>
      </div>
      </div>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]")?.dataset.a;
      if (a === "solo") this.showQuickKit(() => this.h.onPlay("solo"));
      // the daily is the same climb for everyone, so no kit sheet stands in front of it
      if (a === "daily" && !done) { this.clear(); this.h.onPlayDaily(); }
      if (a === "daily" && done) this.showBoard("daily");
      // the wallet chip is still a way in, and lands on what the coins are for
      if (a === "collection") this.showCollection(SHOP_ENABLED ? "kit" : "creatures");
      if (a === "more") this.showMore();
      if (a === "settings") this.showSettings();
    });
    this.show(p);
    // everyone's climbing, added up, once the Worker answers; a phone offline just does without
    if (leaderboardEnabled) void leaderboard.stats().then((st) => {
      const g = p.querySelector<HTMLElement>(".global");
      if (!st || !g || !p.isConnected) return;
      const pl = (n: number, w: string) => `${n.toLocaleString()} ${w}${n === 1 ? "" : "s"}`;
      g.textContent = `🌍 Everyone together: ${fmtDistance(st.total_cm)} over ${pl(st.runs, "run")} by ${pl(st.players, "climber")}`;
      g.hidden = false;
    });
    this.setChatStripVisible(leaderboardEnabled && !!s.chatOptIn);
  }

  /**
   * Everything the collapsed home moved off itself: race, board, story, how-to and this
   * month's door. One sheet instead of six home-screen destinations, behind a single MORE tap.
   */
  showMore() {
    const s = this.save();
    const p = el("div", "panel shell more");
    const row = (title: string, sub: string, control: string) =>
      `<div class="shell-row"><span class="txt"><b>${title}</b><small>${sub}</small></span>${control}</div>`;
    const chip = (a: string, text: string) => `<button class="shell-chip" data-a="${a}">${text}</button>`;
    const ghostCm = this.h.bestTapeCm();
    const t = themeFor();
    const month = new Date().toLocaleString("en", { month: "long" });
    const hasPattern = s.patterns.includes(t.pattern);
    p.innerHTML = `
      <div class="shell-head"><button class="shell-back" data-a="back" aria-label="Back">‹</button><h2>More</h2><span class="shell-spacer"></span></div>
      <div class="shell-body">
        ${s.missions.length ? `<p class="sec-label">Missions</p>
        <div class="home-missions">${s.missions.map((m) => missionRow(m)).join("")}</div>` : ""}
        <p class="sec-label">Race</p>
        ${row("Solo board", "See where you rank", chip("board", "OPEN"))}
        ${ghostCm !== null ? row("Race your best", `Same door, you beside you · ${groupNum(ghostCm)} cm`, chip("ghost", "GO")) : ""}
        ${row("Race a friend live", "Same fridge, same moment, their ghost beside you", chip("live", "GO"))}
        <p class="sec-label">Learn</p>
        ${row("How the fridge works", "Every element and what it does", chip("tutorial", "OPEN"))}
        ${row("Story", "How Cooper's toys ended up on the door", chip("story", "OPEN"))}
        <p class="sec-label">This month</p>
        ${row(`${esc(month)}'s door`, `${esc(t.name)}${hasPattern ? " · its pattern is yours" : " · climb once this month to keep its pattern"}`, chip("patterns", "OPEN"))}
      </div>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]")?.dataset.a;
      if (a === "back") { this.showMenu(); return; }
      if (a === "board") this.showBoard("solo");
      if (a === "ghost") this.showQuickKit(() => this.h.onRaceBest());
      if (a === "live") this.h.onLiveRace();
      if (a === "tutorial") this.showHowToPlay();
      if (a === "story") this.showStory(() => this.showMore());
      if (a === "patterns") this.showCollection("patterns");
    });
    this.show(p);
  }

  /** Animated preview canvases: one fake climber per card, idling on the fridge. */
  private previewLoop: number | null = null;
  private startPreviews(p: HTMLElement) {
    const cards = Array.from(p.querySelectorAll<HTMLCanvasElement>("canvas[data-look]"));
    const climbers = cards.map((cv, i) => {
      const [creature, pattern] = cv.dataset.look!.split("|");
      const c: Climber = { id: 100 + i, x: 50, y: 58, vx: 0, vy: 0, angle: 0, spin: 0, state: "stuck", color: patternColors(pattern)[0], creature, pattern,
        parent: null, leftLauncher: true, launcherId: null, airTime: 0, squash: 0, hp: 3, iframes: 0 };
      resetRagdoll(c); return c;
    });
    const t0 = performance.now();
    let lastDraw = 0;
    const tick = (now: number) => {
      if (!p.isConnected) { this.previewLoop = null; return; }
      // 20 fps is plenty for an idle wiggle and keeps scrolling smooth on phones
      if (now - lastDraw < 50) { this.previewLoop = requestAnimationFrame(tick); return; }
      lastDraw = now;
      const t = (now - t0) / 1000;
      cards.forEach((cv, i) => {
        // The climber is posed inside a 100-unit box and stood at its middle, so the scale has
        // to come from the canvas rather than a constant: a hard 2 only ever framed the 200px
        // collection cards and drew any smaller one somewhere off its own edge.
        const k = cv.width / 100;
        const ctx = cv.getContext("2d")!; ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, 100, 100);
        const c = climbers[i]; c.angle = Math.sin(t * 1.3 + i) * 0.12; c.squash = Math.sin(t * 2.2 + i) * 0.08;
        for (const [limb, joint] of c.ragdoll!.limbs.entries()) { joint.angle = Math.sin(t * 1.6 + i + limb * 1.7) * 0.25; joint.bend = Math.sin(t * 1.9 + i * 2 + limb) * 0.3; }
        drawClimber(ctx, c, false, t, appearanceFor(c));
      });
      this.previewLoop = requestAnimationFrame(tick);
    };
    if (this.previewLoop) cancelAnimationFrame(this.previewLoop);
    this.previewLoop = requestAnimationFrame(tick);
  }

  /** Creatures and patterns: what you own, what you wear, how to earn the rest. */
  /**
   * Everything you own or can buy, behind one door. Kit and creatures were two full-width
   * rows, then two tiles, and they were always the same errand: what am I taking up the
   * fridge. The kit tab leads because it is the one with a decision and coins attached, and
   * it is labelled for the climb rather than for the shop, because the thing players get
   * wrong about it is that it lasts one run.
   */
  showCollection(tab: "kit" | "creatures" | "patterns" = "creatures") {
    const s = this.save();
    const p = el("div", "panel collection");
    const owned = (c: CreatureDef) => s.creatures.includes(c.id);
    let body = "";
    if (tab === "kit") {
      const { chips, note } = this.kitParts();
      const st = statsFor(s.kit);
      body = `<p class="tag"><span class="coin">$${groupNum(s.coins)}</span> \u00b7 this climb only${s.kit.power ? ` \u00b7 jump +${Math.round((st.launchMult - 1) * 100)}%` : ""}${s.kit.floor ? ` \u00b7 line -${Math.round((1 - st.floorMult) * 100)}%` : ""}</p>
        ${note ? `<p class="fine kit-note">${note}</p>` : ""}
        <div class="kit-list">${chips}</div>
        <label class="kit-auto"><input type="checkbox" data-a="auto" ${s.autoKit ? "checked" : ""} /> <span>Buy this for me every climb</span></label>`;
    } else if (tab === "creatures") {
      body = `<div class="guide-grid">${CREATURES.map((c) => {
        const on = s.creature === c.id, has = owned(c);
        return `<button class="guide-card look ${on ? "on" : ""} ${has ? "" : "locked"}" data-c="${c.id}" ${has ? "" : "disabled"}>
          <canvas width="200" height="200" data-look="${c.id}|${has ? s.pattern : "stealth"}"></canvas>
          <b>${esc(c.name)}</b><span>${has ? esc(c.blurb) : "🔒 " + esc(unlockText(c.unlock))}</span>${on ? "<i class=\"tick\">WEARING</i>" : ""}
        </button>`; }).join("")}</div>`;
    } else if (tab === "patterns") {
      const thisMonth = themeFor().id;
      const calendar = `<p class="sec-label">The year's doors \u00b7 one pattern each, only that month</p>
        <div class="months">${FRIDGE_THEMES.map((t) => {
          const k = PATTERNS.find((x) => x.id === t.pattern), own = s.patterns.includes(t.pattern), now = t.id === thisMonth;
          const mon = new Date(2026, t.month - 1, 1).toLocaleString("en", { month: "short" });
          return `<div class="month ${now ? "now" : ""} ${own ? "own" : ""}"><i>${mon}</i><b>${esc(t.name)}</b><span class="swatches">${(k?.colors ?? []).slice(0, 4).map((c) => `<i style="background:${c}"></i>`).join("")}</span><small>${own ? "\u2713 yours" : now ? "climb once this month" : ""}</small></div>`;
        }).join("")}</div>`;
      body = calendar + `<div class="guide-grid">${PATTERNS.map((k) => {
        const on = s.pattern === k.id, has = s.patterns.includes(k.id);
        return `<button class="guide-card look ${on ? "on" : ""} ${has ? "" : "locked"}" data-p="${k.id}" ${has ? "" : "disabled"}>
          <canvas width="200" height="200" data-look="${has ? s.creature : "toy"}|${k.id}"></canvas>
          <b>${esc(k.name)} <em class="r ${k.rarity}">${k.rarity}</em></b>
          <span class="swatches">${k.colors.map((c) => `<i style="background:${c}"></i>`).join("")}</span>${on ? "<i class=\"tick\">WEARING</i>" : has ? "" : k.limited ? `<span>🔒 ${esc(FRIDGE_THEMES.find((t) => t.id === k.limited)?.name ?? "limited")}</span>` : "<span>🔒 prize machine</span>"}
        </button>`; }).join("")}</div>
        <button class="primary" data-a="prize">🎰 PRIZE MACHINE · $${groupNum(prizeCost(s.spins))}</button>`;
    }
    p.innerHTML = `<h2>Your kit</h2>
      <div class="tabs">${SHOP_ENABLED ? `<button class="${tab === "kit" ? "on" : ""}" data-tab="kit">THIS CLIMB</button>` : ""}<button class="${tab === "creatures" ? "on" : ""}" data-tab="creatures">CREATURES ${s.creatures.length}/${CREATURES.length}</button><button class="${tab === "patterns" ? "on" : ""}" data-tab="patterns">PATTERNS ${s.patterns.length}/${PATTERNS.length}</button></div>
      ${body}
      <button class="ghost" data-a="back">BACK</button>`;
    p.addEventListener("click", (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-tab],[data-k],[data-c],[data-p],[data-a]");
      if (!t) return;
      if (t.dataset.tab) { this.showCollection(t.dataset.tab as "creatures"); return; }
      if (t.dataset.k) { this.h.onBuy(t.dataset.k as UpgradeKey); this.showCollection("kit"); return; }
      if (t.dataset.c) { this.h.onWear({ creature: t.dataset.c as CreatureId, pattern: this.save().pattern }); this.showCollection("creatures"); return; }
      if (t.dataset.p) { this.h.onWear({ creature: this.save().creature, pattern: t.dataset.p }); this.showCollection("patterns"); return; }
      if (t.dataset.a === "auto") return; // handled on change, below
      if (t.dataset.a === "prize") this.showPrize();
      if (t.dataset.a === "back") this.showMenu();
    });
    p.querySelector<HTMLInputElement>('input[data-a="auto"]')?.addEventListener("change", (e) => {
      const on = (e.target as HTMLInputElement).checked;
      this.h.onToggleAutoKit(on);
      this.toast(on ? "Kit bought automatically from now on" : "You will be asked each climb");
    });
    this.show(p);
    this.startPreviews(p);
  }

  /** The coin prize machine: visible odds, no duplicates, and a price that doubles every spin. */
  showPrize(result: PatternDef | null = null) {
    const s = this.save();
    const left = PATTERNS.filter((k) => !s.patterns.includes(k.id));
    const cost = prizeCost(s.spins);
    const p = el("div", "panel small prize");
    const can = s.coins >= cost && left.length > 0;
    const swatch = (k: PatternDef) => `<span class="reel-row"><span class="swatches">${k.colors.map((c) => `<i style="background:${c}"></i>`).join("")}</span><b>${esc(k.name)}</b></span>`;
    p.innerHTML = `<h2>Prize machine</h2>
      ${result ? `<div class="reveal"><canvas width="200" height="200" data-look="${s.creature}|${result.id}"></canvas><b>${esc(result.name)}</b><em class="r ${result.rarity}">${result.rarity}</em><p class="tag">Now wearing it. Change any time in the collection.</p></div>`
        : `<div class="reel" aria-hidden="true"><div class="reel-strip">${[...PATTERNS, ...PATTERNS].map(swatch).join("")}</div></div>
           <p class="tag">One spin, one new pattern. Never a duplicate.<br/>${left.length} left to find.</p>`}
      <p class="fine">Odds: common ${PRIZE_ODDS.common}% · rare ${PRIZE_ODDS.rare}% · epic ${PRIZE_ODDS.epic}%</p>
      <button class="primary ${can ? "" : "disabled"}" data-a="spin" ${can ? "" : "disabled"}>${left.length ? `SPIN · $${groupNum(cost)}` : "COLLECTION COMPLETE"}</button>
      <p class="fine">You have <span class="coin">$${groupNum(s.coins)}</span>${left.length ? ` · next spin $${groupNum(prizeCost(s.spins + 1))}` : ""}</p>
      <button class="ghost" data-a="back">BACK</button>`;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "spin") {
        const won = this.h.onSpin();
        if (!won) return;
        // the reel runs, then the prize lands: the machine should feel like a machine
        const strip = p.querySelector<HTMLElement>(".reel-strip");
        const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!strip || still) { this.showPrize(won); return; }
        p.querySelector<HTMLButtonElement>("[data-a=spin]")!.disabled = true;
        strip.classList.add("spinning");
        sfx.tick();
        setTimeout(() => { sfx.power(); this.showPrize(won); }, 900);
        return;
      }
      if (a === "back") this.showCollection("patterns");
    });
    this.show(p);
    if (result) this.startPreviews(p);
  }

  /** One-time offer after the first run: choose a creature to own. */
  showFirstPick() {
    const s = this.save();
    const choices = CREATURES.filter((c) => c.id !== "toy");
    const p = el("div", "panel collection");
    p.innerHTML = `<h2>Pick your first creature</h2>
      <p class="tag">One is yours right now, free. The rest are earned by climbing.</p>
      <div class="guide-grid">${choices.map((c) => `<button class="guide-card look" data-c="${c.id}">
        <canvas width="200" height="200" data-look="${c.id}|${s.pattern}"></canvas><b>${esc(c.name)}</b><span>${esc(c.blurb)}</span></button>`).join("")}</div>`;
    p.addEventListener("click", (e) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>("[data-c]")?.dataset.c as CreatureId | undefined;
      if (!id) return;
      this.h.onPickFirst(id); this.toast(`${creatureById(id).name} joined your fridge`); this.showMenu();
    });
    this.show(p);
    this.startPreviews(p);
  }

  /** One public room for everyone. Polls while open; the Worker filters words and rate-limits. */
  private chatTimer: number | null = null;
  showChat() {
    const s = this.save();
    const p = el("div", "panel shell chat");
    p.innerHTML = `
      <div class="shell-head"><button class="shell-back" data-a="back" aria-label="Back">‹</button><h2>Global chat</h2><span class="shell-spacer"></span></div>
      <div class="shell-body chat-log" aria-live="polite"></div>
      <span class="shell-fade"></span>
      <div class="shell-foot">
        <form class="chat-form"><input type="text" maxlength="160" placeholder="Message as ${esc(s.name)}" autocomplete="off" enterkeyhint="send" /><button class="send" type="submit" aria-label="Send">➤</button></form>
        <p class="fine"><span class="online"></span></p>
        <p class="fine err" hidden></p>
      </div>`;
    const log = p.querySelector<HTMLElement>(".chat-log")!, online = p.querySelector<HTMLElement>(".online")!, err = p.querySelector<HTMLElement>(".err")!;
    const input = p.querySelector<HTMLInputElement>("input")!;
    let lastId = chatCache.length ? chatCache[chatCache.length - 1].id : 0, pendingSeq = 0;
    const seen = new Map<number, ChatMessage>(chatCache.map((m) => [m.id, m]));
    // opening the room is reading it: whatever is here counts as seen from now, and the
    // strip's badge goes at once rather than at its next slow poll
    const markSeen = (id: number) => { if (id > chatSeen()) { try { localStorage.setItem("mc-chat-seen", String(id)); } catch { /* private mode */ } } };
    markSeen(lastId);
    const badge = this.chatStrip?.querySelector<HTMLElement>(".badge"); if (badge) badge.hidden = true;

    const row = (m: ChatMessage) => {
      const mine = m.player_id === s.playerId;
      // your own portrait comes from this device, so it shows before the Worker
      // that stores avatars is redeployed (and instantly on a just-sent message)
      const face = mine ? s.avatar : m.avatar ?? undefined;
      const colour = nameColor(m.name);
      // no portrait picked yet still gets a filled tile of the same size, so a
      // row without one does not read as a hole in the column of faces
      // The portrait is the handle on a message: tap someone's face to block or report them.
      const face_ = avatarHtml(face, m.name, "calc(44 * var(--px))")
        .replace('class="avi', 'class="cav avi')
        .replace("<span ", mine ? "<span " : `<span tabindex="0" title="Block or report ${esc(m.name)}" `);
      return `<div class="cmsg ${mine ? "me" : ""}"${mine ? "" : ` data-flag="${esc(m.player_id)}" data-msg="${m.id}" data-name="${esc(m.name)}"`}>
        ${face_}
        <span class="cbody">
          <span class="chead"><b style="color:${colour}">${esc(m.name)}</b><i>${chatTime(m.created_at)}</i></span>
          <span class="cbubble">${esc(m.text)}</span>
        </span>
      </div>`;
    };
    // a few grey rows beat the word "Loading" on a first ever open
    const skeleton = `<div class="cskel">${"<span></span>".repeat(5)}</div>`;
    const render = (keepScroll = false) => {
      // A message sent from here is shown at once under a fractional id, before the server
      // has given it a real one. Nothing used to clear that copy, so once the poll brought
      // the real message back you saw your own line twice - and only your own, which is why
      // it looked fine to everybody else. Drop the pending copy once its real one lands.
      const all = [...seen.values()];
      const settled = all.filter((m) => Number.isInteger(m.id));
      for (const m of all) {
        if (Number.isInteger(m.id)) continue;
        // must be the server's copy of THIS send, not an identical line from earlier in the
        // log, or saying the same thing twice would make the second one vanish until the poll
        if (settled.some((o) => o.player_id === m.player_id && o.text === m.text && o.created_at >= m.created_at - 30000))
          seen.delete(m.id);
      }
      const rows = [...seen.values()].filter((m) => !isBlocked(m.player_id)).sort((a, b) => a.id - b.id).slice(-CHAT_VIEW_MAX);
      // loading older messages grows the log upwards: hold the reading position by
      // restoring the distance from the bottom, which is what does not move
      const fromBottom = log.scrollHeight - log.scrollTop;
      log.innerHTML = rows.length ? rows.map(row).join("") : skeleton;
      log.scrollTop = keepScroll ? log.scrollHeight - fromBottom : log.scrollHeight;
    };
    render();

    // Older history, a page at a time, when the log is scrolled near its top.
    let more = true, loading = false;
    // read the oldest id at call time: the first poll is usually what fills the panel,
    // so a value captured when it opened would be 0 and nothing would ever load
    const oldestId = () => (seen.size ? Math.min(...seen.keys()) : 0);
    const loadOlder = async () => {
      if (loading || !more || !oldestId()) return;
      loading = true;
      const r = await chat.older(oldestId(), 40, this.save().playerId);
      loading = false;
      if (!r || !p.isConnected) return;
      more = r.more;
      if (!r.messages.length) return;
      for (const m of r.messages) seen.set(m.id, m);
      render(true);
    };
    log.addEventListener("scroll", () => { if (log.scrollTop < 120) void loadOlder(); }, { passive: true });

    // Block or report whoever sent a message. Blocking hides them on this device at
    // once; both tell the Worker, so the owner sees what players are flagging.
    const flag = async (kind: "block" | "report", targetId: string, messageId: number, name: string) => {
      if (kind === "block") { setBlocked(targetId, true); render(); this.toast(`Blocked ${name}`); }
      else this.toast(`Reported ${name}`);
      // send the words as they were read here: by the time the owner looks, the message
      // itself may have been deleted, and a flag with no message is no use to anyone
      await chat.report(s.playerId, s.token ?? "", kind, targetId, messageId, seen.get(messageId)?.text ?? "");
    };
    log.addEventListener("click", (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>(".cav")?.closest<HTMLElement>(".cmsg");
      if (!row?.dataset.flag) return;
      const targetId = row.dataset.flag, messageId = Number(row.dataset.msg ?? 0), name = row.dataset.name ?? "them";
      const menu = el("div", "cmenu");
      menu.innerHTML = `<p class="fine">${esc(name)}</p>
        <button data-k="block">Block ${esc(name)}</button>
        <button data-k="report">Report this message</button>
        <button data-k="cancel" class="ghost">Cancel</button>`;
      const close = () => menu.remove();
      menu.addEventListener("click", (ev) => {
        const kind = (ev.target as HTMLElement).closest<HTMLElement>("button")?.dataset.k;
        if (!kind) return;
        close();
        if (kind === "block" || kind === "report") void flag(kind, targetId, messageId, name);
      });
      // tapping anywhere else dismisses it, same as the rest of the sheets
      menu.addEventListener("pointerdown", (ev) => { if (ev.target === menu) close(); });
      p.appendChild(menu);
    });

    const poll = async () => {
      if (!p.isConnected) { if (this.chatTimer) clearInterval(this.chatTimer); this.chatTimer = null; return; }
      const r = await chat.list(lastId, this.save().playerId);
      if (!r || !p.isConnected) return;
      for (const m of r.messages) { seen.set(m.id, m); lastId = Math.max(lastId, m.id); }
      rememberChat(r.messages);
      markSeen(lastId);
      online.textContent = r.online ? `${r.online} chatting lately` : "";
      if (r.messages.length || !seen.size) render();
      if (!seen.size) log.innerHTML = `<p class="how-blurb">Nobody has said anything yet. You could be first.</p>`;
    };
    if (this.chatTimer) clearInterval(this.chatTimer);
    void poll(); this.chatTimer = window.setInterval(poll, 4000);

    p.querySelector("form")!.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim(); if (!text) return;
      input.value = ""; err.hidden = true;
      // show it straight away; the poll replaces it with the server's copy
      // a unique fraction per send: two quick messages both used lastId + 0.5 and the
      // second overwrote the first in the map
      pendingSeq = (pendingSeq + 1) % 1000;
      const pending: ChatMessage = { id: lastId + (pendingSeq + 1) / 1001, name: s.name, text, player_id: s.playerId, created_at: Date.now() };
      seen.set(pending.id, pending); render();
      // The send returns the row the server actually stored, so swap the pending copy for that
      // rather than trying to recognise it later: the worker rewrites links and masks words, so
      // the text it keeps is not always the text that was typed. Matching on text would then
      // never fire, and the line would stay doubled for good.
      let sent: ChatMessage | string | null = null;
      try { sent = await this.h.onChat(text); } catch { sent = "Could not send"; }
      seen.delete(pending.id);
      if (typeof sent === "string") {
        render(); err.textContent = sent; err.hidden = false; input.value = text;
      } else {
        if (sent) { seen.set(sent.id, sent); lastId = Math.max(lastId, sent.id); }
        render();
        void poll();
      }
    });
    p.addEventListener("click", (e) => { if ((e.target as HTMLElement).dataset.a === "back") this.showMenu(); });
    this.show(p);
    input.focus();
  }

  /** Pack and level picker. Levels open one at a time; stars persist per level. */
  /** Grid of every portrait; tap one to wear it in chat. */
  showAvatarPicker() {
    const s = this.save();
    const p = el("div", "panel shell avatars");
    p.innerHTML = `
      <div class="shell-head"><button class="shell-back" data-a="back" aria-label="Back">‹</button><h2>Avatar</h2><span class="shell-spacer"></span></div>
      <div class="shell-body avatar-grid">
        <button class="pick ${s.avatar ? "" : "on"}" data-id="" aria-label="Just your initial">${avatarHtml(undefined, s.name, "calc(56 * var(--px))")}</button>
        ${AVATARS.map((a) => `<button class="pick ${a.id === s.avatar ? "on" : ""}" data-id="${a.id}" title="${esc(a.name)}" aria-label="${esc(a.name)}">${avatarHtml(a.id, a.name, "calc(56 * var(--px))")}</button>`).join("")}
      </div>`;
    p.addEventListener("click", (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-id],[data-a]");
      if (!t) return;
      if (t.dataset.a === "back") { this.showSettings(); return; }
      const id = t.dataset.id ?? "";
      this.h.onSetAvatar(id);
      this.toast(id ? `You are ${avatarById(id)?.name ?? id}` : "Back to your initial");
      this.showSettings();
    });
    this.show(p);
  }

  /** Profile, preferences and appearance in one place. */
  /** where the settings list was left, so a rebuild does not throw the player back to the top */
  private settingsScroll = 0;
  showSettings() {
    const s = this.save();
    const p = el("div", "panel shell settings");
    const base = import.meta.env.BASE_URL;
    const row = (title: string, sub: string, control: string) =>
      `<div class="shell-row"><span class="txt"><b>${title}</b><small>${sub}</small></span>${control}</div>`;
    const chip = (a: string, text: string) => `<button class="shell-chip" data-a="${a}">${text}</button>`;
    const toggle = (a: string, on: boolean, aria: string) =>
      `<label class="shell-toggle ${on ? "on" : ""}"><input type="checkbox" data-a="${a}" ${on ? "checked" : ""} aria-label="${aria}" /><i></i></label>`;
    // Three different answers: already on a home screen, a dialog we can raise, or iOS,
    // where the only thing we can do is name the buttons.
    const installRow = () => {
      const i = installState();
      if (i.installed) return row("Installed", "Running from your home screen", `<span class="shell-chip" aria-disabled="true">✓ DONE</span>`);
      if (i.canPrompt) return row("Install the game", "Its own icon, no address bar, works with no signal", chip("install", "INSTALL"));
      if (i.isIOS) return row("Add to Home Screen", "Three taps in Safari. Its own icon, no address bar", chip("install-ios", "HOW"));
      return row("Install the game", "Open this page in Chrome, Edge or Safari on your phone to install it", `<span class="shell-chip" aria-disabled="true">—</span>`);
    };
    p.innerHTML = `
      <div class="shell-head"><button class="shell-back" data-a="back" aria-label="Back">‹</button><h2>Settings</h2><span class="shell-spacer"></span></div>
      <div class="shell-body">
        <p class="sec-label">Profile</p>
        ${row("Climber name", `${esc(s.name || "not set")} · shown on the scoreboard`, chip("name", "CHANGE"))}
        <div class="shell-row">${avatarHtml(s.avatar, s.name, "calc(40 * var(--px))")}<span class="txt"><b>Avatar</b><small>${esc(avatarById(s.avatar)?.name ?? "Just your initial")} · shown in chat</small></span>${chip("avatar", "PICK")}</div>
        <p class="sec-label">Play on another device</p>
        ${accountsEnabled ? (s.account
          ? row("Signed in", `${esc(s.account.email || s.account.provider || "account")} · this profile follows you to any phone you sign in on`, chip("signout", "SIGN OUT"))
          : row("Sign in", "Google or Apple. Sign in on another phone and this profile is there.", `${chip("google", "GOOGLE")} ${chip("apple", "APPLE")}`)) : ""}
        ${row("Link a new device", "Shows a 6-letter code. Enter it on the other device to carry this profile over.", chip("link", "CODE"))}
        ${row("Enter a link code", "Adopt a profile from another device. Replaces this one.", chip("claim", "ENTER"))}
        <p class="sec-label">Preferences</p>
        ${row("Language", LANGS.map((l) => l.name).join(" · "),
          `<select class="shell-chip" data-a="lang" aria-label="Language">${LANGS.map((l) => `<option value="${l.id}" ${l.id === lang() ? "selected" : ""}>${l.name}</option>`).join("")}</select>`)}
        ${row("Chill mode", "No red line, no danger, no rush. Just the climb.", toggle("chill", s.chill, "Chill mode"))}
        ${row("Sound effects", "Rubber twangs, steel clicks and hand swishes", toggle("sound", s.sound, "Sound effects"))}
        ${row("Music", "Original toy-box groove; builds as danger approaches", toggle("music", s.music, "Music"))}
        ${row("Plain steel door", "Skip the month's tint and keep the stainless door all year. The month's pattern is still yours to earn.", toggle("plain", s.plainSteel, "Plain steel door"))}
        ${pushSupported() ? row("Reminders", "Today's fridge at 6 pm if you have not climbed it, the league on Monday morning, a new door on the first.", toggle("push", s.push, "Reminders")) : ""}
        ${leaderboardEnabled ? row("Public chat", "Off by default. On, other climbers' names and messages show on your fridge and yours on theirs.", toggle("chat", !!s.chatOptIn, "Public chat")) : ""}
        <p class="sec-label">App</p>
        ${installRow()}
        ${row("Check for update", `Build ${__BUILD__}`, chip("update", "REFRESH"))}
        ${adminKey() ? `
        <p class="sec-label">Owner</p>
        ${row("Admin panel", "Boards, chat, flags and players", chip("admin", "OPEN"))}
        ${row("Placement workbench", "How often each thing spawns, and how big it is drawn", `<a class="shell-chip" href="${base}placement.html" target="_blank" rel="noopener">OPEN</a>`)}
        ${row("Scale bench", "Any object on the real door, next to a climber, at any size", `<a class="shell-chip" href="${base}scale.html" target="_blank" rel="noopener">OPEN</a>`)}
        ${row("Element map", "Every element in the game and what it does to you", `<a class="shell-chip" href="${base}elements/" target="_blank" rel="noopener">OPEN</a>`)}
        ${row("Art archive", "Every art pack delivered so far", `<a class="shell-chip" href="${base}art-archive/" target="_blank" rel="noopener">OPEN</a>`)}
        ${row("Forget the key", "Removes owner access from this device", chip("owner-out", "SIGN OUT"))}
        ` : ""}
        <p class="sec-label">Performance</p>
        ${row("Frame times", "Last 600 frames of the most recent run, split into simulation and drawing.", chip("perf", "SHOW"))}
        <pre class="perf-out" hidden></pre>
      </div>
      <span class="shell-fade"></span>
      <div class="shell-foot">
        <p class="fine">Profile ${esc(s.playerId.slice(0, 10))}… · synced after every run</p>
        <p class="fine"><a href="${base}privacy/" target="_blank" rel="noopener">Privacy</a> · <a href="${base}terms/" target="_blank" rel="noopener">Terms</a> · <a href="${base}contact/" target="_blank" rel="noopener">Contact</a></p>
      </div>`;
    const syncToggles = () => {
      const now = this.save();
      for (const [key, on] of [["chill", now.chill], ["sound", now.sound], ["music", now.music], ["plain", now.plainSteel], ["push", now.push], ["chat", !!now.chatOptIn]] as const) {
        const input = p.querySelector<HTMLInputElement>(`input[data-a="${key}"]`);
        if (!input) continue;
        input.checked = on;
        input.parentElement?.classList.toggle("on", on);
      }
    };
    p.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const a = t.dataset.a;
      if (a === "update") { this.h.onUpdate(); return; }
      if (a === "perf") {
        const out = p.querySelector<HTMLElement>(".perf-out");
        if (out) { out.textContent = JSON.stringify({ build: __BUILD__, layout: layoutReport(), frames: this.h.onPerf() }, null, 1); out.hidden = false; }
        return;
      }
      if (a === "name") { this.showNamePrompt(() => this.showSettings()); return; }
      if (a === "avatar") { this.showAvatarPicker(); return; }
      if (a === "link") { this.h.onLinkDevice(); return; }
      if (a === "google" || a === "apple") { this.h.onSignIn(a); return; }
      if (a === "signout") { this.h.onSignOut(); return; }
      if (a === "claim") { this.showClaimPrompt(); return; }
      // Flip the switch where it stands. Rebuilding the whole panel for a toggle threw the
      // list back to the top and flashed, which is a lot of screen for one checkbox.
      if (a === "sound" || a === "music" || a === "plain" || a === "push" || a === "chat" || a === "chill") {
        ({ sound: () => this.h.onToggleSound(), music: () => this.h.onToggleMusic(), plain: () => this.h.onTogglePlainSteel(), push: () => this.h.onToggleReminders(), chat: () => this.h.onToggleChat(), chill: () => this.h.onToggleChill() })[a]();
        syncToggles();
        return;
      }
      if (a === "install") {
        markInstallAsked();
        void promptInstall().then((out) => {
          if (out === "accepted") this.toast("Installing — look for the icon on your home screen");
          if (out === "unavailable") this.toast("Your browser did not offer an install this time");
        });
        return;
      }
      if (a === "install-ios") { markInstallAsked(); this.showIosInstall(); return; }
      if (a === "owner-out") { setAdminKey(""); this.toast("Owner tools locked"); this.showSettings(); return; }
      // Built at the moment of the click, not written into the DOM: a static href carrying the
      // key would sit in this panel's markup, readable by anything that can inspect it, for as
      // long as Settings stays open.
      if (a === "admin") { window.open(`${apiBase}/admin#key=${encodeURIComponent(adminKey())}`, "_blank", "noopener"); return; }
      if (a === "back") this.showMenu();
    });
    // The owner's door: seven taps on the build line, then the key, which the Worker checks.
    // Nothing here grants anything - every admin call is authorised by the Worker itself.
    const build = [...p.querySelectorAll<HTMLElement>(".shell-row")].find((r) => r.textContent?.includes("Build"));
    if (build && !adminKey()) {
      let taps = 0, since = 0;
      build.addEventListener("click", () => {
        const now = Date.now();
        taps = now - since > 2000 ? 1 : taps + 1;
        since = now;
        if (taps >= 7) { taps = 0; this.showAdminPrompt(); }
      });
    }
    p.querySelector<HTMLSelectElement>('select[data-a="lang"]')!.addEventListener("change", (e) => {
      this.h.onSetLang((e.target as HTMLSelectElement).value as Lang); this.refreshLang(); this.showSettings();
    });
    // a rebuild (a new language, a new name, owner tools appearing) reopens where you were
    const body = p.querySelector<HTMLElement>(".shell-body")!;
    body.addEventListener("scroll", () => { this.settingsScroll = body.scrollTop; }, { passive: true });
    // The browser can decide an install is possible after this panel is already drawn, and
    // an accepted install has to turn the row into "Installed" without a rebuild.
    const stop = onInstallChange(() => {
      const rows = [...p.querySelectorAll<HTMLElement>(".shell-row")];
      const here = rows.find((r) => /Install|Add to Home/.test(r.textContent ?? ""));
      if (!here || !p.isConnected) { stop(); return; }
      const next = el("div", "");
      next.innerHTML = installRow();
      const swap = next.firstElementChild;
      if (swap) here.replaceWith(swap);
    });
    this.show(p);
    body.scrollTop = this.settingsScroll;
  }

  /**
   * iOS has no install API, so this is the whole feature there: say which buttons, in order.
   * Safari only: the Share sheet in Chrome or Firefox on iOS has no Add to Home Screen.
   */
  showIosInstall() {
    const p = el("div", "panel small");
    p.innerHTML = `
      <h2>Add to Home Screen</h2>
      <p class="tag">In Safari, three taps and the game gets its own icon — no address bar, and it opens with no signal.</p>
      <ol class="how-steps">
        <li>Tap <b>Share</b> at the bottom of Safari — the square with an arrow coming out of it.</li>
        <li>Scroll down the list and tap <b>Add to Home Screen</b>.</li>
        <li>Tap <b>Add</b>. The fridge appears with your other apps.</li>
      </ol>
      <p class="fine">Only Safari can do this on an iPhone or iPad. If you are in Chrome or Firefox, open magnetclimbers.com in Safari first.</p>
      <button class="primary" data-a="ok">GOT IT</button>`;
    p.addEventListener("click", (e) => { if ((e.target as HTMLElement).dataset.a === "ok") this.showSettings(); });
    this.show(p);
  }

  /**
   * The one nudge. Offered once, after a few climbs, so it lands on someone who has decided
   * they like this rather than on someone who has not played it yet. "Not now" is final.
   */
  showInstallOffer(then: () => void) {
    const i = installState();
    markInstallAsked();
    const p = el("div", "panel small");
    p.innerHTML = `
      <h2>Keep the fridge handy?</h2>
      <p class="tag">Put Magnet Climbers on your home screen: its own icon, the whole screen for the door, and it opens even with no signal.</p>
      <button class="primary" data-a="yes">${i.isIOS ? "SHOW ME HOW" : "INSTALL"}</button>
      <button class="ghost" data-a="no">NOT NOW</button>`;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "yes" && i.isIOS) { this.showIosInstall(); return; }
      if (a === "yes") {
        void promptInstall().then((out) => {
          if (out === "accepted") this.toast("Installing — look for the icon on your home screen");
          then();
        });
        return;
      }
      if (a === "no") then();
    });
    this.show(p);
  }

  /** The pre-run sheet: the last thing between the menu and the door, so kit is a decision
   *  you make about the climb you are about to take. Skipped when there is nothing to buy. */
  /**
   * The kit, as buyable chips. Shared by the pre-run sheet and the Kit panel so the two can
   * never drift into describing the same purchase differently. `sellable` leaves out the
   * sticky floor in chill, where there is no red line for it to slow.
   */
  private kitParts() {
    const s = this.save();
    const sellable = UPGRADES.filter((u) => u.solo && !(u.key === "floor" && s.chill));
    const cheapest = Math.min(...sellable.map((u) => upgradeCost(u, s.kit[u.key])));
    const chips = sellable.map((u) => {
      const lvl = s.kit[u.key], maxed = lvl >= u.max, cost = upgradeCost(u, lvl);
      const can = !maxed && s.coins >= cost;
      return `
        <button class="kit-chip ${maxed ? "maxed" : can ? "" : "disabled"} ${lvl ? "on" : ""}" data-k="${u.key}" ${can ? "" : "disabled"}>
          <b>${u.name} <small>${"\u25cf".repeat(lvl)}${"\u25cb".repeat(u.max - lvl)}</small></b>
          <span>${u.desc}</span>
          <i>${maxed ? "MAX" : `<em>${u.gain ?? ""}</em>$${cost}`}</i>
        </button>`;
    }).join("");
    // Say why every chip is dark, rather than leaving the player to work it out.
    const allMaxed = sellable.every((u) => s.kit[u.key] >= u.max);
    const note = allMaxed ? "Your kit is full for this climb."
      : s.coins < cheapest ? `Not enough coins yet \u2014 the cheapest is $${groupNum(cheapest)}. Coins drop as you climb.`
      : "";
    return { sellable, cheapest, chips, note };
  }

  showQuickKit(start: () => void, opts: { asked?: boolean } = {}) {
    let s = this.save();
    // chill runs have no red line, so a stickier floor would be money for nothing
    const sellable = UPGRADES.filter((u) => u.solo && !(u.key === "floor" && s.chill));
    const cheapest = () => Math.min(...sellable.map((u) => upgradeCost(u, this.save().kit[u.key])));
    /**
     * Auto-kit: fill up in price order until the purse will not stretch, then go. Cheapest
     * first spends the coins on the most levels rather than on one expensive one, which is
     * what a player buying by hand does anyway.
     */
    if (SHOP_ENABLED && s.autoKit && !opts.asked) {
      for (let guard = 0; guard < 12; guard++) {
        const now = this.save();
        const next = sellable
          .filter((u) => now.kit[u.key] < u.max && now.coins >= upgradeCost(u, now.kit[u.key]))
          .sort((a, b) => upgradeCost(a, now.kit[a.key]) - upgradeCost(b, now.kit[b.key]))[0];
        if (!next) break;
        this.h.onBuy(next.key);
      }
      this.clear();
      start();
      return;
    }
    // Nothing to sell and nobody asked for the shop: stay out of the way.
    if (!SHOP_ENABLED) { start(); return; }
    if (s.coins < cheapest() && !opts.asked) { start(); return; }
    s = this.save();
    const st = statsFor(s.kit);
    const p = el("div", "panel kit-quick");
    const { chips, note } = this.kitParts();
    p.innerHTML = `
      <h2>Kit up</h2>
      <p class="tag"><span class="coin">$${groupNum(s.coins)}</span> \u00b7 this climb only${s.kit.power ? ` \u00b7 jump +${Math.round((st.launchMult - 1) * 100)}%` : ""}${s.kit.floor ? ` \u00b7 line -${Math.round((1 - st.floorMult) * 100)}%` : ""}</p>
      ${note ? `<p class="fine kit-note">${note}</p>` : ""}
      <div class="kit-list">${chips}</div>
      <label class="kit-auto"><input type="checkbox" data-a="auto" ${s.autoKit ? "checked" : ""} /> <span>Buy this for me every climb</span></label>
      <button class="go" data-a="play">\u25b6 CLIMB</button>
      <button class="ghost" data-a="back">BACK</button>
    `;
    p.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-a=auto]")) return; // handled on change, below
      const k = t.closest<HTMLElement>("[data-k]")?.dataset.k as UpgradeKey | undefined;
      if (k) { this.h.onBuy(k); this.showQuickKit(start, opts); return; }
      if (t.closest("[data-a=play]")) { this.clear(); start(); return; }
      if (t.closest("[data-a=back]")) this.showMenu();
    });
    p.querySelector<HTMLInputElement>('input[data-a="auto"]')!.addEventListener("change", (e) => {
      const on = (e.target as HTMLInputElement).checked;
      this.h.onToggleAutoKit(on);
      this.toast(on ? "Kit bought automatically from now on" : "You will be asked each climb");
    });
    this.show(p);
  }

  /** Landing panel when the app is opened from a challenge link. */
  /** The live race lobby: the link to send, and a line that says where things stand. */
  /** The lobby: the host is told to send the link, a friend who opened one is told who they wait on. */
  showLiveLobby(o: { link: string; status: string; host: boolean; onShare: () => void; onCancel: () => void }): HTMLElement {
    const p = el("div", "panel small");
    p.innerHTML = `
      <div class="story-icon">👻</div>
      <h2>Live race</h2>
      <p class="tag">${o.host
        ? "Send this link. When your friend opens it you both start on the same fridge, with each other's ghost climbing beside you."
        : "You are in. The race starts the moment you are both here, on the same fridge, with each other's ghost climbing beside you."}</p>
      <div class="rank" style="word-break:break-all;font-size:12px;opacity:.8">${esc(o.link)}</div>
      <p class="tag live-status">${esc(o.status)}</p>
      <button class="${o.host ? "primary" : "ghost"}" data-a="share">${o.host ? "SEND THE LINK" : "SEND THE LINK BACK"}</button>
      <button class="ghost" data-a="cancel">CANCEL</button>`;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "share") o.onShare();
      if (a === "cancel") o.onCancel();
    });
    this.show(p);
    return p;
  }
  setLiveStatus(panel: HTMLElement, text: string) {
    if (this.panel !== panel) return;
    const s = panel.querySelector<HTMLElement>(".live-status");
    if (s) s.textContent = text;
  }

  showChallenge(c: { mode: "solo" | "daily"; cm: number; name: string; raceId?: string; day?: string }) {
    const p = el("div", "panel small");
    const today = c.mode === "daily" && c.day === todayKey(), stale = c.mode === "daily" && !today;
    const taken = today && this.save().daily?.day === c.day;
    p.innerHTML = `
      <div class="story-icon">${c.raceId ? "👻" : c.mode === "daily" ? "📅" : "📣"}</div>
      <h2>${esc(c.name)} ${c.raceId ? "wants a race" : c.mode === "daily" ? "climbed today's fridge" : "challenged you"}</h2>
      <div class="big">${c.cm} cm</div>
      <p class="tag">${c.raceId ? "Same fridge, their ghost climbing beside you. Get above it."
        : stale ? "That was another day's fridge. Today's is waiting, one go each."
        : taken ? "You have had today's go. Their height is on today's board."
        : c.mode === "daily" ? "Same fridge for everyone, one go each. Get above it before midnight Central."
        : "Solo climb. Their height shows as a line on your fridge. Get above it."}</p>
      <button class="primary" data-a="go">${c.raceId ? "RACE" : taken ? "SEE TODAY'S BOARD" : c.mode === "daily" ? "CLIMB TODAY'S" : "ACCEPT"}</button>
      <button class="ghost" data-a="menu">LATER</button>`;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "go") { if (taken) { this.showBoard("daily"); return; } this.clear(); this.h.onAcceptChallenge(c.mode); }
      if (a === "menu") this.showMenu();
    });
    this.show(p);
  }

  /**
   * A race against a run that wore kit. The gear changes the physics, so the racer is shown
   * what the other run had and offered the same, or the race as they are.
   */
  showKitMatch(o: { name: string; theirs: Record<string, number>; mine: Record<string, number>; cost: number; coins: number; onMatch: () => void; onRace: () => void }) {
    const p = el("div", "panel small");
    const rows = UPGRADES.filter((u) => (o.theirs[u.key] ?? 0) > 0).map((u) => {
      const t = o.theirs[u.key] ?? 0, m = o.mine[u.key] ?? 0;
      return `<div class="kit-match-row"><span>${esc(u.name)} <b>${t}</b></span><span class="${m >= t ? "ok" : "short"}">${m >= t ? "you have it" : `you have ${m}`}</span></div>`;
    }).join("");
    const short = o.coins < o.cost;
    p.innerHTML = `
      <div class="story-icon">🧰</div>
      <h2>${esc(o.name)} climbed with kit</h2>
      <p class="tag">Gear bought before a climb changes the physics of it. Match theirs and the race is even, or race with what you have.</p>
      <div class="kit-match">${rows}</div>
      <button class="primary" data-a="match" ${short ? "disabled" : ""}>MATCH THEIR KIT · $${groupNum(o.cost)}</button>
      ${short ? `<p class="tag">You have $${groupNum(o.coins)}.</p>` : ""}
      <button class="ghost" data-a="race">RACE WITH MINE</button>`;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "match" && !short) { this.clear(); o.onMatch(); }
      if (a === "race") { this.clear(); o.onRace(); }
    });
    this.show(p);
  }

  /** Shows a freshly minted link code. */
  showLinkCode(code: string, expiresAt: number) {
    const p = el("div", "panel small");
    const mins = Math.max(1, Math.round((expiresAt - Date.now()) / 60000));
    p.innerHTML = `
      <h2>Link code</h2>
      <div class="big code">${esc(code)}</div>
      <p class="tag">On the other device: Settings → Enter a link code. Valid for ${mins} minutes.</p>
      <button class="primary" data-a="ok">DONE</button>`;
    p.addEventListener("click", (e) => { if ((e.target as HTMLElement).dataset.a === "ok") this.showSettings(); });
    this.show(p);
  }

  showClaimPrompt() {
    const p = el("div", "panel small");
    p.innerHTML = `
      <h2>Enter link code</h2>
      <p class="tag">From Settings on your other device. This replaces the profile on this device.</p>
      <input id="code-in" maxlength="7" placeholder="ABC123" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:4px" />
      <p class="fine err" hidden></p>
      <button class="primary" data-a="ok">LINK</button>
      <button class="ghost" data-a="back">CANCEL</button>`;
    const input = p.querySelector<HTMLInputElement>("#code-in")!;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "ok") this.h.onEnterCode(input.value);
      if (a === "back") this.showSettings();
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.h.onEnterCode(input.value); });
    this.show(p);
    setTimeout(() => input.focus(), 50);
  }

  /** Type the ADMIN_KEY once per device. It is checked against the Worker before it is kept. */
  showAdminPrompt() {
    const p = el("div", "panel small");
    p.innerHTML = `
      <h2>Owner tools</h2>
      <p class="tag">The Worker's ADMIN_KEY. Checked before it is kept, and stored only on this device.</p>
      <input id="admin-in" type="password" placeholder="ADMIN_KEY" autocomplete="off" />
      <p class="fine err" hidden></p>
      <button class="primary" data-a="ok">UNLOCK</button>
      <button class="ghost" data-a="back">CANCEL</button>`;
    const input = p.querySelector<HTMLInputElement>("#admin-in")!;
    const err = p.querySelector<HTMLElement>(".err")!;
    const submit = async () => {
      const key = input.value.trim();
      if (!key) return;
      err.hidden = false; err.textContent = "Checking...";
      if (await checkAdminKey(key)) { setAdminKey(key); this.toast("Owner tools unlocked"); this.showSettings(); return; }
      err.textContent = "That key was refused.";
    };
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "ok") void submit();
      if (a === "back") this.showSettings();
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") void submit(); });
    this.show(p);
    setTimeout(() => input.focus(), 50);
  }

  showClaimError(text: string) {
    const err = this.panel?.querySelector<HTMLElement>(".err");
    if (err) { err.textContent = text; err.hidden = false; }
  }

  /** Back story, three slides. */
  /** The rules, grouped by what each thing does to you; art tiles, not a catalogue (handoff 3c). */
  showHowToPlay() {
    const p = el("div", "panel shell how-to");
    const base = import.meta.env.BASE_URL;
    const tile = (r: { name: string; art?: string; swatch?: string; note?: string; count?: number; icon: string; fit?: string; focus?: string }) => {
      // objects are shown whole; only the flat surfaces fill their tile
      const style = r.focus ? ` style="object-position:${r.focus}"` : "";
      const art = r.art
        ? `<img class="art ${r.fit ?? "contain"}" src="${base}${r.art}" alt="" loading="lazy"${style} />`
        : `<span class="art ${r.swatch ?? ""}"></span>`;
      const note = r.count ? `${r.note ?? ""} · ${r.count}`.replace(/^ · /, "") : (r.note ?? "");
      return `<div class="art-tile">${art}<b>${r.name}</b>${note ? `<i>${note}</i>` : ""}</div>`;
    };
    const sections = howToSections().map((sec) => {
      // "Climbing" is technique, not objects: it stays as text rows
      const asText = sec.rows.every((r) => !r.art && !r.swatch);
      return `<p class="sec-label">${sec.title}</p>
        ${sec.blurb ? `<p class="how-blurb">${sec.blurb}</p>` : ""}
        ${asText
          ? sec.rows.map((r) => `<div class="shell-row"><span class="how-icon">${r.icon}</span><span class="txt"><b>${r.name}</b><small>${r.text}</small></span></div>`).join("")
          : `<div class="tile-grid">${sec.rows.map(tile).join("")}</div>`}`;
    }).join("");
    p.innerHTML = `
      <div class="shell-head"><button class="shell-back" data-a="back" aria-label="Back">‹</button><h2>How to play</h2><span class="shell-spacer"></span></div>
      <div class="shell-body">
        <p class="how-intro">Fling the toys up the fridge. Magnets only stick to bare steel — the whole game is getting across everything that isn't.</p>
        ${sections}
      </div>
      <span class="shell-fade"></span>
      <div class="shell-foot"><button class="shell-primary" data-a="try">TRY IT</button></div>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]")?.dataset.a;
      if (a === "try") { this.clear(); this.h.onTutorial(); }
      if (a === "back") this.showMenu();
    });
    this.show(p);
  }

  showStory(done: () => void) {
    const base = import.meta.env.BASE_URL;
    const slides = [
      { scene: "story-1-life", icon: "🧲", title: "Life on the fridge", text: "We are the magnet people. We hold up the pizza menu, the dentist card, the photo of Cooper. Good job. Steady work." },
      { scene: "story-2-bedtime", icon: "🧒", title: "Then bedtime came", text: "Cooper \"tidied up\". Now we are on the floor, and the sock drawer is next. Anyone still on the fridge by morning stays on the fridge." },
      { scene: "story-3-climb", icon: "⬆️", title: "So we climb", text: "Fling, stick, climb. Steel holds. Glass, plastic and stickers don't. The red line is Cooper's reach. Stay above it." },
    ];
    let i = 0;
    const p = el("div", "panel story-card");
    const render = () => {
      const sl = slides[i];
      p.innerHTML = `
        <img class="story-scene" src="${base}art/story/${sl.scene}.webp" alt="" width="768" height="512" />
        <span class="story-label">THE STORY · ${i + 1} OF ${slides.length}</span>
        <h2>${sl.title}</h2>
        <p class="story-body">${sl.text}</p>
        <div class="dots">${slides.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
        <button class="shell-primary" data-a="next">${i < slides.length - 1 ? "NEXT" : "LET'S CLIMB"}</button>
        ${i < slides.length - 1 ? `<button class="story-skip" data-a="skip">SKIP</button>` : ""}`;
      this.startPreviews(p);
    };
    render();
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "next") { if (i < slides.length - 1) { i++; render(); } else { this.clear(); done(); } }
      if (a === "skip") { this.clear(); done(); }
    });
    this.show(p);
    // render() runs once before the panel is appended, and the preview loop stops on a
    // disconnected node, so the first slide's creature never drew. Start it once it is in.
    this.startPreviews(p);
  }

  /** Small non-blocking coaching bubble during the tutorial run. */
  private tip: HTMLElement | null = null;
  showTip(text: string, cta = "") {
    this.hideTip();
    const t = el("div", "tip", `<span>${text}</span>${cta ? `<button data-a="cta">${cta}</button>` : ""}`);
    t.querySelector("[data-a=cta]")?.addEventListener("click", () => this.hideTip());
    this.root.appendChild(t);
    this.tip = t;
    setTimeout(() => t.classList.add("show"), 10);
  }
  hideTip() {
    this.tip?.remove();
    this.tip = null;
  }

  /**
   * The mission you are closest to finishing, on screen while you climb. Missions were only
   * ever visible on the menus either side of a run, so the one thing that would actually make
   * a player go for one -- knowing they are two gadgets short with the line still far below --
   * was the one thing never shown. Nearest to done rather than all three: the point is a
   * nudge, not a second HUD.
   */
  private missionStrip: HTMLElement | null = null;
  setMissionStrip(text: string | null, pct = 0, done = false) {
    if (!text) { this.missionStrip?.remove(); this.missionStrip = null; return; }
    if (!this.missionStrip) {
      this.missionStrip = el("div", "run-mission", `<span></span><i><b></b></i>`);
      this.root.appendChild(this.missionStrip);
      requestAnimationFrame(() => this.missionStrip?.classList.add("show"));
    }
    const label = this.missionStrip.querySelector("span")!;
    if (label.textContent !== text) label.textContent = text;
    this.missionStrip.classList.toggle("done", done);
    (this.missionStrip.querySelector("i > b") as HTMLElement).style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }

  /** This week's standing, held while the league tab is open. */
  private league: LeagueStanding | null = null;
  showBoard(mode: BoardMode) {
    const s = this.save();
    this.h.onOpenBoard();
    const p = el("div", "panel shell board");
    const render = (rows: ScoreRow[] | null, rank: { rank: number | null; cm?: number } | null) => {
      const up = this.league?.promote ?? 10, down = this.league?.relegate ?? 10;
      const zone = (i: number, n: number) => mode !== "league" ? "" : i < up ? " promote" : n >= up + down && i >= n - down ? " relegate" : "";
      const list = rows && rows.length
        ? rows.map((r, i, all) => `<div class="srow ${r.player_id === s.playerId ? "me" : ""}${zone(i, all.length)}"><span class="n">${i + 1}</span><span class="who">${esc(r.name)}</span><span class="cm">${mode === "lifetime" || mode === "league" ? fmtDistance(r.cm) : mode === "coins" ? `$${r.cm.toLocaleString()}` : `${r.cm} cm`}</span>${r.seconds ? `<span class="t" title="run time">${fmtTime(r.seconds)}</span>` : ""}</div>`).join("")
        : `<p class="tag">${leaderboardEnabled ? (rows ? "No climbs yet. Be first." : "Could not reach the scoreboard.") : "Global scoreboard not configured yet. Local best shown."}</p>`;
      const localMine = mode === "lifetime" ? s.totalCm : mode === "coins" ? s.coins : mode === "daily" ? (s.daily?.day === todayKey() ? s.daily.cm : 0) : mode === "league" ? 0 : s.bestSolo;
      const fmt = (n: number) => mode === "coins" ? `$${n.toLocaleString()}` : fmtDistance(n);
      const mine = leaderboardEnabled
        ? rank?.rank ? `You: #${rank.rank} · ${fmt(rank.cm ?? 0)}` : "You: not on the board yet"
        : `You: ${fmt(localMine)}`;
      p.innerHTML = `
        <div class="shell-head"><button class="shell-back" data-a="back" aria-label="Back">‹</button><h2>${mode === "lifetime" ? "Lifetime climbed" : mode === "coins" ? "Richest climbers" : mode === "daily" ? "Today\u2019s climb" : mode === "league" ? `${esc(this.league?.tierName ?? "")} league`.trim() : "Highest climbs"}</h2><span class="shell-spacer"></span></div>
        <div class="shell-body">
          <div class="seg">
            <button class="${mode === "league" ? "on" : ""}" data-m="league">LEAGUE</button>
            <button class="${mode === "daily" ? "on" : ""}" data-m="daily">TODAY</button>
            <button class="${mode === "solo" ? "on" : ""}" data-m="solo">SOLO</button>
            <button class="${mode === "lifetime" ? "on" : ""}" data-m="lifetime">LIFETIME</button>
            <button class="${mode === "coins" ? "on" : ""}" data-m="coins">COINS</button>
          </div>
          ${mode === "lifetime" ? `<p class="how-blurb">Every centimetre ever climbed, all modes, chill included. Pure dedication.</p>` : ""}
          ${mode === "coins" ? `<p class="how-blurb">Coins on hand right now. Spend them and you drop.</p>` : ""}
          ${mode === "league" ? `<p class="how-blurb">Your bucket this week: metres climbed, everything counts. The top ${this.league?.promote ?? 10} go up a tier on Monday, the bottom ${this.league?.relegate ?? 10} go down.</p>` : ""}
          <div class="srows">${list}</div>
        </div>
        <span class="shell-fade"></span>
        <div class="shell-foot">
          <p class="fine">${mine} · as <b>${esc(s.name || "anonymous")}</b> <button class="link" data-a="name">change</button></p>
          ${mode === "solo" && s.bestSolo > 0 ? `<button class="shell-primary" data-a="share">CHALLENGE FRIENDS TO BEAT ${groupNum(s.bestSolo)} CM</button>` : ""}
          <p class="fine world" hidden></p>
          <p class="fine">${s.runs} runs · ${(s.totalCm / 100).toFixed(1)} m climbed lifetime</p>
        </div>`;
    };
    render(null, null);
    p.querySelector(".srows")!.innerHTML = `<p class="how-blurb">Loading…</p>`;
    if (leaderboardEnabled) void leaderboard.stats().then((st) => {
      if (!st || this.panel !== p) return;
      const w = p.querySelector<HTMLElement>(".world");
      if (!w) return;
      const pl = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
      w.textContent = `Everyone together: ${fmtDistance(st.total_cm)} over ${pl(st.runs, "run")} by ${pl(st.players, "climber")}`;
      w.hidden = false;
    });
    p.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const m = t.dataset.m as BoardMode | undefined;
      if (m) { this.showBoard(m); return; }
      if (t.dataset.a === "back") this.showMenu();
      if (t.dataset.a === "share" && mode === "solo") this.h.onShare({ mode, cm: s.bestSolo });
      if (t.dataset.a === "name") this.showNamePrompt(() => this.showBoard(mode));
    });
    this.show(p);
    if (leaderboardEnabled && mode === "league") {
      void leaderboard.league(s.playerId).then((st) => {
        if (this.panel !== p) return;
        this.league = st;
        render(st?.rows ?? null, st ? { rank: st.rank, cm: st.cm } : null);
      });
    } else if (leaderboardEnabled) {
      void Promise.all([leaderboard.top(mode), leaderboard.rank(mode, s.playerId)]).then(([rows, rank]) => {
        if (this.panel === p) render(rows, rank);
      });
    } else {
      render([], null);
    }
  }

  /** Ask for a display name. `required` hides SKIP (first launch) so scores always post under a name. */
  showNamePrompt(done: () => void, required = false) {
    const s = this.save();
    const p = el("div", "panel small");
    p.innerHTML = `
      <h2>${required ? "Pick your climber name" : "Your climber name"}</h2>
      <p class="tag">Shown on the global scoreboard. 3–12 characters. You can change it any time in Settings.</p>
      <input id="name-in" maxlength="12" placeholder="e.g. FridgeKing" value="${esc(s.name)}" autocomplete="off" autocapitalize="off" />
      <p class="fine err" hidden></p>
      <button class="primary" data-a="ok">${required ? "LET'S CLIMB" : "SAVE"}</button>
      <button class="ghost" data-a="skip">${required ? `KEEP "${esc(s.name)}"` : "CANCEL"}</button>`;
    const input = p.querySelector<HTMLInputElement>("#name-in")!;
    const err = p.querySelector<HTMLElement>(".err")!;
    const finish = (save: boolean) => {
      if (save) {
        const v = input.value.trim().slice(0, 12);
        const why = v.length < 3 ? "At least 3 characters." : nameReason(v);
        if (why) { err.textContent = why; err.hidden = false; input.focus(); return; }
        this.h.onSetName(v);
      }
      this.clear();
      done();
    };
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "ok") finish(true);
      if (a === "skip") finish(false);
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") finish(true); });
    this.show(p);
    setTimeout(() => input.focus(), 50);
  }

  showPause() {
    const p = el("div", "panel small");
    p.innerHTML = `
      <h2>Paused</h2>
      <button class="primary" data-a="resume">RESUME</button>
      <button data-a="end">END RUN &amp; BANK SCORE</button>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "resume") { this.clear(); this.h.onResume(); }
      if (a === "end") { this.clear(); this.h.onEndRun(); }
    });
    this.show(p);
  }

  private lastGameOver: Parameters<Ui["showGameOver"]>[0] | null = null;
  reshowGameOver(): HTMLElement | null {
    return this.lastGameOver ? this.showGameOver(this.lastGameOver) : null;
  }

  showGameOver(o: { cm: number; best: number; coins: number; tokens: number; gems: number; adUsed: boolean; isRecord: boolean; mode: "solo"; missions?: Mission[]; missionsPaid?: number; ended?: boolean; chill?: boolean; unlocked?: CreatureDef[]; walletCoins?: number; walletGems?: number; cause?: DeathCause | null; daily?: boolean;
    /** a live race: one go each, no second life, the room decides the rest */
    race?: boolean }) {
    this.lastGameOver = o;
    // The dock grows upward into this card rather than a centred dialog (handoff 1h).
    const p = el("div", "panel lost-card");
    // One climber, so the card speaks to a person, never to a crew.
    const crew = false;
    const title = o.isRecord ? "NEW RECORD" : o.chill ? "CHILL RUN DONE" : o.ended ? "RUN BANKED"
      : crew ? "ALL CLIMBERS LOST" : "RUN OVER";
    // what actually ended it, in the run's own words. A banked or won run has no cause.
    const who = crew ? "the last climber" : "you";
    const causes: Record<DeathCause, string> = {
      redline: `The red line caught ${who}.`,
      fell: crew ? "The last climber fell off the fridge." : "You fell off the fridge.",
      paw: `The cat got ${who}.`,
      hand: crew ? "Cooper swatted the last climber off." : "Cooper swatted you off.",
      bumper: crew ? "A moving magnet knocked the last climber loose." : "A moving magnet knocked you loose.",
      flings: "Out of flings, short of the goal.",
    };
    const cause = !o.ended && o.cause ? causes[o.cause] : "";
    const revives = [
      // Cheapest first, and only one of them may say FREE. The ad costs no coins but it does
      // cost half a minute, so labelling both of them free hid the one that is actually free.
      o.tokens > 0 ? { a: "token", top: "FREE GO", sub: `${o.tokens} LEFT`, cls: "accent" } : null,
      !o.adUsed ? { a: "ad", top: "WATCH AD", sub: "ONCE A RUN", cls: "accent" } : null,
      { a: "gems", top: "◆ 5", sub: "GEMS", cls: o.gems >= 5 ? "gem" : "gem disabled" },
    ].filter(Boolean) as { a: string; top: string; sub: string; cls: string }[];
    p.innerHTML = `
      <div class="lost-head">
        <div>
          <span class="lost-label">${title}</span>
          <div class="lost-cm"><b>${groupNum(o.cm)}</b><i>cm</i></div>
          ${cause ? `<p class="lost-cause">${esc(t(cause))}</p>` : ""}
        </div>
        <div class="lost-meta">
          <span>BEST <b>${groupNum(o.best)}</b></span>
          <span class="rank" hidden></span>
        </div>
      </div>
      ${o.chill ? `<p class="lost-banked"><i>Chill mode: no coins or records. Metres added to the world total.</i></p>` : `
      <div class="lost-banked">
        <span class="earned"><b class="coin">+${groupNum(o.coins)}</b> <i>BANKED</i></span>
        <span class="totals"><b class="coin">${groupNum(o.walletCoins ?? 0)}</b> <b class="gem">◆ ${groupNum(o.walletGems ?? 0)}</b></span>
      </div>`}
      ${(o.unlocked ?? []).map((c) => `<button class="unlock" data-a="wear" data-c="${c.id}">New creature: <b>${esc(c.name)}</b><small>${esc(c.detail)} · tap to wear</small></button>`).join("")}
      ${o.missions?.length ? `<div class="home-missions lost-missions">
        <span class="mission-head">${o.missionsPaid ? `MISSIONS · $${groupNum(o.missionsPaid)}` : "MISSIONS"}</span>
        ${o.missions.slice(0, 3).map((m) => missionRow(m)).join("")}
      </div>` : ""}
      ${o.ended || o.daily || o.race ? "" : `
      <span class="lost-label dim">${crew ? "REVIVE THE CREW" : "BACK ON THE DOOR"}</span>
      <div class="revive-row">
        ${revives.map((r) => `<button class="revive-cell ${r.cls}" data-a="${r.a}" ${r.a === "gems" && o.gems < 5 ? "disabled" : ""}><b>${r.top}</b><small>${r.sub}</small></button>`).join("")}
      </div>`}
      ${o.daily
        ? `<p class="lost-banked"><i>That was today's climb \u2014 one go each, no second life, same fridge for everyone. A new one at midnight Central.</i></p>
           <button class="go" data-a="board">SEE TODAY'S BOARD</button>`
        : o.race ? `<p class="lost-banked"><i>One go each in a race — no second life. The room replays both climbs and calls it.</i></p>`
        : `<button class="go" data-a="again">CLIMB AGAIN</button>`}
      <div class="lost-ghosts">
        ${o.chill ? "" : `<button class="ghost" data-a="share">${o.daily ? "SHARE TODAY'S CLIMB" : "CHALLENGE A FRIEND"}</button>`}
        <button class="ghost" data-a="quit">BACK TO MENU</button>
      </div>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]")?.dataset.a;
      if (a === "token" || a === "ad" || a === "gems") { this.clear(); this.h.onRevive(a); }
      if (a === "share") this.h.onShare({ mode: o.daily ? "daily" : o.mode, cm: o.cm });
      if (a === "again") this.showQuickKit(() => this.h.onPlay("solo"));
      // the daily is one attempt: there is nothing to climb again, so it offers the board
      if (a === "board") { this.h.onQuitRun(); this.showBoard("daily"); }
      if (a === "quit") { this.clear(); this.h.onQuitRun(); }
      const wear = (e.target as HTMLElement).closest<HTMLElement>("[data-a=wear]")?.dataset.c as CreatureId | undefined;
      if (wear) { this.h.onWear({ creature: wear, pattern: this.save().pattern }); this.toast(`Wearing ${creatureById(wear).name}`); }
    });
    this.show(p);
    return p;
  }

  /** Update the rank line on an open game-over panel. */
  /** One more button on a game-over card, above BACK TO MENU: the live race's "again", for one. */
  addGameOverAction(panel: HTMLElement, label: string, onTap: () => void): void {
    if (this.panel !== panel) return;
    const row = panel.querySelector<HTMLElement>(".lost-ghosts");
    if (!row || row.querySelector("[data-added]")) return;
    const b = el("button", "go", label) as HTMLButtonElement; b.dataset.added = "1";
    b.addEventListener("click", (e) => { e.stopPropagation(); b.disabled = true; b.textContent = "WAITING FOR THEM…"; onTap(); });
    row.parentElement!.insertBefore(b, row);
  }
  setGameOverRank(panel: HTMLElement, text: string) {
    if (this.panel !== panel) return;
    const r = panel.querySelector<HTMLElement>(".rank");
    if (r) { r.textContent = text; r.hidden = false; }
  }

  /** Placeholder for a rewarded video: a short countdown. Swapped for AdMob / Unity Ads in the native builds. */
  showAdPlaceholder(seconds: number, done: () => void) {
    const p = el("div", "panel small ad");
    let left = seconds;
    const render = () => (p.innerHTML = `<h2>Ad placeholder</h2><div class="big">${left}</div><p class="tag">A rewarded video plays here in the store builds.</p>`);
    render();
    this.show(p);
    const iv = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(iv); this.clear(); done(); } else render();
    }, 1000);
  }

  private banner: HTMLElement | null = null;
  showUpdateBanner(apply: () => void) {
    if (this.banner) return;
    const b = el("div", "update-banner", "⬆ Update ready · applies after this run · tap to apply now");
    b.addEventListener("click", () => { b.remove(); this.banner = null; apply(); });
    this.root.appendChild(b);
    this.banner = b;
  }

  /** One big word in the middle of the fridge: 3, 2, 1, GO. Each call replaces the last. */
  showCountdown(text: string, ms = 700) {
    this.root.querySelector(".countdown")?.remove();
    const c = el("div", "countdown", text);
    this.root.appendChild(c);
    requestAnimationFrame(() => c.classList.add("show"));
    setTimeout(() => { if (c.isConnected) c.remove(); }, ms);
  }
  toast(text: string) {
    const t = el("div", "toast", text);
    this.root.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 1800);
  }
}
