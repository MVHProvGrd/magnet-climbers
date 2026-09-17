// Builds public/roadmap/index.html: the plan, ordered, with the reasoning kept next to it.
// Linked from the admin header. Same brushed-steel styling as the element map, so the
// owner-facing pages read as one set. Dependency-free: CI has no node_modules cache.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const STYLE = readFileSync("scripts/element-map.css", "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Every item carries its own argument: what it is, why now, and what it touches. */
const NOW = [
  {
    title: "Ghost of your best run",
    line: "Your own best climb, drawn on the door beside you.",
    why: "The recorder is in and the best run on a device already keeps its tape, so this is playback and a second climber drawn faintly — no new systems. A line on the fridge says how far you got; a ghost says how you got there, which is the part worth beating.",
    touches: ["recorder playback", "a ghosted climber in render.ts", "the tape already in local storage"],
    size: "medium",
  },
  {
    title: "Replay the daily on the server",
    line: "Check a daily score by climbing it again, not by trusting the number.",
    why: "A shared board is the first thing worth cheating, and the daily board is now the one people will care about. The sim is deterministic and the tape is small; the Worker can replay a daily tape headless and keep the row only if the climb agrees with the score.",
    touches: ["a headless build of the sim", "worker: tape storage + replay", "score post carries the tape"],
    size: "large",
  },
  {
    title: "Async race from a share link",
    line: "Race the run your friend actually climbed, not their number.",
    why: "Share links already carry a height, and a tape turns that number into an opponent moving beside you. It needs the ghost renderer first and the same tape storage the replay check wants, so it comes third and costs the least by then.",
    touches: ["share links", "worker: tape by id", "race UI"],
    size: "large",
  },
];

const THEN = [
  {
    title: "Accounts",
    line: "Sign in on top of the link codes.",
    why: "Link codes carry a profile between devices today. Accounts become worth the migration now that there is a streak, a league tier and a month's limited pattern to lose — but they need OAuth ids from you, so they wait on a decision rather than on code.",
    touches: ["OAuth client ids from you", "worker: identity", "save merge"],
    size: "large",
  },
  {
    title: "Live ghost race",
    line: "Two climbers, one door, settled by the server.",
    why: "A Durable Object per match relaying inputs, with the result replayed server-side. It only makes sense once async racing shows anyone wants to race at all.",
    touches: ["Durable Object", "socket relay", "server replay"],
    size: "large",
  },
  {
    title: "Capacitor, rewarded ads, IAP",
    line: "Wrap it and let it earn.",
    why: "The loop brings people back now: a daily climb, a streak worth protecting, missions and a league. Give it a few weeks of daily numbers, then package it — the ad hook for revives already exists in main.ts.",
    touches: ["Capacitor shell", "AdMob", "store IAP for gems"],
    size: "large",
  },
];

const HOLD = [
  ["Offline income, prestige, season pass", "The shape of a much bigger game. Revisit when the daily board and the league have a few weeks of numbers to argue from."],
  ["Crew", "Cut in September and archived under archive/crew, with CREW_DESIGN.md as the plan. Stage 1 is Stack, if it ever comes back."],
  ["More creatures", "Seven bodies is enough until something is actually gated behind an eighth."],
];

const DECIDE = [
  {
    q: "Open: OAuth client ids, when you want accounts",
    body: "Everything else on the list can be built from here. Accounts cannot: they need a Google and an Apple client id registered to you, and a decision about whether a signed-in profile replaces the link codes or sits beside them. Nothing is blocked on it today.",
  },
  {
    q: "Open: how long does a daily board keep its rows?",
    body: "A row per player per day, and nothing clears them. Fine for months, worth a rule before it is worth a bill. The same question is now true of the league, which writes a row per player per week.",
  },
  {
    q: "Answered: crew is cut, the daily run is what gets promoted",
    body: "Both decisions are in the code. Crew and Expeditions are archived under archive/crew; the daily climb was built first and the streak was built to sit under it.",
  },
];

const SHIPPED = [
  ["Weekly league", "Buckets of about thirty by metres climbed that week; the top ten go up a tier on Monday, the bottom ten go down, across Paper, Plastic, Steel, Chrome and Gold. No cron job — a player is seated the first time they climb in a new week."],
  ["Fridge of the month", "Twelve doors across the year, repainted on the first, each carrying one pattern you can only get by climbing that month. The prize machine will not sell them at any price."],
  ["Input recorder", "Every fling and climb written down with its run time. A tape replays into the same climb, to the centimetre; the best run on a device keeps one."],
  ["Daily climb", "One fridge for everybody from the UTC date, one scored attempt, no kit, a TODAY board, and the Worker owns the day."],
  ["Missions and streaks", "Three missions at a time against counters the run already kept, and a daily streak paying 40 up to 200 with a pattern on the seventh day."],
  ["Crew and Expeditions", "Out of the game and into archive/crew, with four upgrades nobody could feel."],
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
  <p class="standfirst">Six releases in: a reason to come back, a score worth caring about, a door that changes every month, and a recorder underneath it all. What is left is what the recorder unlocks.</p>

  <div class="lede-wrap">
    <div class="thesis">
      <p>The recorder is the hinge. Every run is now a tape that replays into the same climb, which turns three separate wishes into one line of work: a ghost of your best run, a server that checks a daily score by climbing it, and racing a friend\u2019s actual run instead of their number.</p>
      <p>Do them in that order: the ghost is playback of a tape that already exists, the replay check needs the sim running headless, and the race needs both. Accounts and packaging wait on a decision and on numbers, not on code.</p>
    </div>
    <div class="state">
      <h4>Where it stands</h4>
      <dl>
        <dt>Modes</dt><dd>solo · daily</dd>
        <dt>World version</dt><dd>23</dd>
        <dt>Items on the door</dt><dd>152</dd>
        <dt>Coin sinks</dt><dd>2, one doubling</dd>
        <dt>Reasons to return</dt><dd>daily · streak · league</dd>
        <dt>Tests</dt><dd>68 passing</dd>
      </dl>
    </div>
  </div>

  <section>
    <h2>Now <span class="count">in this order</span></h2>
    <p class="note">All three are the recorder cashing in. Nothing here needs a new idea \u2014 they need the tape, which exists.</p>
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
    <h2>Decisions <span class="count">two open, the rest settled</span></h2>
    ${DECIDE.map((d) => `<div class="ask"><h3>${esc(d.q)}</h3><p>${esc(d.body)}</p></div>`).join("")}
  </section>

  <section>
    <h2>Shipped <span class="count">this month</span></h2>
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
