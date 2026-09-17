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
    why: "Nothing new needs instrumenting. The run already counts chains, gadget rides, paints, hits, coins, height and cause of death. Missions turn those into a reason to play differently on a door you have climbed a hundred times, and they feed coins to a machine whose price now doubles every spin.",
    touches: ["feats in game.ts", "save: three active + progress", "menu and game-over cards"],
    size: "medium",
  },
  {
    title: "Daily reward and streak",
    line: "Open the app, claim a drop. Seven in a row pays a pattern.",
    why: "Promoted after the audit, because the two things that were above it are already built. It pairs with the daily run — the streak is the reason to open, the run is the reason to stay — and it needs no server work beyond a claimed-on date.",
    touches: ["save: last claim + streak", "menu badge", "a claim card"],
    size: "small",
  },
];

const THEN = [
  {
    title: "Weekly league",
    line: "Buckets of about thirty by lifetime metres; top promote, bottom drop.",
    why: "The global board is unwinnable for everyone except the top ten, so it stops motivating almost every player. Buckets give a climb that any player can be near the top of, and the metres are already banked per player.",
    touches: ["worker: a bucketing job", "board tab", "tier badge"],
    size: "large",
  },
  {
    title: "Themed fridge of the month",
    line: "A different kitchen, a different door, one limited pattern.",
    why: "Every update needs something to show, and the art pipeline is the strongest part of this project. A monthly door is the cheapest way to turn that strength into a reason to post — and the surfaces, seams and palette are already data.",
    touches: ["scenery palette", "an art pack", "one pattern behind a date"],
    size: "medium",
  },
  {
    title: "Input recorder",
    line: "Log every fling and climb as {tick, id, vector}.",
    why: "The gate in front of ghosts, async races and any real score validation. On its own it is invisible to players, which is exactly why it should be built deliberately rather than as step one of a race feature.",
    touches: ["game.ts input capture", "snapshot format", "worker: replay check"],
    size: "medium",
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
  ["Prize machine", "Was next on the list; it was already built and is now a real sink — every spin costs double the last, 100 → 200 → 400, about 1.6M coins for all fourteen patterns."],
  ["Instant restart and the near miss", "Was third on the list; already done. CLIMB AGAIN goes straight back to the door through the kit sheet, and your best height is drawn on the fridge as a line that turns green when you pass it."],
  ["Creature roster and patterns", "Bodies, patterns, unlock rules and the collection panel all exist. The roadmap still listed this as work."],
  ["Kit, per run", "Coins buy a higher jump and a stickier floor for one climb, three clicks each, gone when the run ends."],
  ["Chat, with moderation", "Global chat, scroll-back, block and report by avatar, and a three-strike censor flag into the admin panel."],
  ["Owner tooling", "Art archive, element map, placement workbench, and now a scale bench that puts any object on the real door beside a real climber."],
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
  <p class="standfirst">Re-ordered after reading the code rather than the backlog. Two of the three things that were queued turned out to be built already; what is left is the gap that has not moved — nothing brings anyone back tomorrow.</p>

  <div class="lede-wrap">
    <div class="thesis">
      <p>Stop adding objects to the door. The next three releases should be the reason to open the app again: a daily run everyone shares, missions written against counters we already keep, and a streak worth protecting.</p>
      <p>Then the league and a themed door each month. Everything else — ghosts, races, accounts, store wrappers — is real work that does not change whether anyone plays tomorrow.</p>
    </div>
    <div class="state">
      <h4>Where it stands</h4>
      <dl>
        <dt>Mode</dt><dd>solo only</dd>
        <dt>World version</dt><dd>23</dd>
        <dt>Items on the door</dt><dd>152</dd>
        <dt>Coin sinks</dt><dd>2, one doubling</dd>
        <dt>Reasons to return</dt><dd>0</dd>
        <dt>Tests</dt><dd>65 passing</dd>
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
    <p class="note">These pay off once there is a reason to come back. In order, but the order is softer.</p>
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
    <h2>Struck off <span class="count">already built when checked</span></h2>
    <p class="note">The backlog had these as work to come. They are in the code today — the first two were the items sitting above everything else.</p>
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
