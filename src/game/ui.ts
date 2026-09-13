import { RESERVE_COST, SKINS, UPGRADES, statsFor, upgradeCost, type UpgradeKey } from "./config";
import type { SaveData } from "./save";
import { leaderboard, leaderboardEnabled, type BoardMode, type ScoreRow } from "./leaderboard";
import { nameReason } from "./profanity";
import { FRIDGE_ITEMS, type ItemFamily } from "./items";
import { drawItemPreview } from "./scenery";
import { gadgetArtReady } from "./gadget-art";

export interface UiHandlers {
  onPlay(rules: "solo" | "crew"): void;
  onResume(): void;
  onQuitRun(): void;
  onEndRun(): void;
  onBuy(key: UpgradeKey): void;
  onBuyReserve(): void;
  onBuySkin(key: string): void;
  onRevive(method: "token" | "ad" | "gems"): void;
  onToggleSound(): void;
  onToggleMusic(): void;
  /** HUD speaker button: silences (or restores) both music and effects. */
  onToggleMute(): void;
  onToggleChill(): void;
  onSetName(name: string): void;
  onUpdate(): void;
  onLinkDevice(): void;
  onOpenBoard(): void;
  onEnterCode(code: string): void;
  onTutorial(): void;
  onShare(c: { mode: "solo" | "crew"; cm: number }): void;
  onAcceptChallenge(mode: "solo" | "crew"): void;
}

const fmtDistance = (cm: number) => (cm >= 100000 ? `${(cm / 100000).toFixed(2)} km` : `${(cm / 100).toFixed(1)} m`);

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
  private muteBtn: HTMLButtonElement;

  constructor(root: HTMLElement, private save: () => SaveData, private h: UiHandlers) {
    this.root = root;
    this.pauseBtn = document.createElement("button");
    this.pauseBtn.className = "pause-btn";
    this.pauseBtn.textContent = "☰ MENU";
    this.pauseBtn.hidden = true;
    this.pauseBtn.addEventListener("click", () => this.showPause());
    root.appendChild(this.pauseBtn);
    this.muteBtn = document.createElement("button");
    this.muteBtn.className = "pause-btn mute-btn";
    this.muteBtn.hidden = true;
    this.muteBtn.addEventListener("click", () => { this.h.onToggleMute(); this.refreshMute(); });
    root.appendChild(this.muteBtn);
    this.refreshMute();
  }

  refreshMute() {
    const s = this.save();
    const muted = !s.sound && !s.music;
    this.muteBtn.textContent = muted ? "🔇" : "🔊";
    this.muteBtn.title = muted ? "Unmute" : "Mute";
    this.muteBtn.setAttribute("aria-label", this.muteBtn.title);
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
    this.muteBtn.hidden = !inRun;
    this.refreshMute();
  }

  showMenu() {
    const s = this.save();
    const p = el("div", "panel menu");
    p.innerHTML = `
      <div class="rail">
        <button class="icon" data-a="settings" title="Settings" aria-label="Settings">⚙</button>
        <button class="icon" data-a="guide" title="Fridge field guide" aria-label="Fridge field guide">📖</button>
        <span class="grow"></span>
        <button class="icon" data-a="tutorial" title="How to play" aria-label="How to play">❔</button>
        <button class="icon" data-a="board" title="Scoreboard" aria-label="Scoreboard">🏆</button>
      </div>
      <h1 class="brand-title"><img src="${import.meta.env.BASE_URL}art/title-logo.webp" alt="Magnet Climbers" width="1100" height="495" fetchpriority="high" /></h1>
      <p class="tag">Fling rubbery magnet toys up an endless fridge. Stick to steel. Outrun the kid.</p>
      <div class="stats">
        <div><span>Best crew</span><b>${s.bestCm} cm</b></div>
        <div><span>Best solo</span><b>${s.bestSolo} cm</b></div>
        <button class="wallet" data-a="shop" title="Upgrades &amp; skins"><span>Coins</span><b class="coin">$${s.coins}</b></button>
        <button class="wallet" data-a="shop" title="Upgrades &amp; skins"><span>Gems</span><b class="gem">◆${s.gems}</b></button>
      </div>
      <button class="primary mode" data-a="crew"><b>CREW CLIMB</b><small>Whole crew flings at once. Spares are lives.</small></button>
      <button class="primary alt mode" data-a="solo"><b>SOLO CLIMB</b><small>One climber, pure arcade.</small></button>
      <label class="switch-row ${s.chill ? "on" : ""}">
        <span><b>😌 Chill mode</b><small>${s.chill ? "No red line, no rush. No coins or records; metres still count for the world." : "No red line. No coins or records; metres still count for the world."}</small></span>
        <input type="checkbox" data-a="chill" ${s.chill ? "checked" : ""} aria-label="Chill mode" /><i></i>
      </label>
      <div class="pair">
        <button data-a="shop">UPGRADES</button>
        <button data-a="story">STORY</button>
      </div>
      <p class="fine">${s.runs} runs · ${(s.totalCm / 100).toFixed(1)} m climbed lifetime</p>
      <p class="fine global" hidden></p>
      <p class="fine">Build ${__BUILD__} · <button class="link" data-a="update">check for update</button></p>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]")?.dataset.a;
      if (a === "crew") this.h.onPlay("crew");
      if (a === "solo") this.h.onPlay("solo");
      if (a === "shop") this.showShop();
      if (a === "board") this.showBoard("crew");
      if (a === "settings") this.showSettings();
      if (a === "guide") this.showFieldGuide();
      if (a === "update") this.h.onUpdate();
      if (a === "tutorial") this.h.onTutorial();
      if (a === "story") this.showStory(() => this.showMenu());
      if (a === "sound") { this.h.onToggleSound(); this.showMenu(); }
    });
    p.querySelector<HTMLInputElement>('input[data-a="chill"]')!.addEventListener("change", () => { this.h.onToggleChill(); this.showMenu(); });
    this.show(p);
    if (leaderboardEnabled) {
      void leaderboard.stats().then((st) => {
        if (!st || this.panel !== p) return;
        const g = p.querySelector<HTMLElement>(".global");
        if (g) { const pl = (n: number, w: string) => `${n.toLocaleString()} ${w}${n === 1 ? "" : "s"}`;
        g.textContent = `🌍 Everyone together: ${fmtDistance(st.total_cm)} over ${pl(st.runs, "run")} by ${pl(st.players, "climber")}`; g.hidden = false; }
      });
    }
  }

  showFieldGuide(family: ItemFamily = "surface") {
    const p = el("div", "panel field-guide");
    const categories: [ItemFamily, string][] = [["surface", "Obstacles"], ["gadget", "Gadgets"], ["bumper", "Movers"], ["pickup", "Pickups"], ["paper", "Paper art"]];
    const items = FRIDGE_ITEMS.filter((item) => item.family === family);
    p.innerHTML = `<h2>Fridge Field Guide</h2>
      <p class="tag">${FRIDGE_ITEMS.length} little things. One very big fridge.<br/>Silver holds stick. Paper, glass and plastic don't.</p>
      <div class="guide-tabs" role="group" aria-label="Item category">${categories.map(([key, name]) => `<button class="chip ${key === family ? "on" : ""}" data-category="${key}" aria-pressed="${key === family}">${name}</button>`).join("")}</div>
      <div class="guide-grid">${items.map((item) => `<article class="guide-card"><canvas width="200" height="200" aria-label="${esc(item.name)} illustration" role="img"></canvas><b>${esc(item.name)}</b><span>${esc(item.description)}</span></article>`).join("")}</div>
      <button class="ghost" data-a="back">BACK</button>`;
    const drawCards = () => p.querySelectorAll("canvas").forEach((canvas, i) => {
      const ctx = canvas.getContext("2d")!; ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, 100, 100); drawItemPreview(ctx, items[i]);
    });
    drawCards();
    void gadgetArtReady.then(() => { if (p.isConnected) drawCards(); });
    p.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      const category = target?.dataset.category;
      if (category && categories.some(([key]) => key === category)) this.showFieldGuide(category as ItemFamily);
      if (target?.dataset.a === "back") this.showMenu();
    });
    this.show(p);
  }

  /** Profile, preferences and appearance in one place. */
  showSettings() {
    const s = this.save();
    const p = el("div", "panel shop");
    p.innerHTML = `
      <h2>Settings</h2>
      <h3>Profile</h3>
      <div class="rows">
        <div class="row">
          <div class="info"><b>Climber name</b><span>${esc(s.name || "not set")} · shown on the scoreboard</span></div>
          <button class="buy" data-a="name">CHANGE</button>
        </div>
      </div>
      <h3>Play on another device</h3>
      <div class="rows">
        <div class="row">
          <div class="info"><b>Link a new device</b><span>Shows a 6-letter code. Enter it on the other device to carry this profile over.</span></div>
          <button class="buy" data-a="link">CODE</button>
        </div>
        <div class="row">
          <div class="info"><b>Enter a link code</b><span>Adopt a profile from another device. Replaces this one.</span></div>
          <button class="buy" data-a="claim">ENTER</button>
        </div>
      </div>
      <h3>Preferences</h3>
      <div class="rows">
        <div class="row">
          <div class="info"><b>Sound effects</b><span>Rubber twangs, steel clicks and hand swishes</span></div>
          <button class="buy" data-a="sound">${s.sound ? "ON" : "OFF"}</button>
        </div>
        <div class="row"><div class="info"><b>Music</b><span>Original toy-box groove; builds as danger approaches</span></div><button class="buy" data-a="music">${s.music ? "ON" : "OFF"}</button></div>
        <div class="row">
          <div class="info"><b>Chill mode</b><span>No red line. No coins or records; metres still count for the world total</span></div>
          <button class="buy ${s.chill ? "" : ""}" data-a="chill">${s.chill ? "ON" : "OFF"}</button>
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
      <button data-a="shop">UPGRADES &amp; RESERVES</button>
      <p class="fine">Profile ${esc(s.playerId.slice(0, 10))}… · synced to the cloud after every run</p>
      <button class="ghost" data-a="back">BACK</button>`;
    p.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const a = t.dataset.a;
      const sk = t.closest<HTMLElement>("[data-s]")?.dataset.s;
      if (sk) { this.h.onBuySkin(sk); this.showSettings(); return; }
      if (a === "name") { this.showNamePrompt(() => this.showSettings()); return; }
      if (a === "link") { this.h.onLinkDevice(); return; }
      if (a === "claim") { this.showClaimPrompt(); return; }
      if (a === "sound") { this.h.onToggleSound(); this.showSettings(); return; }
      if (a === "music") { this.h.onToggleMusic(); this.showSettings(); return; }
      if (a === "chill") { this.h.onToggleChill(); this.showSettings(); return; }
      if (a === "shop") { this.showShop(); return; }
      if (a === "back") this.showMenu();
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

  showBoard(mode: BoardMode) {
    const s = this.save();
    this.h.onOpenBoard();
    const p = el("div", "panel board");
    const render = (rows: ScoreRow[] | null, rank: { rank: number | null; cm?: number } | null) => {
      const list = rows && rows.length
        ? rows.map((r, i) => `<div class="srow ${r.player_id === s.playerId ? "me" : ""}"><span class="n">${i + 1}</span><span class="who">${esc(r.name)}</span><span class="cm">${mode === "lifetime" ? fmtDistance(r.cm) : `${r.cm} cm`}</span></div>`).join("")
        : `<p class="tag">${leaderboardEnabled ? (rows ? "No climbs yet. Be first." : "Could not reach the scoreboard.") : "Global scoreboard not configured yet. Local best shown."}</p>`;
      const localMine = mode === "lifetime" ? s.totalCm : mode === "crew" ? s.bestCm : s.bestSolo;
      const mine = leaderboardEnabled
        ? rank?.rank ? `You: #${rank.rank} · ${fmtDistance(rank.cm ?? 0)}` : "You: not on the board yet"
        : `You: ${fmtDistance(localMine)}`;
      p.innerHTML = `
        <h2>${mode === "lifetime" ? "Lifetime climbed" : "Highest climbs"}</h2>
        <div class="tabs">
          <button class="${mode === "crew" ? "on" : ""}" data-m="crew">CREW</button>
          <button class="${mode === "solo" ? "on" : ""}" data-m="solo">SOLO</button>
          <button class="${mode === "lifetime" ? "on" : ""}" data-m="lifetime">LIFETIME</button>
        </div>
        ${mode === "lifetime" ? `<p class="fine">Every centimetre ever climbed, all modes, chill included. Pure dedication.</p>` : ""}
        <div class="srows">${list}</div>
        <p class="tag">${mine} · playing as <b>${esc(s.name || "anonymous")}</b> <button class="link" data-a="name">change</button></p>
        ${mode !== "lifetime" && (mode === "crew" ? s.bestCm : s.bestSolo) > 0 ? `<button data-a="share">📣 CHALLENGE FRIENDS TO BEAT ${mode === "crew" ? s.bestCm : s.bestSolo} cm</button>` : ""}
        <button class="ghost" data-a="back">BACK</button>`;
    };
    render(null, null);
    p.querySelector(".srows")!.innerHTML = `<p class="tag">Loading…</p>`;
    p.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const m = t.dataset.m as BoardMode | undefined;
      if (m) { this.showBoard(m); return; }
      if (t.dataset.a === "back") this.showMenu();
      if (t.dataset.a === "share" && mode !== "lifetime") this.h.onShare({ mode, cm: mode === "crew" ? s.bestCm : s.bestSolo });
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

  showGameOver(o: { cm: number; best: number; coins: number; tokens: number; gems: number; adUsed: boolean; isRecord: boolean; mode: "solo" | "crew"; ended?: boolean; chill?: boolean }) {
    this.lastGameOver = o;
    const p = el("div", "panel small");
    p.innerHTML = `
      <h2>${o.isRecord ? "New record!" : o.chill ? "Chill run done" : o.ended ? "Run banked" : "All climbers lost"}</h2>
      <div class="big">${o.cm} cm</div>
      <p class="tag">${o.chill ? "Chill mode: no coins or records. Metres added to the world total." : `Best ${o.best} cm · earned <span class="coin">$${o.coins}</span>`}</p>
      <p class="tag rank" hidden></p>
      <div class="revive" ${o.ended ? "hidden" : ""}>
        ${o.tokens > 0 ? `<button class="primary" data-a="token">REVIVE · token (${o.tokens})</button>` : ""}
        ${!o.adUsed ? `<button class="primary" data-a="ad">REVIVE · watch ad</button>` : ""}
        <button class="${o.gems >= 5 ? "" : "disabled"}" data-a="gems" ${o.gems >= 5 ? "" : "disabled"}>REVIVE · ◆5</button>
      </div>
      ${o.chill ? "" : `<button data-a="share">📣 CHALLENGE A FRIEND</button>`}
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
