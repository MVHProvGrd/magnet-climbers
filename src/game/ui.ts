import { RESERVE_COST, SKINS, UPGRADES, statsFor, upgradeCost, type UpgradeKey } from "./config";
import type { SaveData } from "./save";

export interface UiHandlers {
  onPlay(rules: "solo" | "crew"): void;
  onResume(): void;
  onQuitRun(): void;
  onBuy(key: UpgradeKey): void;
  onBuyReserve(): void;
  onBuySkin(key: string): void;
  onRevive(method: "token" | "ad" | "gems"): void;
  onToggleSound(): void;
}

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
    this.pauseBtn.textContent = "II";
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
      <button class="ghost" data-a="sound">Sound: ${s.sound ? "on" : "off"}</button>
      <p class="fine">Runs: ${s.runs} · Total climbed: ${(s.totalCm / 100).toFixed(1)} m</p>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "crew") this.h.onPlay("crew");
      if (a === "solo") this.h.onPlay("solo");
      if (a === "shop") this.showShop();
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

  showPause() {
    const p = el("div", "panel small");
    p.innerHTML = `
      <h2>Paused</h2>
      <button class="primary" data-a="resume">RESUME</button>
      <button class="ghost" data-a="quit">QUIT RUN</button>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "resume") { this.clear(); this.h.onResume(); }
      if (a === "quit") { this.clear(); this.h.onQuitRun(); }
    });
    this.show(p);
    this.h.onResume; // keep type usage explicit
  }

  showGameOver(o: { cm: number; best: number; coins: number; tokens: number; gems: number; adUsed: boolean; isRecord: boolean }) {
    const p = el("div", "panel small");
    p.innerHTML = `
      <h2>${o.isRecord ? "New record!" : "All climbers lost"}</h2>
      <div class="big">${o.cm} cm</div>
      <p class="tag">Best ${o.best} cm · earned <span class="coin">$${o.coins}</span></p>
      <div class="revive">
        ${o.tokens > 0 ? `<button class="primary" data-a="token">REVIVE · token (${o.tokens})</button>` : ""}
        ${!o.adUsed ? `<button class="primary" data-a="ad">REVIVE · watch ad</button>` : ""}
        <button class="${o.gems >= 5 ? "" : "disabled"}" data-a="gems" ${o.gems >= 5 ? "" : "disabled"}>REVIVE · ◆5</button>
      </div>
      <button class="ghost" data-a="quit">BACK TO MENU</button>
    `;
    p.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === "token" || a === "ad" || a === "gems") { this.clear(); this.h.onRevive(a); }
      if (a === "quit") { this.clear(); this.h.onQuitRun(); }
    });
    this.show(p);
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
