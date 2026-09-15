import { RESERVE_COST, SHOP_ENABLED, UPGRADES, statsFor, upgradeCost, type UpgradeKey } from "./config";
import { CREATURES, PATTERNS, PRIZE_COST, PRIZE_ODDS, appearanceFor, creatureById, patternById, patternColors, unlockText, type CreatureDef, type CreatureId, type Look, type PatternDef } from "./creatures";
import { drawClimber } from "./climber-render";
import { PACKS, INTROS, isUnlocked, nextLevel, type LevelDef } from "./expeditions";
import { resetRagdoll } from "./ragdoll";
import type { Climber } from "./types";
import type { SaveData } from "./save";
import { leaderboard, leaderboardEnabled, chat, type BoardMode, type ScoreRow, type ChatMessage } from "./leaderboard";
import { nameReason } from "./profanity";
import { howToSections } from "./how-to-play";
import { LANGS, lang, t, translateTree, watchTree, type Lang } from "./i18n";
import { setChatStrip, groupNum } from "./hud";

export interface UiHandlers {
  onPlay(rules: "solo" | "crew"): void;
  onPlayLevel(id: string): void;
  onNextLevel(id: string): void;
  onIntroSeen(key: string): void;
  onResume(): void;
  /** the MENU button: freeze the sim before the pause panel shows */
  onPause(): void;
  onQuitRun(): void;
  onEndRun(): void;
  onBuy(key: UpgradeKey): void;
  onBuyReserve(): void;
  /** Wear a creature + pattern for solo runs (and as the crew default). */
  onWear(look: Look): void;
  /** Dress one crew slot. */
  onWearCrew(slot: number, look: Look): void;
  /** The one-time free creature choice. */
  onPickFirst(creature: string): void;
  /** Spend coins on the prize machine; null when unaffordable or the collection is complete. */
  onSpin(): PatternDef | null;
  onRevive(method: "token" | "ad" | "gems"): void;
  onToggleSound(): void;
  onToggleMusic(): void;
  /** HUD speaker button: silences (or restores) both music and effects. */
  onToggleMute(): void;
  onToggleChill(): void;
  onSetLang(lang: Lang): void;
  onSetName(name: string): void;
  onUpdate(): void;
  onLinkDevice(): void;
  onOpenBoard(): void;
  onEnterCode(code: string): void;
  onTutorial(): void;
  onShare(c: { mode: "solo" | "crew"; cm: number }): void;
  onAcceptChallenge(mode: "solo" | "crew"): void;
  /** Global chat send; resolves to an error string or null on success. */
  onChat(text: string): Promise<string | null>;
}

/** newest chat id the player has looked at (per device) */
const chatSeen = () => { try { return Number(localStorage.getItem("mc-chat-seen") ?? 0) || 0; } catch { return 0; } };
/** a stable hue per name so the ticker reads like a chat */
const nameColor = (name: string) => { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return `hsl(${h % 360} 70% 68%)`; };
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
      if (panel.classList.contains("shop") || panel.classList.contains("collection") ||   panel.classList.contains("expeditions") || panel.classList.contains("how-to")) exit.hidden = true;
    }
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
    this.setChatStripVisible(inRun && leaderboardEnabled);
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
    void chat.list(0).then((r) => {
      if (!r || el !== this.chatStrip || !el.isConnected) return;
      const lines = el.querySelector<HTMLElement>(".lines"), badge = el.querySelector<HTMLElement>(".badge");
      const last = r.messages.slice(-2);
      if (lines) lines.innerHTML = last.length
        ? last.map((m) => `<span><b style="color:${nameColor(m.name)}">${esc(m.name)}:</b> ${esc(m.text)}</span>`).join("")
        : `<i>${t("Global chat")} · ${r.online} ${t("online")}</i>`;
      const unread = r.messages.filter((m) => m.id > chatSeen()).length;
      if (badge) { badge.hidden = !unread; badge.textContent = unread > 99 ? "99+" : String(unread); }
    });
  }

  showMenu() {
    const s = this.save();
    if (!s.picked && s.runs >= 1) { this.showFirstPick(); return; }
    // No full-height panel: the title fridge is the background, a scrim carries the text (handoff 2a).
    const p = el("div", "home");
    const stars = Object.values(s.expeditions).reduce((a, b) => a + b, 0);
    const icon = (a: string, art: string, text: string) =>
      `<button class="home-icon" data-a="${a}"><img src="${import.meta.env.BASE_URL}art/ui/${art}.webp" alt="" /><span>${text}</span></button>`;
    p.innerHTML = `
      <div class="home-top">
        <button class="home-settings" data-a="settings" aria-label="Settings"><img src="${import.meta.env.BASE_URL}art/ui/settings.webp" alt="" /></button>
        <button class="wallet-chip" data-a="collection" aria-label="Creatures &amp; patterns">
          <b class="coin">${groupNum(s.coins)}</b><b class="gem">◆ ${groupNum(s.gems)}</b><b class="star">★ ${groupNum(stars)}</b>
        </button>
      </div>
      <img class="home-wordmark" src="${import.meta.env.BASE_URL}art/title-logo.webp" alt="Magnet Climbers" width="1100" height="495" fetchpriority="high" />
      <p class="home-tag">Fling rubbery magnet toys up an endless fridge. Stick to steel. Outrun Cooper.</p>
      <div class="home-bottom">
      <div class="home-icons">
        ${icon("story", "story", "STORY")}
        ${icon("board", "board", "BOARD")}
        ${icon("tutorial", "help", "HOW TO")}
      </div>
      <div class="home-dock">
        <div class="home-modes">
          <button class="mode-tile solo" data-a="solo">
            <b>SOLO CLIMB</b><small>Endless fridge, outrun the line.</small>
            <i>BEST ${groupNum(s.bestSolo)} CM</i>
          </button>
          <button class="mode-tile exp" data-a="expeditions">
            <b>EXPEDITIONS</b><small>Crew puzzles, a fling budget, three stars.</small>
            <i>★ ${groupNum(stars)}</i>
          </button>
        </div>
        <label class="home-row ${s.chill ? "on" : ""}">
          <b class="chill">CHILL</b><small>no red line</small>
          <input type="checkbox" data-a="chill" ${s.chill ? "checked" : ""} aria-label="Chill mode" /><i class="toggle"></i>
        </label>
        <button class="home-row" data-a="collection">
          <b>CREATURES</b>
          <canvas class="home-creature" width="34" height="34" data-look="${s.creature ?? "human"}|${s.pattern ?? ""}"></canvas>
        </button>
      </div>
      </div>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]")?.dataset.a;
      if (a === "expeditions") this.showExpeditions();
      if (a === "solo") this.h.onPlay("solo");
      if (a === "collection") this.showCollection();
      if (a === "board") this.showBoard("crew");
      if (a === "settings") this.showSettings();
      if (a === "tutorial") this.showHowToPlay();
      if (a === "story") this.showStory(() => this.showMenu());
    });
    p.querySelector<HTMLInputElement>('input[data-a="chill"]')!.addEventListener("change", () => { this.h.onToggleChill(); this.showMenu(); });
    this.show(p);
    // the chat strip lives on the home screen too, with the same unread badge
    this.setChatStripVisible(leaderboardEnabled);
    this.startPreviews(p);
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
        const ctx = cv.getContext("2d")!; ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, 100, 100);
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
  showCollection(tab: "creatures" | "patterns" | "crew" = "creatures") {
    const s = this.save();
    const p = el("div", "panel collection");
    const teamSize = statsFor(s.upgrades).teamSize;
    const owned = (c: CreatureDef) => s.creatures.includes(c.id);
    let body = "";
    if (tab === "creatures") {
      body = `<div class="guide-grid">${CREATURES.map((c) => {
        const on = s.creature === c.id, has = owned(c);
        return `<button class="guide-card look ${on ? "on" : ""} ${has ? "" : "locked"}" data-c="${c.id}" ${has ? "" : "disabled"}>
          <canvas width="200" height="200" data-look="${c.id}|${has ? s.pattern : "stealth"}"></canvas>
          <b>${esc(c.name)}</b><span>${has ? esc(c.blurb) : "🔒 " + esc(unlockText(c.unlock))}</span>${on ? "<i class=\"tick\">WEARING</i>" : ""}
        </button>`; }).join("")}</div>`;
    } else if (tab === "patterns") {
      body = `<div class="guide-grid">${PATTERNS.map((k) => {
        const on = s.pattern === k.id, has = s.patterns.includes(k.id);
        return `<button class="guide-card look ${on ? "on" : ""} ${has ? "" : "locked"}" data-p="${k.id}" ${has ? "" : "disabled"}>
          <canvas width="200" height="200" data-look="${has ? s.creature : "toy"}|${k.id}"></canvas>
          <b>${esc(k.name)} <em class="r ${k.rarity}">${k.rarity}</em></b>
          <span class="swatches">${k.colors.map((c) => `<i style="background:${c}"></i>`).join("")}</span>${on ? "<i class=\"tick\">WEARING</i>" : has ? "" : "<span>🔒 prize machine</span>"}
        </button>`; }).join("")}</div>
        <button class="primary" data-a="prize">🎰 PRIZE MACHINE · $${PRIZE_COST}</button>`;
    } else {
      const slots = Array.from({ length: teamSize }, (_, i) => s.crew[i] ?? { creature: s.creature, pattern: s.pattern });
      body = `<p class="tag">Tap a toy to change its creature, tap the swatch for its pattern. ${teamSize} climbers start a crew run.</p>
        <div class="guide-grid">${slots.map((l, i) => `<div class="guide-card look">
          <canvas width="200" height="200" data-look="${l.creature}|${l.pattern}"></canvas>
          <button class="chip" data-slot="${i}" data-cycle="c">${esc(creatureById(l.creature).name)} ›</button>
          <button class="chip" data-slot="${i}" data-cycle="p"><span class="swatches">${patternColors(l.pattern).slice(0, 3).map((c) => `<i style="background:${c}"></i>`).join("")}</span>${esc(patternById(l.pattern).name)} ›</button>
        </div>`).join("")}</div>`;
    }
    p.innerHTML = `<h2>Collection</h2>
      <div class="tabs"><button class="${tab === "creatures" ? "on" : ""}" data-tab="creatures">CREATURES ${s.creatures.length}/${CREATURES.length}</button><button class="${tab === "patterns" ? "on" : ""}" data-tab="patterns">PATTERNS ${s.patterns.length}/${PATTERNS.length}</button><button class="${tab === "crew" ? "on" : ""}" data-tab="crew">CREW</button></div>
      ${body}
      <button class="ghost" data-a="back">BACK</button>`;
    p.addEventListener("click", (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-tab],[data-c],[data-p],[data-slot],[data-a]");
      if (!t) return;
      if (t.dataset.tab) { this.showCollection(t.dataset.tab as "creatures"); return; }
      if (t.dataset.c) { this.h.onWear({ creature: t.dataset.c as CreatureId, pattern: this.save().pattern }); this.showCollection("creatures"); return; }
      if (t.dataset.p) { this.h.onWear({ creature: this.save().creature, pattern: t.dataset.p }); this.showCollection("patterns"); return; }
      if (t.dataset.slot) {
        const sv = this.save(); const i = Number(t.dataset.slot);
        const cur = sv.crew[i] ?? { creature: sv.creature, pattern: sv.pattern };
        const next = (list: string[], id: string) => list[(list.indexOf(id) + 1) % list.length];
        this.h.onWearCrew(i, t.dataset.cycle === "c" ? { creature: next(sv.creatures, cur.creature) as CreatureId, pattern: cur.pattern } : { creature: cur.creature, pattern: next(sv.patterns, cur.pattern) });
        this.showCollection("crew"); return;
      }
      if (t.dataset.a === "prize") this.showPrize();
      if (t.dataset.a === "back") this.showMenu();
    });
    this.show(p);
    this.startPreviews(p);
  }

  /** The coin prize machine: visible odds, no duplicates, one pattern per spin. */
  showPrize(result: PatternDef | null = null) {
    const s = this.save();
    const left = PATTERNS.filter((k) => !s.patterns.includes(k.id));
    const p = el("div", "panel small prize");
    const can = s.coins >= PRIZE_COST && left.length > 0;
    p.innerHTML = `<h2>Prize machine</h2>
      ${result ? `<div class="reveal"><canvas width="200" height="200" data-look="${s.creature}|${result.id}"></canvas><b>${esc(result.name)}</b><em class="r ${result.rarity}">${result.rarity}</em><p class="tag">Now wearing it. Change any time in the collection.</p></div>`
        : `<div class="story-icon">🎰</div><p class="tag">One spin, one new pattern. Never a duplicate.<br/>${left.length} left to find.</p>`}
      <p class="fine">Odds: common ${PRIZE_ODDS.common}% · rare ${PRIZE_ODDS.rare}% · epic ${PRIZE_ODDS.epic}%</p>
      <button class="primary ${can ? "" : "disabled"}" data-a="spin" ${can ? "" : "disabled"}>${left.length ? `SPIN · $${PRIZE_COST}` : "COLLECTION COMPLETE"}</button>
      <p class="fine">You have <span class="coin">$${s.coins}</span></p>
      <button class="ghost" data-a="back">BACK</button>`;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "spin") { const won = this.h.onSpin(); if (won) this.showPrize(won); }
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
    const p = el("div", "panel chat");
    p.innerHTML = `<h2>Global chat</h2>
      <p class="fine">Everyone playing right now. Be kind. No personal info, no links. <span class="online"></span></p>
      <div class="chat-log" aria-live="polite"><p class="fine">Loading…</p></div>
      <form class="chat-form"><input type="text" maxlength="160" placeholder="Say something as ${esc(s.name)}" autocomplete="off" enterkeyhint="send" /><button class="primary" type="submit">SEND</button></form>
      <p class="fine err" hidden></p>
      <button class="ghost" data-a="back">BACK</button>`;
    const log = p.querySelector<HTMLElement>(".chat-log")!, online = p.querySelector<HTMLElement>(".online")!, err = p.querySelector<HTMLElement>(".err")!;
    const input = p.querySelector<HTMLInputElement>("input")!;
    let lastId = 0; const seen = new Map<number, ChatMessage>();
    const render = () => {
      const rows = [...seen.values()].sort((a, b) => a.id - b.id).slice(-60);
      log.innerHTML = rows.length ? rows.map((m) => `<div class="msg ${m.player_id === s.playerId ? "me" : ""}"><b>${esc(m.name)}</b> ${esc(m.text)}</div>`).join("") : `<p class="fine">Nobody has said anything yet. You could be first.</p>`;
      log.scrollTop = log.scrollHeight;
    };
    const poll = async () => {
      if (!p.isConnected) { if (this.chatTimer) clearInterval(this.chatTimer); this.chatTimer = null; return; }
      const r = await chat.list(lastId);
      if (!r || !p.isConnected) return;
      for (const m of r.messages) { seen.set(m.id, m); lastId = Math.max(lastId, m.id); }
      if (lastId > chatSeen()) { try { localStorage.setItem("mc-chat-seen", String(lastId)); } catch { /* private mode */ } }
      online.textContent = r.online ? `· ${r.online} chatting lately` : "";
      if (r.messages.length || !seen.size) render();
    };
    if (this.chatTimer) clearInterval(this.chatTimer);
    void poll(); this.chatTimer = window.setInterval(poll, 4000);
    p.querySelector("form")!.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim(); if (!text) return;
      input.value = ""; err.hidden = true;
      const problem = await this.h.onChat(text);
      if (problem) { err.textContent = problem; err.hidden = false; input.value = text; }
      else void poll();
    });
    p.addEventListener("click", (e) => { if ((e.target as HTMLElement).dataset.a === "back") this.showMenu(); });
    this.show(p);
    input.focus();
  }

  /** Pack and level picker. Levels open one at a time; stars persist per level. */
  showExpeditions(packId: string = PACKS[0].id) {
    const s = this.save();
    const pack = PACKS.find((p) => p.id === packId) ?? PACKS[0];
    const p = el("div", "panel collection expeditions");
    p.innerHTML = `<h2>Expeditions</h2>
      <p class="tag">${esc(pack.blurb)}</p>
      <div class="tabs">${PACKS.map((k) => `<button class="${k.id === pack.id ? "on" : ""}" data-pack="${k.id}">${esc(k.name)}</button>`).join("")}</div>
      <div class="level-grid">${pack.levels.map((l, i) => {
        const st = s.expeditions[l.id] ?? 0, open = isUnlocked(l.id, s.expeditions);
        return `<button class="level ${open ? "" : "locked"} ${st ? "done" : ""}" data-level="${l.id}" ${open ? "" : "disabled"}>
          <b>${i + 1}</b><span>${esc(l.name)}</span><i>${"★".repeat(st)}${"☆".repeat(3 - st)}</i></button>`; }).join("")}</div>
      <p class="fine">${pack.levels.filter((l) => s.expeditions[l.id]).length}/${pack.levels.length} done · ${pack.levels.reduce((a, l) => a + (s.expeditions[l.id] ?? 0), 0)}/${pack.levels.length * 3} stars</p>
      <button class="ghost" data-a="back">BACK</button>`;
    p.addEventListener("click", (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-pack],[data-level],[data-a]");
      if (!t) return;
      if (t.dataset.pack) this.showExpeditions(t.dataset.pack);
      else if (t.dataset.level) this.h.onPlayLevel(t.dataset.level);
      else if (t.dataset.a === "back") this.showMenu();
    });
    this.show(p);
  }

  /** Two-line teaching card before a level that introduces a trick. */
  showIntro(key: keyof typeof INTROS, go: () => void) {
    const card = INTROS[key];
    const p = el("div", "panel small intro");
    p.innerHTML = `<div class="story-icon">${key === "stack" ? "🪜" : key === "catch" ? "🤝" : "🎯"}</div>
      <h2>${esc(card.title)}</h2>${card.lines.map((l) => `<p class="tag">${esc(l)}</p>`).join("")}
      <button class="primary" data-a="go">GOT IT</button>`;
    p.addEventListener("click", (e) => { if ((e.target as HTMLElement).dataset.a === "go") { this.clear(); go(); } });
    this.show(p);
  }

  showLevelResult(o: { level: LevelDef; won: boolean; stars: number; flings: number; lost: number; earned: number; unlocked?: CreatureDef[] }) {
    const p = el("div", "panel small");
    const next = nextLevel(o.level.id);
    p.innerHTML = `
      <h2>${o.won ? (o.stars === 3 ? "Perfect!" : "Made it!") : o.lost >= o.level.team ? "Everyone lost" : "Out of flings"}</h2>
      <div class="big stars">${o.won ? "★".repeat(o.stars) + "☆".repeat(3 - o.stars) : "☆☆☆"}</div>
      <p class="tag">${esc(o.level.name)} · ${o.flings} flings${o.won ? ` (par ${o.level.par})` : ""}${o.lost ? ` · ${o.lost} lost` : ""}</p>
      ${o.won && o.stars < 3 ? `<p class="fine">${o.flings > o.level.par ? "Under par for a star. " : ""}${o.lost ? "Lose nobody for a star." : ""}</p>` : ""}
      <p class="tag">Earned <span class="coin">$${o.earned}</span></p>
      ${(o.unlocked ?? []).map((c) => `<button class="unlock" data-a="wear" data-c="${c.id}">🎉 New creature: <b>${esc(c.name)}</b><small>${esc(c.detail)} · tap to wear</small></button>`).join("")}
      ${o.won && next ? `<button class="primary" data-a="next">NEXT LEVEL</button>` : ""}
      <button class="${o.won ? "" : "primary"}" data-a="retry">${o.won ? "PLAY AGAIN" : "TRY AGAIN"}</button>
      <button class="ghost" data-a="map">ALL LEVELS</button>`;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      const wear = (e.target as HTMLElement).closest<HTMLElement>("[data-a=wear]")?.dataset.c as CreatureId | undefined;
      if (wear) { this.h.onWear({ creature: wear, pattern: this.save().pattern }); this.toast(`Wearing ${creatureById(wear).name}`); return; }
      if (a === "next") { this.clear(); this.h.onQuitRun(); this.h.onNextLevel(o.level.id); }
      if (a === "retry") { this.clear(); this.h.onQuitRun(); this.h.onPlayLevel(o.level.id); }
      if (a === "map") { this.clear(); this.h.onQuitRun(); this.showExpeditions(); }
    });
    this.show(p);
  }

  /** Profile, preferences and appearance in one place. */
  showSettings() {
    const s = this.save();
    const p = el("div", "panel shell settings");
    const base = import.meta.env.BASE_URL;
    const row = (title: string, sub: string, control: string) =>
      `<div class="shell-row"><span class="txt"><b>${title}</b><small>${sub}</small></span>${control}</div>`;
    const chip = (a: string, text: string) => `<button class="shell-chip" data-a="${a}">${text}</button>`;
    const toggle = (a: string, on: boolean, aria: string) =>
      `<label class="shell-toggle ${on ? "on" : ""}"><input type="checkbox" data-a="${a}" ${on ? "checked" : ""} aria-label="${aria}" /><i></i></label>`;
    p.innerHTML = `
      <div class="shell-head"><button class="shell-back" data-a="back" aria-label="Back">‹</button><h2>Settings</h2><span class="shell-spacer"></span></div>
      <div class="shell-body">
        <p class="sec-label">Profile</p>
        ${row("Climber name", `${esc(s.name || "not set")} · shown on the scoreboard`, chip("name", "CHANGE"))}
        ${row("Creatures &amp; patterns", "Pick who climbs and how they are painted", chip("collection", "OPEN"))}
        ${SHOP_ENABLED ? row("Upgrades &amp; reserves", "Spend coins on the team", chip("shop", "OPEN")) : ""}
        <p class="sec-label">Play on another device</p>
        ${row("Link a new device", "Shows a 6-letter code. Enter it on the other device to carry this profile over.", chip("link", "CODE"))}
        ${row("Enter a link code", "Adopt a profile from another device. Replaces this one.", chip("claim", "ENTER"))}
        <p class="sec-label">Preferences</p>
        ${row("Language", LANGS.map((l) => l.name).join(" · "),
          `<select class="shell-chip" data-a="lang" aria-label="Language">${LANGS.map((l) => `<option value="${l.id}" ${l.id === lang() ? "selected" : ""}>${l.name}</option>`).join("")}</select>`)}
        ${row("Sound effects", "Rubber twangs, steel clicks and hand swishes", toggle("sound", s.sound, "Sound effects"))}
        ${row("Music", "Original toy-box groove; builds as danger approaches", toggle("music", s.music, "Music"))}
        ${row("Chill mode", "No red line. No coins or records; metres still count for the world total", toggle("chill", s.chill, "Chill mode"))}
      </div>
      <span class="shell-fade"></span>
      <div class="shell-foot">
        <p class="fine">Profile ${esc(s.playerId.slice(0, 10))}… · synced after every run · Build ${__BUILD__} · <button class="link" data-a="update">check for update</button></p>
        <p class="fine"><a href="${base}privacy/" target="_blank" rel="noopener">Privacy</a> · <a href="${base}terms/" target="_blank" rel="noopener">Terms</a> · <a href="${base}contact/" target="_blank" rel="noopener">Contact</a></p>
      </div>`;
    p.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const a = t.dataset.a;
      if (a === "collection") { this.showCollection(); return; }
      if (a === "update") { this.h.onUpdate(); return; }
      if (a === "name") { this.showNamePrompt(() => this.showSettings()); return; }
      if (a === "link") { this.h.onLinkDevice(); return; }
      if (a === "claim") { this.showClaimPrompt(); return; }
      if (a === "sound") { this.h.onToggleSound(); this.showSettings(); return; }
      if (a === "music") { this.h.onToggleMusic(); this.showSettings(); return; }
      if (a === "chill") { this.h.onToggleChill(); this.showSettings(); return; }
      if (a === "shop") { this.showShop(); return; }
      if (a === "back") this.showMenu();
    });
    p.querySelector<HTMLSelectElement>('select[data-a="lang"]')!.addEventListener("change", (e) => {
      this.h.onSetLang((e.target as HTMLSelectElement).value as Lang); this.refreshLang(); this.showSettings();
    });
    this.show(p);
  }

  showShop() {
    const s = this.save();
    const st = statsFor(s.upgrades);
    const p = el("div", "panel shop");
    const rows = UPGRADES.map((u) => {
      const lvl = s.upgrades[u.key];
      const maxed = lvl >= u.max;
      const cost = upgradeCost(u, lvl);
      const can = !maxed && s.coins >= cost;
      return `
        <div class="row">
          <div class="info">
            <b>${u.name} <small>${"●".repeat(lvl)}${"○".repeat(u.max - lvl)}</small></b>
            <span>${u.desc}</span>
          </div>
          <button class="buy ${can ? "" : "disabled"}" data-k="${u.key}" ${can ? "" : "disabled"}>
            ${maxed ? "MAX" : `$${cost}`}
          </button>
        </div>`;
    }).join("");
    p.innerHTML = `
      <h2>Upgrades</h2>
      <p class="tag"><span class="coin">$${s.coins}</span> · team ${st.teamSize} · reach ${st.reach}px · ${st.maxLinks} links</p>
      <div class="rows">${rows}</div>
      <h3>Reserves</h3>
      <div class="rows">
        <div class="row">
          <div class="info"><b>Reserve climber <small>${s.reserves}/5 carried</small></b><span>Drop a fresh climber onto the crew mid-run</span></div>
          <button class="buy ${s.coins >= RESERVE_COST && s.reserves < 5 ? "" : "disabled"}" data-r="1" ${s.coins >= RESERVE_COST && s.reserves < 5 ? "" : "disabled"}>$${RESERVE_COST}</button>
        </div>
      </div>
      <button data-a="collection">🎨 CREATURES &amp; PATTERNS</button>
      <button class="ghost" data-a="back">BACK</button>
    `;
    p.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const k = t.closest<HTMLElement>("[data-k]")?.dataset.k as UpgradeKey | undefined;
      if (k) { this.h.onBuy(k); this.showShop(); return; }
      if (t.closest<HTMLElement>("[data-r]")) { this.h.onBuyReserve(); this.showShop(); return; }
      if (t.dataset.a === "collection") { this.showCollection(); return; }
      if (t.dataset.a === "back") this.showMenu();
    });
    this.show(p);
  }

  /** Landing panel when the app is opened from a challenge link. */
  showChallenge(c: { mode: "solo" | "crew"; cm: number; name: string }) {
    const p = el("div", "panel small");
    p.innerHTML = `
      <div class="story-icon">📣</div>
      <h2>${esc(c.name)} challenged you</h2>
      <div class="big">${c.cm} cm</div>
      <p class="tag">${c.mode === "crew" ? "Crew climb" : "Solo climb"}. Their height shows as a line on your fridge. Get above it.</p>
      <button class="primary" data-a="go">ACCEPT</button>
      <button class="ghost" data-a="menu">LATER</button>`;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "go") { this.clear(); this.h.onAcceptChallenge(c.mode); }
      if (a === "menu") this.showMenu();
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

  showClaimError(text: string) {
    const err = this.panel?.querySelector<HTMLElement>(".err");
    if (err) { err.textContent = text; err.hidden = false; }
  }

  /** Back story, three slides. */
  /** The rules, grouped by what each thing does to you; art tiles, not a catalogue (handoff 3c). */
  showHowToPlay() {
    const p = el("div", "panel shell how-to");
    const base = import.meta.env.BASE_URL;
    const tile = (r: { name: string; art?: string; swatch?: string; note?: string; count?: number; icon: string }) => {
      const art = r.art
        ? `<img class="art" src="${base}${r.art}" alt="" loading="lazy" />`
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
    const slides = [
      { icon: "🧲", title: "Life on the fridge", text: "We are the magnet people. We hold up the pizza menu, the dentist card, the photo of Cooper. Good job. Steady work." },
      { icon: "🧒", title: "Then bedtime came", text: "Cooper \"tidied up\". Now we are on the floor, and the sock drawer is next. Anyone still on the fridge by morning stays on the fridge." },
      { icon: "⬆️", title: "So we climb", text: "Fling, stick, climb. Steel holds. Glass, plastic and stickers don't. The red line is Cooper's reach. Stay above it." },
    ];
    let i = 0;
    const p = el("div", "panel story-card");
    const render = () => {
      const sl = slides[i];
      p.innerHTML = `
        <canvas class="story-creature" width="150" height="150" data-look="${this.save().creature ?? "human"}|${this.save().pattern ?? ""}"></canvas>
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

  showBoard(mode: BoardMode) {
    const s = this.save();
    this.h.onOpenBoard();
    const p = el("div", "panel shell board");
    const render = (rows: ScoreRow[] | null, rank: { rank: number | null; cm?: number } | null) => {
      const list = rows && rows.length
        ? rows.map((r, i) => `<div class="srow ${r.player_id === s.playerId ? "me" : ""}"><span class="n">${i + 1}</span><span class="who">${esc(r.name)}</span><span class="cm">${mode === "lifetime" ? fmtDistance(r.cm) : mode === "coins" ? `$${r.cm.toLocaleString()}` : `${r.cm} cm`}</span>${r.seconds ? `<span class="t" title="run time">${fmtTime(r.seconds)}</span>` : ""}</div>`).join("")
        : `<p class="tag">${leaderboardEnabled ? (rows ? "No climbs yet. Be first." : "Could not reach the scoreboard.") : "Global scoreboard not configured yet. Local best shown."}</p>`;
      const localMine = mode === "lifetime" ? s.totalCm : mode === "coins" ? s.coins : mode === "crew" ? s.bestCm : s.bestSolo;
      const fmt = (n: number) => mode === "coins" ? `$${n.toLocaleString()}` : fmtDistance(n);
      const mine = leaderboardEnabled
        ? rank?.rank ? `You: #${rank.rank} · ${fmt(rank.cm ?? 0)}` : "You: not on the board yet"
        : `You: ${fmt(localMine)}`;
      p.innerHTML = `
        <div class="shell-head"><button class="shell-back" data-a="back" aria-label="Back">‹</button><h2>${mode === "lifetime" ? "Lifetime climbed" : mode === "coins" ? "Richest climbers" : "Highest climbs"}</h2><span class="shell-spacer"></span></div>
        <div class="shell-body">
          <div class="seg">
            <button class="${mode === "crew" ? "on" : ""}" data-m="crew">CREW</button>
            <button class="${mode === "solo" ? "on" : ""}" data-m="solo">SOLO</button>
            <button class="${mode === "lifetime" ? "on" : ""}" data-m="lifetime">LIFETIME</button>
            <button class="${mode === "coins" ? "on" : ""}" data-m="coins">COINS</button>
          </div>
          ${mode === "lifetime" ? `<p class="how-blurb">Every centimetre ever climbed, all modes, chill included. Pure dedication.</p>` : ""}
          ${mode === "coins" ? `<p class="how-blurb">Coins on hand right now. Spend them and you drop.</p>` : ""}
          <div class="srows">${list}</div>
        </div>
        <span class="shell-fade"></span>
        <div class="shell-foot">
          <p class="fine">${mine} · as <b>${esc(s.name || "anonymous")}</b> <button class="link" data-a="name">change</button></p>
          ${(mode === "crew" || mode === "solo") && (mode === "crew" ? s.bestCm : s.bestSolo) > 0 ? `<button class="shell-primary" data-a="share">CHALLENGE FRIENDS TO BEAT ${groupNum(mode === "crew" ? s.bestCm : s.bestSolo)} CM</button>` : ""}
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
      if (t.dataset.a === "share" && (mode === "crew" || mode === "solo")) this.h.onShare({ mode, cm: mode === "crew" ? s.bestCm : s.bestSolo });
      if (t.dataset.a === "name") this.showNamePrompt(() => this.showBoard(mode));
    });
    this.show(p);
    if (leaderboardEnabled) {
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
      <p class="fine">Counts this height for your best and the scoreboard.</p>
      <button class="ghost" data-a="quit">HOME SCREEN (discard run)</button>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "resume") { this.clear(); this.h.onResume(); }
      if (a === "end") { this.clear(); this.h.onEndRun(); }
      if (a === "quit") { this.clear(); this.h.onQuitRun(); }
    });
    this.show(p);
  }

  private lastGameOver: Parameters<Ui["showGameOver"]>[0] | null = null;
  reshowGameOver(): HTMLElement | null {
    return this.lastGameOver ? this.showGameOver(this.lastGameOver) : null;
  }

  showGameOver(o: { cm: number; best: number; coins: number; tokens: number; gems: number; adUsed: boolean; isRecord: boolean; mode: "solo" | "crew"; ended?: boolean; chill?: boolean; unlocked?: CreatureDef[]; style?: number; walletCoins?: number; walletGems?: number }) {
    this.lastGameOver = o;
    // The dock grows upward into this card rather than a centred dialog (handoff 1h).
    const p = el("div", "panel lost-card");
    const title = o.isRecord ? "NEW RECORD" : o.chill ? "CHILL RUN DONE" : o.ended ? "RUN BANKED" : "ALL CLIMBERS LOST";
    const revives = [
      o.tokens > 0 ? { a: "token", top: "TOKEN", sub: `${o.tokens} LEFT`, cls: "accent" } : null,
      !o.adUsed ? { a: "ad", top: "WATCH AD", sub: "FREE", cls: "accent" } : null,
      { a: "gems", top: "◆ 5", sub: "GEMS", cls: o.gems >= 5 ? "gem" : "gem disabled" },
    ].filter(Boolean) as { a: string; top: string; sub: string; cls: string }[];
    p.innerHTML = `
      <div class="lost-head">
        <div>
          <span class="lost-label">${title}</span>
          <div class="lost-cm"><b>${groupNum(o.cm)}</b><i>cm</i></div>
        </div>
        <div class="lost-meta">
          <span>BEST <b>${groupNum(o.best)}</b></span>
          <span class="rank" hidden></span>
          ${o.style ? `<span>STYLE <b class="coin">${groupNum(o.style)}</b></span>` : ""}
        </div>
      </div>
      ${o.chill ? `<p class="lost-banked"><i>Chill mode: no coins or records. Metres added to the world total.</i></p>` : `
      <div class="lost-banked">
        <span class="earned"><b class="coin">+${groupNum(o.coins)}</b> <i>BANKED</i></span>
        <span class="totals"><b class="coin">${groupNum(o.walletCoins ?? 0)}</b> <b class="gem">◆ ${groupNum(o.walletGems ?? 0)}</b></span>
      </div>`}
      ${(o.unlocked ?? []).map((c) => `<button class="unlock" data-a="wear" data-c="${c.id}">New creature: <b>${esc(c.name)}</b><small>${esc(c.detail)} · tap to wear</small></button>`).join("")}
      ${o.ended ? "" : `
      <span class="lost-label dim">REVIVE THE CREW</span>
      <div class="revive-row">
        ${revives.map((r) => `<button class="revive-cell ${r.cls}" data-a="${r.a}" ${r.a === "gems" && o.gems < 5 ? "disabled" : ""}><b>${r.top}</b><small>${r.sub}</small></button>`).join("")}
      </div>`}
      <button class="go" data-a="again">CLIMB AGAIN</button>
      <div class="lost-ghosts">
        ${o.chill ? "" : `<button class="ghost" data-a="share">CHALLENGE A FRIEND</button>`}
        <button class="ghost" data-a="quit">BACK TO MENU</button>
      </div>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]")?.dataset.a;
      if (a === "token" || a === "ad" || a === "gems") { this.clear(); this.h.onRevive(a); }
      if (a === "share") this.h.onShare({ mode: o.mode, cm: o.cm });
      if (a === "again") { this.clear(); this.h.onPlay(o.mode); }
      if (a === "quit") { this.clear(); this.h.onQuitRun(); }
      const wear = (e.target as HTMLElement).closest<HTMLElement>("[data-a=wear]")?.dataset.c as CreatureId | undefined;
      if (wear) { this.h.onWear({ creature: wear, pattern: this.save().pattern }); this.toast(`Wearing ${creatureById(wear).name}`); }
    });
    this.show(p);
    return p;
  }

  /** Update the rank line on an open game-over panel. */
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

  toast(text: string) {
    const t = el("div", "toast", text);
    this.root.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 1800);
  }
}
