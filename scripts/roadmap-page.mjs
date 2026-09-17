// Builds public/roadmap/index.html: the plan, ordered, with the reasoning kept next to it.
// Linked from the admin header. Same brushed-steel styling as the element map, so the
// owner-facing pages read as one set. Dependency-free: CI has no node_modules cache.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const STYLE = readFileSync("scripts/element-map.css", "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Every item carries its own argument: what it is, why now, and what it touches. */
const NOW = [
  {
    title: "Daily seeded run",
    line: "One fridge for everybody, 24 hours, one scored attempt.",
    why: "The cheapest retention in the repo, because the hard part is already done: the sim is deterministic from a seed, so a date-derived seed and one extra board is the whole feature. It gives a reason to open the app that is not \"beat your own number\", and it makes the scoreboard comparable — today everyone's best is against a different door.",
    touches: ["main.ts seed of the day", "worker: a daily board + one attempt per player", "board tabs"],
    size: "small",
  },
  {
    title: "Missions, three at a time",
    line: "Rotating goals paid in coins, written against counters that already exist.",
    why: "Nothing new needs instrumenting. The run already counts chains, gadget rides, paints, hits, coins, height and cause of death. Missions turn those into a reason to play differently on a door you have climbed a hundred times, and they feed coins to a wallet that finally has a sink.",
    touches: ["feats in game.ts", "save: three active + progress", "menu and game-over cards"],
    size: "medium",
  },
  {
    title: "Instant restart and the near miss",
    line: "One tap back onto the door, with your best height drawn on it.",
    why: "A run ends and the session ends with it. The line on the door turns every climb into a rematch you can see, and the restart is already half built — CLIMB AGAIN goes through the kit sheet now.",
    touches: ["game-over card", "world: the best-height line", "kit sheet"],
    size: "small",
  },
];

const THEN = [
  {
    title: "Prize machine",
    line: "100 coins, spin, win a pattern; duplicates refund.",
    why: "The kit made coins mean something for one climb. It cannot absorb a real balance — a wallet in testing this week held $48,568, and the whole shelf costs $360. A second sink that pays cosmetics is what keeps earning worth anything.",
    touches: ["patterns in save", "a spin panel", "coin economy"],
    size: "medium",
  },
  {
    title: "Daily reward and streak",
    line: "Open the app, claim a drop. Seven in a row pays a look.",
    why: "Pairs with the daily run: the streak is the reason to open, the daily run is the reason to stay. Cheap, and it needs no server work beyond a claimed-on date.",
    touches: ["save: last claim", "menu badge"],
    size: "small",
  },
  {
    title: "Weekly league",
    line: "Buckets of about thirty by lifetime metres; top promote, bottom drop.",
    why: "The global board is unwinnable for everyone except the top ten, so it stops motivating almost every player. Buckets give a climb that any player can be near the top of.",
    touches: ["worker: bucketing job", "board tab", "tier badge"],
    size: "large",
  },
];

const HOLD = [
  ["Ghosts, async race, live race", "All three need the input recorder first, and the recorder needs score validation to be worth building. Real work, none of it makes tomorrow's session happen."],
  ["Accounts (Google/Apple)", "Link codes already carry a profile between devices. Accounts are a migration project with an OAuth dependency on you; the value only shows up once there is progress worth losing."],
  ["Capacitor, AdMob, IAP", "Packaging and money on top of a loop that does not yet bring anyone back. Ship the return reason first, then wrap it."],
  ["Offline income, prestige, season pass", "These are the shape of a much bigger game. Revisit when a week of retention data says the core loop holds."],
];

const DECIDE = [
  {
    q: "Crew: commit one verb, or cut the code?",
    body: "Crew and expeditions are hidden behind flags, and half of them is inert code that still costs us. The upgrade table sells nothing for team size, arm reach, chain length or reserve climbers because none of them do anything for a lone climber — that was a real bug this week, not a hypothetical. Either Stage 1 (Stack) ships behind a flag and the rest follows one verb per release, or the dead paths come out and CREW_DESIGN.md keeps the plan until it is wanted. Drifting is the expensive option.",
  },
  {
    q: "Does EXPEDITIONS keep saying COMING SOON?",
    body: "It has sat on the menu as a disabled tile for a while. Give it a date or take the tile down — a permanent \"coming soon\" teaches players to ignore the menu.",
  },
  {
    q: "What is the first thing you would pay to promote?",
    body: "The answer decides whether the next month goes into the daily loop or into themed fridges. A monthly fridge skin is the thing that gives every update something to post; the daily run is the thing that makes the post worth clicking.",
  },
];

const SHIPPED = [
  ["Kit, per run", "Coins buy a higher jump and a stickier floor for one climb, three clicks each, gone when the run ends."],
  ["Landing rule", "A toy that comes down inside glass lands there and slides, instead of being pulled to the nearest rim."],
  ["World 23", "Stuck-on toy magnets are back on the door, 1 → 26 per 240 doors; the compass is a compass; the grille is not stretched."],
  ["Sound", "Every keychain toy has a voice; the POP! keyring pops again; the things you hit make a noise."],
  ["Blue polarity", "The blue phase pulls. It had no field at all — red worked, blue was three seconds of painted rings."],
];

const item = (it, n) => `
  <article class="step">
    <div class="step-n">${n}</div>
    <div class="step-body">
      <h3>${esc(it.title)}</h3>
      <p class="lede">${esc(it.line)}</p>
      <p class="why">${esc(it.why)}</p>
      <div class="rig">
        <span class="chip"><b>size</b><span>${esc(it.size)}</span></span>
        ${it.touches.map((t) => `<span class="chip touch">${esc(t)}</span>`).join("")}
      </div>
    </div>
  </article>`;

const EXTRA = `
  .lede-wrap{display:grid;gap:18px;grid-template-columns:minmax(0,1.35fr) minmax(260px,1fr);align-items:start;margin-top:22px}
  @media (max-width:760px){.lede-wrap{grid-template-columns:1fr}}
  .thesis{border-left:3px solid var(--danger);padding:2px 0 2px 16px}
  .thesis p{margin:0 0 10px;font-size:17px;line-height:1.5;max-width:58ch}
  .thesis p:last-child{margin-bottom:0;color:var(--ink-2);font-size:15px}
  .state{background:var(--sheet);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
  .state h4{font-family:var(--display);font-weight:800;letter-spacing:1.8px;text-transform:uppercase;
    font-size:12px;color:var(--ink-3);margin:0 0 10px}
  .state dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:14px}
  .state dt{color:var(--ink-2)}
  .state dd{margin:0;font-family:var(--mono);font-size:13px;font-variant-numeric:tabular-nums}
  .steps{display:flex;flex-direction:column;gap:2px;margin-top:14px}
  .step{display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px;padding:18px 0;border-top:1px solid var(--line-soft)}
  .step:first-child{border-top:0}
  .step-n{font-family:var(--display);font-weight:900;font-size:30px;line-height:1;color:var(--danger);
    font-variant-numeric:tabular-nums;min-width:34px}
  section.next .step-n{color:var(--ink-3)}
  .step h3{font-family:var(--display);font-weight:800;font-size:23px;letter-spacing:.3px;margin:0 0 4px;text-wrap:balance}
  .lede{margin:0 0 8px;font-size:15.5px}
  .why{margin:0 0 12px;color:var(--ink-2);max-width:72ch}
  .chip.touch{color:var(--ink-2)}
  .hold{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));margin-top:14px}
  .hold div{border:1px dashed var(--line);border-radius:10px;padding:13px 15px}
  .hold b{font-family:var(--display);font-weight:800;font-size:15px;letter-spacing:.4px}
  .hold p{margin:5px 0 0;color:var(--ink-2);font-size:14px}
  .ask{border-top:1px solid var(--line-soft);padding:16px 0}
  .ask:first-of-type{border-top:0}
  .ask h3{font-family:var(--display);font-weight:800;font-size:20px;margin:0 0 6px;color:var(--accent)}
  .ask p{margin:0;color:var(--ink-2);max-width:74ch}
  .ledger{display:grid;gap:8px;margin-top:14px}
  .ledger div{display:grid;grid-template-columns:minmax(120px,170px) minmax(0,1fr);gap:14px;
    padding:9px 0;border-bottom:1px solid var(--line-soft);font-size:14px}
  .ledger b{font-family:var(--display);font-weight:800;letter-spacing:.4px;font-size:15px}
  .ledger span{color:var(--ink-2)}
  footer{margin-top:44px;padding-top:14px;border-top:1px solid var(--line);color:var(--ink-3);font-size:13px}
`;

const BODY = `
<div class="wrap">
  <p class="eyebrow">Magnet Climbers &middot; plan</p>
  <h1>What to build next</h1>
  <p class="standfirst">The door is dense, the fling feels right, and nothing brings anyone back tomorrow. Everything below is ordered against that one gap.</p>

  <div class="lede-wrap">
    <div class="thesis">
      <p>Stop adding objects to the door. The next three releases should be the reason to open the app again: a daily run everyone shares, missions written against counters we already keep, and a restart that puts your last height on the fridge.</p>
      <p>Then the second coin sink, then the league. Everything else — ghosts, races, accounts, store wrappers — is real work that does not change whether anyone plays tomorrow.</p>
    </div>
    <div class="state">
      <h4>Where it stands</h4>
      <dl>
        <dt>Mode</dt><dd>solo only</dd>
        <dt>World version</dt><dd>23</dd>
        <dt>Items on the door</dt><dd>152</dd>
        <dt>Coin sinks</dt><dd>1 (run kit)</dd>
        <dt>Reasons to return</dt><dd>0</dd>
        <dt>Tests</dt><dd>64 passing</dd>
      </dl>
    </div>
  </div>

  <section>
    <h2>Now <span class="count">in this order</span></h2>
    <p class="note">Three releases. Each one is small enough to ship inside a week and answers the same question: why open this again?</p>
    <div class="steps">${NOW.map((it, i) => item(it, i + 1)).join("")}</div>
  </section>

  <section class="next">
    <h2>Then <span class="count">once the loop closes</span></h2>
    <p class="note">These pay off only after there is a reason to come back. In order, but the order is softer.</p>
    <div class="steps">${THEN.map((it, i) => item(it, i + 4)).join("")}</div>
  </section>

  <section>
    <h2>Holding <span class="count">and why</span></h2>
    <div class="hold">${HOLD.map(([t, b]) => `<div><b>${esc(t)}</b><p>${esc(b)}</p></div>`).join("")}</div>
  </section>

  <section>
    <h2>Yours to decide <span class="count">blocking, not urgent</span></h2>
    ${DECIDE.map((d) => `<div class="ask"><h3>${esc(d.q)}</h3><p>${esc(d.body)}</p></div>`).join("")}
  </section>

  <section>
    <h2>Shipped recently <span class="count">for context</span></h2>
    <div class="ledger">${SHIPPED.map(([t, b]) => `<div><b>${esc(t)}</b><span>${esc(b)}</span></div>`).join("")}</div>
  </section>

  <footer>Generated from <span style="font-family:var(--mono)">scripts/roadmap-page.mjs</span>. The ordered backlog lives in ROADMAP.md; the crew plan in CREW_DESIGN.md. Edit the script, not this page.</footer>
</div>`;

const HEAD = `<title>What to build next</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>${STYLE}${EXTRA}</style>`;

mkdirSync("public/roadmap", { recursive: true });
writeFileSync("public/roadmap/index.html",
  `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
${HEAD}</head><body>${BODY}</body></html>`);
// the same page without the document skeleton, for publishing as an artifact
writeFileSync("public/roadmap/artifact.html", `${HEAD}${BODY}`);
console.log("wrote public/roadmap/index.html");
