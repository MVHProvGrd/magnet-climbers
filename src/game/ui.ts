import { RESERVE_COST, SKINS, UPGRADES, statsFor, upgradeCost, type UpgradeKey } from "./config";
import type { SaveData } from "./save";
import { leaderboard, leaderboardEnabled, type Mode, type ScoreRow } from "./leaderboard";

export interface UiHandlers {
  onPlay(rules: "solo" | "crew"): void;
  onResume(): void;
  onQuitRun(): void;
  onBuy(key: UpgradeKey): void;
  onBuyReserve(): void;
  onBuySkin(key: string): void;
  onRevive(method: "token" | "ad" | "gems"): void;
  onToggleSound(): void;
  onSetName(name: string): void;
  onUpdate(): void;
  onTutorial(): void;
  onShare(c: { mode: "solo" | "crew"; cm: number }): void;
  onAcceptChallenge(mode: "solo" | "crew"): void;
}

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
  private pauseBtn: HTMLButtonElement;

  constructor(root: HTMLElement, private save: () => SaveData, private h: UiHandlers) {
    this.root = root;
    this.pauseBtn = document.createElement("button");
    this.pauseBtn.className = "pause-btn";
    this.pauseBtn.textContent = "☰ MENU";
    this.pauseBtn.hidden = true;
    this.pauseBtn.addEventListener("click", () => this.showPause());
    root.appendChild(this.pauseBtn);
  }

  private show(panel: HTMLElement) {
    this.clear();
    this.panel = panel;
    this.root.appendChild(panel);
  }

  clear() {
    this.panel?.remove();
    this.panel = null;
  }

  setInRun(inRun: boolean) {
    this.pauseBtn.hidden = !inRun;
  }

  showMenu() {
    const s = this.save();
    const p = el("div", "panel menu");
    p.innerHTML = `
      <h1>Magnet<br/>Climbers</h1>
      <p class="tag">Fling your rubbery magnet crew up an endless fridge.<br/>Chain together to cross the gaps.</p>
      <div class="stats">
        <div><span>Best crew</span><b>${s.bestCm} cm</b></div>
        <div><span>Best solo</span><b>${s.bestSolo} cm</b></div>
        <div><span>Coins</span><b class="coin">$${s.coins}</b></div>
        <div><span>Gems</span><b class="gem">◆${s.gems}</b></div>
      </div>
      <button class="primary" data-a="crew">CREW CLIMB</button>
      <p class="fine">Teammates fling each other. Chain up to cross the gaps. Never leave anyone behind.</p>
      <button class="primary alt" data-a="solo">SOLO CLIMB</button>
      <p class="fine">One climber, pure arcade. Fling, stick, outrun the line.</p>
      <button data-a="shop">UPGRADES</button>
      <button data-a="board">SCOREBOARD</button>
      <div class="pair">
        <button class="ghost" data-a="tutorial">HOW TO PLAY</button>
        <button class="ghost" data-a="story">STORY</button>
      </div>
      <button class="ghost" data-a="sound">Sound: ${s.sound ? "on" : "off"}</button>
      <p class="fine">Runs: ${s.runs} · Total climbed: ${(s.totalCm / 100).toFixed(1)} m</p>
      <p class="fine">Build ${__BUILD__} · <button class="link" data-a="update">check for update</button></p>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "crew") this.h.onPlay("crew");
      if (a === "solo") this.h.onPlay("solo");
      if (a === "shop") this.showShop();
      if (a === "board") this.showBoard("crew");
      if (a === "update") this.h.onUpdate();
      if (a === "tutorial") this.h.onTutorial();
      if (a === "story") this.showStory(() => this.showMenu());
      if (a === "sound") { this.h.onToggleSound(); this.showMenu(); }
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
      <h3>Skins</h3>
      <div class="rows">${SKINS.map((k) => {
        const owned = s.skins.includes(k.key);
        const active = s.skin === k.key;
        const can = owned || s.coins >= k.cost;
        return `<div class="row">
          <div class="info"><b>${k.name}</b><span class="swatches">${k.colors.map((c) => `<i style="background:${c}"></i>`).join("")}</span></div>
          <button class="buy ${can ? "" : "disabled"}" data-s="${k.key}" ${can ? "" : "disabled"}>${active ? "ON" : owned ? "USE" : `$${k.cost}`}</button>
        </div>`;
      }).join("")}</div>
      <button class="ghost" data-a="back">BACK</button>
    `;
    p.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const k = t.closest<HTMLElement>("[data-k]")?.dataset.k as UpgradeKey | undefined;
      if (k) { this.h.onBuy(k); this.showShop(); return; }
      if (t.closest<HTMLElement>("[data-r]")) { this.h.onBuyReserve(); this.showShop(); return; }
      const sk = t.closest<HTMLElement>("[data-s]")?.dataset.s;
      if (sk) { this.h.onBuySkin(sk); this.showShop(); return; }
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

  /** Back story, three slides. */
  showStory(done: () => void) {
    const slides = [
      { icon: "🧲", title: "Life on the fridge", text: "We are the magnet people. We hold up the pizza menu, the dentist card, the photo of the kid. Good job. Steady work." },
      { icon: "🧒", title: "Then bedtime came", text: "The kid \"tidied up\". Now we are on the floor, and the sock drawer is next. Anyone still on the fridge by morning stays on the fridge." },
      { icon: "⬆️", title: "So we climb", text: "Fling, stick, climb. Steel holds. Glass, plastic and stickers don't. The red line is the kid's reach. Stay above it." },
    ];
    let i = 0;
    const p = el("div", "panel story");
    const render = () => {
      const sl = slides[i];
      p.innerHTML = `
        <div class="story-icon">${sl.icon}</div>
        <h2>${sl.title}</h2>
        <p class="tag big-tag">${sl.text}</p>
        <div class="dots">${slides.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
        <button class="primary" data-a="next">${i < slides.length - 1 ? "NEXT" : "LET'S CLIMB"}</button>
        ${i < slides.length - 1 ? `<button class="ghost" data-a="skip">SKIP</button>` : ""}`;
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

  showBoard(mode: Mode) {
    const s = this.save();
    const p = el("div", "panel board");
    const render = (rows: ScoreRow[] | null, rank: { rank: number | null; cm?: number } | null) => {
      const list = rows && rows.length
        ? rows.map((r, i) => `<div class="srow ${r.player_id === s.playerId ? "me" : ""}"><span class="n">${i + 1}</span><span class="who">${esc(r.name)}</span><span class="cm">${r.cm} cm</span></div>`).join("")
        : `<p class="tag">${leaderboardEnabled ? (rows ? "No climbs yet. Be first." : "Could not reach the scoreboard.") : "Global scoreboard not configured yet. Local best shown."}</p>`;
      const mine = leaderboardEnabled
        ? rank?.rank ? `You: #${rank.rank} · ${rank.cm} cm` : "You: not on the board yet"
        : `You: ${mode === "crew" ? s.bestCm : s.bestSolo} cm`;
      p.innerHTML = `
        <h2>Highest climbs</h2>
        <div class="tabs">
          <button class="${mode === "crew" ? "on" : ""}" data-m="crew">CREW</button>
          <button class="${mode === "solo" ? "on" : ""}" data-m="solo">SOLO</button>
        </div>
        <div class="srows">${list}</div>
        <p class="tag">${mine} · playing as <b>${esc(s.name || "anonymous")}</b> <button class="link" data-a="name">change</button></p>
        ${(mode === "crew" ? s.bestCm : s.bestSolo) > 0 ? `<button data-a="share">📣 CHALLENGE FRIENDS TO BEAT ${mode === "crew" ? s.bestCm : s.bestSolo} cm</button>` : ""}
        <button class="ghost" data-a="back">BACK</button>`;
    };
    render(null, null);
    p.querySelector(".srows")!.innerHTML = `<p class="tag">Loading…</p>`;
    p.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const m = t.dataset.m as Mode | undefined;
      if (m) { this.showBoard(m); return; }
      if (t.dataset.a === "back") this.showMenu();
      if (t.dataset.a === "share") this.h.onShare({ mode, cm: mode === "crew" ? s.bestCm : s.bestSolo });
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

  /** Ask for a display name (first submit, or from the board). */
  showNamePrompt(done: () => void) {
    const s = this.save();
    const p = el("div", "panel small");
    p.innerHTML = `
      <h2>Your climber name</h2>
      <p class="tag">Shown on the global scoreboard. 12 characters max.</p>
      <input id="name-in" maxlength="12" placeholder="e.g. FridgeKing" value="${esc(s.name)}" autocomplete="off" />
      <button class="primary" data-a="ok">SAVE</button>
      <button class="ghost" data-a="skip">SKIP</button>`;
    const input = p.querySelector<HTMLInputElement>("#name-in")!;
    const finish = (save: boolean) => {
      if (save) this.h.onSetName(input.value.trim().slice(0, 12));
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
      <button data-a="quit">HOME SCREEN</button>
      <p class="fine">Quitting ends the run. Coins collected so far are kept.</p>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "resume") { this.clear(); this.h.onResume(); }
      if (a === "quit") { this.clear(); this.h.onQuitRun(); }
    });
    this.show(p);
    this.h.onResume; // keep type usage explicit
  }

  private lastGameOver: Parameters<Ui["showGameOver"]>[0] | null = null;
  reshowGameOver(): HTMLElement | null {
    return this.lastGameOver ? this.showGameOver(this.lastGameOver) : null;
  }

  showGameOver(o: { cm: number; best: number; coins: number; tokens: number; gems: number; adUsed: boolean; isRecord: boolean; mode: "solo" | "crew" }) {
    this.lastGameOver = o;
    const p = el("div", "panel small");
    p.innerHTML = `
      <h2>${o.isRecord ? "New record!" : "All climbers lost"}</h2>
      <div class="big">${o.cm} cm</div>
      <p class="tag">Best ${o.best} cm · earned <span class="coin">$${o.coins}</span></p>
      <p class="tag rank" hidden></p>
      <div class="revive">
        ${o.tokens > 0 ? `<button class="primary" data-a="token">REVIVE · token (${o.tokens})</button>` : ""}
        ${!o.adUsed ? `<button class="primary" data-a="ad">REVIVE · watch ad</button>` : ""}
        <button class="${o.gems >= 5 ? "" : "disabled"}" data-a="gems" ${o.gems >= 5 ? "" : "disabled"}>REVIVE · ◆5</button>
      </div>
      <button data-a="share">📣 CHALLENGE A FRIEND</button>
      <button class="ghost" data-a="quit">BACK TO MENU</button>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "token" || a === "ad" || a === "gems") { this.clear(); this.h.onRevive(a); }
      if (a === "share") this.h.onShare({ mode: o.mode, cm: o.cm });
      if (a === "quit") { this.clear(); this.h.onQuitRun(); }
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

  toast(text: string) {
    const t = el("div", "toast", text);
    this.root.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 1800);
  }
}
