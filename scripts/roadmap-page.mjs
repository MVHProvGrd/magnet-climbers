// Builds public/roadmap/index.html: the plan, ordered, with the reasoning kept next to it.
// Linked from the admin header. Same brushed-steel styling as the element map, so the
// owner-facing pages read as one set. Dependency-free: CI has no node_modules cache.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const STYLE = readFileSync("scripts/element-map.css", "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Every item carries its own argument: what it is, why now, and what it touches. */
const NOW = [
  {
    title: "Weekly league",
    line: "Buckets of about thirty by lifetime metres; top promote, bottom drop.",
    why: "With a daily board live, this is the next thing that makes a score worth caring about. The global board is unwinnable for everyone outside the top ten, so it stops motivating almost every player; a bucket is a board you can be near the top of. The metres are already banked per player, so the work is a grouping job and a tab.",
    touches: ["worker: a weekly bucketing job", "board tab", "tier badge"],
    size: "large",
  },
  {
    title: "Themed fridge of the month",
    line: "A different kitchen, a different door, one limited pattern.",
    why: "The daily run is the thing worth clicking; a monthly door is the thing worth posting. The art pipeline is the strongest part of this project and the surfaces, seams and palette are already data, so this turns that strength into a reason to show up in a feed.",
    touches: ["scenery palette", "an art pack", "one pattern behind a date"],
    size: "medium",
  },
  {
    title: "Input recorder",
    line: "Log every fling and climb as {tick, id, vector}.",
    why: "The gate in front of ghosts, async races and any real score validation — and now that a daily board exists, validation matters more than it did yesterday. Invisible to players on its own, which is exactly why it should be built deliberately rather than as step one of a race feature.",
    touches: ["game.ts input capture", "snapshot format", "worker: replay check"],
    size: "medium",
  },
];

const THEN = [
  {
    title: "Ghost of your best run",
    line: "Your own best climb, drawn on the door beside you.",
    why: "Straight off the recorder, and the first thing it pays for. A line on the fridge says how far you got; a ghost says how you got there, which is the part worth beating.",
    touches: ["recorder playback", "a second climber drawn ghosted"],
    size: "medium",
  },
  {
    title: "Async race from a share link",
    line: "Race the run your friend actually climbed, not their number.",
    why: "The share links already exist and already carry a height. Racing the recording turns a number into an opponent, and it needs no server beyond storing the tape.",
    touches: ["share links", "worker: tape storage", "race UI"],
    size: "large",
  },
  {
    title: "Accounts",
    line: "Sign in on top of the link codes.",
    why: "Link codes carry a profile between devices today, which covers most of it. Accounts become worth the migration once there is a streak and a league standing worth losing — which, as of this week, there is.",
    touches: ["OAuth client ids from you", "worker: identity", "save merge"],
    size: "large",
  },
];

const HOLD = [
  ["Live ghost race", "A Durable Object per match, inputs over a socket, the server settling the result. Real work, and it only makes sense after async racing proves anyone wants to race at all."],
  ["Capacitor, AdMob, IAP", "Packaging and money. The loop now brings people back; give it a few weeks of daily numbers before wrapping it."],
  ["Offline income, prestige, season pass", "The shape of a much bigger game. Revisit when the daily board says the core loop holds."],
  ["Crew", "Cut in September and archived under archive/crew, with CREW_DESIGN.md as the plan. Stage 1 is Stack, if it ever comes back."],
];

const DECIDE = [
  {
    q: "Answered: crew is cut, not paused",
    body: "The dead paths came out — crew rules, the lineup, SYNC, stacking, the human ladder, reserve climbers, the Expeditions tile and the four upgrades a lone climber could not feel. archive/crew holds the expedition recipes and a note on what went and what stayed; CREW_DESIGN.md is still the plan if it comes back one verb at a time.",
  },
  {
    q: "Answered: the daily run is what gets promoted",
    body: "So it was built first, and the streak was built to sit under it. The themed fridge is the thing that gives a post something to look at, which is why it is second on the list rather than first.",
  },
  {
    q: "Open: how long does a daily board keep its rows?",
    body: "Every day writes a row per player and nothing clears them. Fine for months; worth a retention rule before it is worth a bill. Say the word and the Worker drops days older than thirty on the next write.",
  },
];

const SHIPPED = [
  ["Daily climb", "One fridge for everybody, from the UTC date alone; one scored attempt, no kit, a TODAY board, and the Worker decides the day so nobody can pick a friendlier one."],
  ["Missions", "Three at a time on the menu and the game-over card, written against counters the run already kept. Finish one, it pays and another rotates in."],
  ["Streak", "The daily pays 40 up to 200 as the days run, and the seventh in a row pays a pattern. A missed day starts again at one."],
  ["Crew and Expeditions", "Out of the game and into archive/crew. Four upgrades nobody could feel went with them."],
  ["Prize machine", "Every spin costs double the last up to a 25,600 ceiling; a full set of fourteen patterns is about 179,000 coins."],
  ["Scale bench", "Any object on the real door beside a real climber, at any size, with a walk-through audit and one exported file."],
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
  <p class="standfirst">The three things that were queued here are built. There is a reason to open the app tomorrow now; what follows is about making a score worth caring about, and giving each update something to show.</p>

  <div class="lede-wrap">
    <div class="thesis">
      <p>The return loop is in: a daily climb everyone shares, three missions written against counters we already kept, and a streak that pays for turning up. That was the gap, and it is closed.</p>
      <p>Next is worth caring about: a league where an ordinary player can be near the top, a door that changes every month, and the recorder that ghosts and races both need. Money and packaging wait for a few weeks of daily numbers.</p>
    </div>
    <div class="state">
      <h4>Where it stands</h4>
      <dl>
        <dt>Modes</dt><dd>solo · daily</dd>
        <dt>World version</dt><dd>23</dd>
        <dt>Items on the door</dt><dd>152</dd>
        <dt>Coin sinks</dt><dd>2, one doubling</dd>
        <dt>Reasons to return</dt><dd>daily · streak · missions</dd>
        <dt>Tests</dt><dd>65 passing</dd>
      </dl>
    </div>
  </div>

  <section>
    <h2>Now <span class="count">in this order</span></h2>
    <p class="note">The question has moved on from "why open this again" to "why does my score matter". These three answer that one.</p>
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
    <h2>Decisions <span class="count">two settled, one open</span></h2>
    ${DECIDE.map((d) => `<div class="ask"><h3>${esc(d.q)}</h3><p>${esc(d.body)}</p></div>`).join("")}
  </section>

  <section>
    <h2>Shipped <span class="count">this pass</span></h2>
    <p class="note">Everything the plan called Now, plus the decisions that came with it.</p>
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
