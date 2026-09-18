// Builds public/roadmap/index.html: the plan, ordered, with the reasoning kept next to it.
// Linked from the admin header. Same brushed-steel styling as the element map, so the
// owner-facing pages read as one set. Dependency-free: CI has no node_modules cache.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const STYLE = readFileSync("scripts/element-map.css", "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Every item carries its own argument: what it is, why now, and what it touches. */
const NOW = [
  {
    title: "Switch accounts on",
    line: "Google and Apple sign-in are wired end to end and dormant.",
    why: "The client loads the Firebase SDK only when Sign in is tapped; the Worker verifies the ID token against Google's keys itself and ties the account to the profile, so a second phone adopts and merges the way a link code does. All it needs is a Firebase project: the web config on the game, the project id on the Worker, and the Google provider enabled. Apple needs a Services ID from the Apple developer account and can follow.",
    touches: ["VITE_FIREBASE_CONFIG", "FIREBASE_PROJECT_ID in wrangler.toml", "Firebase console: Google provider"],
    size: "small",
  },
  {
    title: "A plausibility screen on daily posts",
    line: "Reject the impossible on the request, before the replay ever queues.",
    why: "The daily replay now runs off the request path in a Durable Object and cuts a claim the tape does not reach, seconds after it lands. A cheap structural screen on the request itself, height per fling, height per second, fling vectors inside the slingshot's reach, refuses a 50,000 cm claim on three flings before it is ever on the board.",
    touches: ["worker/src/replay.ts checkTape", "worker/src/index.ts /score"],
    size: "small",
  },
  {
    title: "Feel pass from phone play",
    line: "The audit's open loop items, with a phone in hand.",
    why: "Terrain escalation, seed skeletons, release spin and the speed ceiling are fixed. What is left is felt rather than measured: a first run that forgives its first three flings, a red line that telegraphs, a door that looks like it is going somewhere, and the seed-to-seed variance clamp. Numbers live in config.ts.",
    touches: ["src/game/config.ts", "src/game/render.ts", "src/game/world.ts"],
    size: "medium",
  },
];

const THEN = [
  {
    title: "Capacitor, rewarded ads, IAP",
    line: "Wrap it and let it earn.",
    why: "The loop brings people back now: a daily climb, a streak worth protecting, missions, a league, races live and by link. Give it a few weeks of daily numbers, then package it. The ad hook for revives already exists in main.ts.",
    touches: ["Capacitor shell", "AdMob", "store IAP for gems"],
    size: "large",
  },
  {
    title: "Live race polish",
    line: "Reconnect, spectate, rematch.",
    why: "The room keeps a seat for a player whose socket drops, but the phone does not yet try to get back in. A rematch button on the result and a way for a third phone to watch are the next things two people who just raced will ask for.",
    touches: ["src/game/live.ts", "worker/src/match.ts", "result card"],
    size: "medium",
  },
  {
    title: "A shareable daily card",
    line: "Date, rank and streak on the card, not a generic number.",
    why: "The one run where the whole world climbed the same fridge shares the same card as any other. Rank is already computed; the card renderer already exists.",
    touches: ["worker/src/card.ts", "src/game/share.ts"],
    size: "small",
  },
];

const HOLD = [
  ["Offline income, prestige, season pass", "The shape of a much bigger game. Revisit when the daily board and the league have a few weeks of numbers to argue from."],
  ["Crew", "Cut in September and archived under archive/crew, with CREW_DESIGN.md as the plan. Stage 1 is Stack, if it ever comes back."],
  ["More creatures", "Seven bodies is enough until something is actually gated behind an eighth."],
  ["Partial replay of a daily", "Considered and declined: a tape is inputs only, so the state a minute before the end exists only by simulating everything before it, and a phone-supplied checkpoint verifies nothing. The full replay is seconds in the object; a screen on the request is the cheap half."],
];

const DECIDE = [
  {
    q: "Open: the Firebase project",
    body: "Accounts are built and switched off. They turn on with a web config on the game and a project id on the Worker, Google first, Apple when the Services ID exists.",
  },
  {
    q: "Open: how long do the boards keep their rows?",
    body: "A row per player per day on the daily, per week on the league, a tape per daily post and a tape per shared race. Nothing clears any of them. Fine for months, worth a rule before it is worth a bill.",
  },
  {
    q: "Answered: the game's clock is US Central",
    body: "The daily, the missions, the streak, the league week and the month's door all turn over at midnight Chicago. One module decides what today is and the game, the Worker and the admin page all ask it.",
  },
  {
    q: "Answered: accounts are Firebase Auth, the database stays D1",
    body: "Identity only. The SDK is fetched on tap, the Worker checks the token without an admin SDK, and the uid maps to the profile the game already runs on.",
  },
  {
    q: "Answered: crew is cut, the daily run is what gets promoted",
    body: "Both decisions are in the code. Crew and Expeditions are archived under archive/crew; the daily climb was built first and the streak was built to sit under it.",
  },
];

const SHIPPED = [
  ["Live ghost race", "A Durable Object per match relays each phone's inputs to the other, where they drive a ghost in the friend's own look beside the live toy. 3, 2, 1, GO; no pausing; a friend who finishes or leaves stays drawn where they got to. Both tapes are replayed by the room and the result is what the replays reach."],
  ["Async race", "Sharing a climb sends its tape up under a short id and the link carries the id; whoever opens it climbs the same fridge with the sharer's ghost beside them and their height as the line."],
  ["Accounts, wired", "Firebase sign-in on the phone, verified on the Worker against Google's keys, tied to the profile. Off until configured: no rows, no SDK fetched, /auth answers 503."],
  ["Daily replay off the request", "A request has milliseconds of CPU and a replay needs seconds, so every real-length daily failed verification. The claim lands at once, a Durable Object climbs the tape and cuts the row if it disagrees, with a twenty-second budget and ninety-minute tapes."],
  ["Central time", "Midnight Chicago is when the day, the week and the month turn over, with the reset counted down on the menu."],
  ["Wallet ledger", "Coins and gems merge across devices by what came in and what went out, both of which only grow, so money spent on one phone stays spent."],
  ["Sizes from the bench", "World 26: every door object is drawn at the size chosen for it on the scale bench, from one table, with the bench working in percent of that size."],
  ["Audit fixes", "Six read-only lanes over movement, sounds, rendering, gadgets, the shell and the Worker: silent panel landings, the no-hit mission, resumed dailies, the phantom keyring and thermometer (gadget art scaled about the world origin), score posts anyone could forge, and a dozen more."],
  ["Ghost of your best run", "The whole sim again: a second Game from the tape's seed, stepped 1/120 beside the live run and fed its flings. Only offered on the door the tape was recorded on, because a ghost anywhere else is a lie."],
  ["Install and auto-kit", "beforeinstallprompt captured, a Settings row that knows all three states, written-out Safari steps for iOS, and one offer after three climbs. Plus a kit that buys itself, so CLIMB AGAIN is one tap."],
  ["Weekly league", "Buckets of about thirty by metres climbed that week; the top ten go up a tier on Monday, the bottom ten go down, across Paper, Plastic, Steel, Chrome and Gold. Seated atomically, no cron job."],
  ["Fridge of the month", "Twelve doors across the year, repainted on the first, each carrying one pattern you can only get by climbing that month."],
  ["Input recorder", "Every fling and climb written down with its run time. A tape replays into the same climb, to the centimetre, and now carries the look it was climbed in."],
  ["Daily climb", "One fridge for everybody for the Central date, one scored attempt, no kit, a TODAY board; the Worker owns the day and one phone's climb marks the day on every other."],
  ["Missions and streaks", "Three a day, rolled from the player and the date so every device rolls the same three, merged across devices, against counters the run already kept."],
  ["Crew and Expeditions", "Out of the game and into archive/crew, with four upgrades nobody could feel."],
];

/**
 * Twenty-two read-only audits, one lane each, run against the shipped build in September.
 * Kept here rather than in a document nobody opens, because the next twenty commits come
 * out of this list. Two findings were wrong and are recorded as wrong: an audit that is
 * quietly deleted when it is inconvenient is not an audit.
 */
const AUDIT = [
  {
    band: "Ship-blockers",
    note: "Nothing else on this page matters if these are still true when the game gets its first real traffic.",
    rows: [
      ["Scores are taken on trust", "worker/src/index.ts", "POST /score and /run accept any cm with no proof and no token, so a console fetch takes #1 on the daily instantly. /rename has no ownership check either, which is impersonation. This is what roadmap item 1 exists to close.", "fixed"],
      ["Chat cannot see personal information", "worker/src/index.ts cleanChat", "A phone number, a street address and a social handle all pass through untouched, in a game children play, while our own privacy page tells them not to post exactly those. The profanity filter falls to spaces, repeated letters and fullwidth Unicode, and an evasion never counts toward a strike.", "fixed"],
      ["Block is cosmetic", "src/game/ui.ts, worker/src/index.ts", "Blocking hides a sender in one browser; the Worker is never told, so a blocked player keeps posting to everyone else. Reports and strikes sit in D1 until someone opens the admin panel by hand.", "fixed"],
      ["Link codes can be guessed", "worker/src/index.ts POST /claim", "Six characters, ten minutes, no rate limit and no lockout, and a claimed code hands over a child's whole profile. Nothing anywhere in the Worker is rate limited.", "fixed"],
      ["The core gesture is silent", "src/game/audio.ts, src/game/game.ts", "sfx.launch() is composed and never called. The one thing every player does every few seconds makes no sound.", "fixed"],
    ],
  },
  {
    band: "The loop itself",
    note: "Retention machinery is ahead of the thing it retains people for. This is the gap.",
    rows: [
      ["The fling is not legible in ten seconds", "src/main.ts, src/game/magnetism.ts", "Under scripted play the first run ended at 0 cm before a single successful stick. Everything below this line is infrastructure for a core loop players have not been convinced to love yet. Suggested: quietly forgiving physics for the first three flings of a first-ever run, not another text bubble.", "open"],
      ["Release adds spin nobody can control", "src/game/game.ts launch", "c.spin takes a noise term worth about four radians a second, keyed to the release frame. Skill cannot overcome it and the player cannot see it.", "fixed"],
      ["Terrain stops getting harder at 1,360 cm", "src/game/world.ts generate", "difficulty is min(1, i/40) and every probability that reads it flatlines there. Measured hazard density is identical from 1,360 cm to 13,600 cm; only the red line still escalates, so most of a strong run is on flat ground.", "fixed"],
      ["Every seed has the same skeleton", "src/game/world.ts generate", "Gadget doors land on i%4 and set pieces on i%5, so across ten seeds they fall in exactly the same columns. Gadget kinds are a literal round robin. Only the contents vary, never the pacing.", "fixed"],
      ["A weak run is eight times more seed than skill", "src/game/world.ts", "A bot with fixed inputs ranged 73 to 625 cm across ten seeds. Hazard-heavy doors can string together with no anti-streak clamp.", "open"],
      ["Speed multipliers stack with no ceiling", "src/game/game.ts wallSpeed", "The stepped ramp, the creep and the catch-up multiply with no cap on the product, so a climber who pulls ahead can meet an eleven-times spike rather than an escalation.", "fixed"],
    ],
  },
  {
    band: "Economy",
    note: "Modelled at about 230 coins a run on day one and about 7,000 a day by day thirty.",
    rows: [
      ["Income outruns every sink", "src/game/config.ts, src/game/creatures.ts", "A full kit is 758 coins and the prize machine caps at 25,600. Both flatten against a curve that keeps climbing, and solo has no permanent sink at all.", "open"],
      ["Sell nothing that touches the climb", "—", "The reading across the monetisation and privacy lanes agrees: rewarded ads on the hook that already exists, one-time cosmetic packs, a patron tip. Never creatures or patterns for cash, never league placement, never anything that climbs faster. Any purchase screen needs a parental gate.", "decided"],
    ],
  },
  {
    band: "Reach",
    note: "The daily is Wordle-shaped mechanically and produces nothing anyone can post.",
    rows: [
      ["The daily has no shareable artefact", "worker/src/card.ts", "Challenge.mode is solo or crew; there is no daily. So the one run where the whole world climbed the same fridge shares the same generic card as any other: a name, a number, a mode pill. No date, no rank, no streak — and rank is already computed in main.ts.", "open"],
      ["A challenge sends a number, not a door", "src/main.ts startRun, src/game/share.ts", "Accepting a challenge generates a fresh fridge, so the target height came off a course the recipient never sees. The ghost now makes the fix cheap: send the tape's seed.", "fixed"],
      ["The game-over card never mentions the loop", "src/game/ui.ts showGameOver", "No daily, no streak, no league tier at the exact moment attention is highest. The league is two taps deep and opens on a blank body.", "fixed"],
    ],
  },
  {
    band: "Craft",
    note: "Small, mostly cheap, and each one is somebody's first impression.",
    rows: [
      ["Five tabs in a four-column grid", "src/style.css .seg", "The board's fifth tab orphans onto a second row.", "open"],
      ["The red line has no telegraph", "src/game/render.ts, src/game/hud.ts", "One or two pixels and a small bar, for the thing that ends almost every run. Death reads as a number running out rather than a threat arriving.", "open"],
      ["Climbing higher does not look like going anywhere", "src/game/scenery-materials.ts", "The door is the same texture at 200 cm and at 400 cm; only the props change.", "open"],
      ["Six gradients per climber per frame", "src/game/climber-render.ts", "None cached, though most change only with the climber's colour. Every visible zone rebuilds its gradients and shadows every frame too, despite the file saying it caches them. Measured against a 49.8 ms draw spike in real play.", "fixed"],
      ["Segment generation hitches", "src/game/world.ts generate", "Tail spikes of four to six milliseconds on the frame a new door scrolls in, from sticker placement retries and bumper path checks done all at once.", "open"],
      ["The canvas is invisible to a screen reader", "src/game/ui.ts, index.html", "No role, no label, no live region, and drag is the only touch input. Push and pull are told apart by hue alone, and the prize reel ignores prefers-reduced-motion.", "open"],
      ["The app precaches 10.8 MB on install", "vite.config.ts", "188 files, 7.9 MB of it art, downloading against the assets actually on screen.", "fixed"],
    ],
  },
  {
    band: "Wrong",
    note: "Reported by an auditor, checked against the code, and false. Kept visible so nobody re-files them.",
    rows: [
      ["\u201cNothing ever dies of the hand or the paw\u201d", "src/game/game.ts damage", "It does. damage() calls lose() with the cause at zero hearts, and the hand and paw call sites pass their own. The bot that reported this had three hearts, took three hits and never reached zero, so it only ever saw the red line.", "wrong"],
      ["\u201cThe photogenic objects are the ones you cannot stick to\u201d", "src/game/world.ts isMetal", "The opposite, since world version 15: a photo on a fridge is held there by a magnet, so a magnet holds on it. Cards, the calendar and the photo props are all climbable. Glass, trim and voids are what slide you off.", "wrong"],
    ],
  },
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
  .band{margin-top:22px}
  .band > h3{font-family:var(--display);font-weight:800;font-size:19px;letter-spacing:.3px;margin:0 0 3px}
  .band > p{margin:0 0 10px;color:var(--ink-3);font-size:14px;max-width:74ch}
  .finds{display:grid;gap:0}
  .find{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 14px;padding:12px 0;border-top:1px solid var(--line-soft)}
  .find b{font-family:var(--display);font-weight:800;font-size:15.5px;letter-spacing:.3px}
  .find code{grid-column:1/-1;font-family:var(--mono);font-size:12px;color:var(--ink-3);word-break:break-word}
  .find p{grid-column:1/-1;margin:2px 0 0;color:var(--ink-2);font-size:14px;max-width:80ch}
  .flag{align-self:start;font-family:var(--display);font-weight:800;font-size:11px;letter-spacing:1.4px;
    text-transform:uppercase;padding:3px 8px;border-radius:20px;white-space:nowrap}
  .flag.open{color:var(--danger);box-shadow:inset 0 0 0 1px currentColor}
  .flag.fixed{color:var(--accent);box-shadow:inset 0 0 0 1px currentColor}
  .flag.decided{color:var(--ink-3);box-shadow:inset 0 0 0 1px currentColor}
  .flag.wrong{color:var(--ink-3);box-shadow:inset 0 0 0 1px currentColor;text-decoration:line-through}
  .ledger span{color:var(--ink-2)}
  footer{margin-top:44px;padding-top:14px;border-top:1px solid var(--line);color:var(--ink-3);font-size:13px}
`;

const BODY = `
<div class="wrap">
  <p class="eyebrow">Magnet Climbers &middot; plan</p>
  <h1>What to build next</h1>
  <p class="standfirst">The recorder has cashed in: your own ghost, a friend\u2019s ghost from a link, a friend\u2019s ghost live, and a daily board the Worker climbs again itself. What is left is a switch to flip, a screen to add, and a phone in hand.</p>

  <div class="lede-wrap">
    <div class="thesis">
      <p>Everything the last plan called Now and Then is in the game except packaging. Accounts are built and waiting on a Firebase project; the live race is out and being played; the daily is checked by replay without anyone waiting on it.</p>
      <p>So the order changes shape: nothing left is a system. It is a config to paste, a cheap screen on one route, and the audit\u2019s felt-not-measured items, which want a phone rather than a plan. Then a few weeks of numbers before the wrap.</p>
    </div>
    <div class="state">
      <h4>Where it stands</h4>
      <dl>
        <dt>Modes</dt><dd>solo · daily · race (link, live)</dd>
        <dt>World version</dt><dd>27</dd>
        <dt>Items on the door</dt><dd>152, 147 sized</dd>
        <dt>Coin sinks</dt><dd>2, one doubling</dd>
        <dt>Reasons to return</dt><dd>daily · streak · league · missions · month</dd>
        <dt>Game clock</dt><dd>midnight Chicago</dd>
        <dt>Accounts</dt><dd>wired, off</dd>
        <dt>Tests</dt><dd>103 passing</dd>
      </dl>
    </div>
  </div>

  <section>
    <h2>Now <span class="count">in this order</span></h2>
    <p class="note">None of these is a system. The first is a config paste, the second an afternoon, the third a phone in hand.</p>
    <div class="steps">${NOW.map((it, i) => item(it, i + 1)).join("")}</div>
  </section>

  <section class="next">
    <h2>Then <span class="count">once the loop closes</span></h2>
    <p class="note">After a few weeks of daily numbers. In order, but the order is soft.</p>
    <div class="steps">${THEN.map((it, i) => item(it, i + 3)).join("")}</div>
  </section>

  <section>
    <h2>Holding <span class="count">and why</span></h2>
    <div class="hold">${HOLD.map(([t, b]) => `<div><b>${esc(t)}</b><p>${esc(b)}</p></div>`).join("")}</div>
  </section>

  <section>
    <h2>Decisions <span class="count">two open, three settled</span></h2>
    ${DECIDE.map((d) => `<div class="ask"><h3>${esc(d.q)}</h3><p>${esc(d.body)}</p></div>`).join("")}
  </section>

  <section>
    <h2>Audit <span class="count">22 lanes, September</span></h2>
    <p class="note">Twenty-two read-only passes over the September build, plus six more this week over movement, sounds, rendering, gadgets, the shell and the Worker. Everything below names the file it lives in; a flag says where it stands now. Twelve of the September findings have been fixed since.</p>
    ${AUDIT.map((b) => `<div class="band"><h3>${esc(b.band)}</h3><p>${esc(b.note)}</p><div class="finds">${
      b.rows.map(([t, where, body, flag]) => `<div class="find"><b>${esc(t)}</b><span class="flag ${flag}">${esc(flag)}</span><code>${esc(where)}</code><p>${esc(body)}</p></div>`).join("")
    }</div></div>`).join("")}
  </section>

  <section>
    <h2>Shipped <span class="count">September</span></h2>
    <p class="note">Everything the last two plans called Now and Then, bar the wrap.</p>
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
