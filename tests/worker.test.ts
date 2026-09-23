import assert from "node:assert/strict";
import { test } from "node:test";
import worker, { type Env, ensureReports } from "../worker/src/index";
import { makeFakeDB } from "./worker-db";
import { Game } from "../src/game/game";
import { World } from "../src/game/world";
import { dailySeed as workerDailySeed } from "../worker/src/replay";
import { dailySeed as clientDailySeed, todayKey, dailyWorld } from "../src/game/leaderboard";

function env(mode: "shadow" | "enforce" = "shadow"): Env {
  const { DB } = makeFakeDB();
  return { DB: DB as never, ALLOWED_ORIGINS: "http://localhost", TAPE_MODE: mode };
}

let nextPlayer = 0;
/** A fresh player with a cloud save already on file, the way every write route expects.
 *  The id always looks like a real one (`p-…`) so PLAYER_ID_RE in the Worker accepts it;
 *  `tag` just keeps different tests' ids visually distinct in failures. */
async function seedPlayer(e: Env, tag = ""): Promise<{ playerId: string; token: string }> {
  const playerId = `p-${tag}${++nextPlayer}`;
  const token = "t".repeat(20) + nextPlayer;
  await e.DB.prepare("INSERT INTO saves (player_id, token, blob, rev, updated_at) VALUES (?, ?, '{}', 1, ?)")
    .bind(playerId, token, Date.now()).run();
  return { playerId, token };
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body), headers });
const get = (path: string) => new Request(`http://localhost${path}`, { method: "GET" });

// -------------------------------------------------------------------------------------------
// PII: phone numbers, addresses and social handles get redacted and flagged for the owner.
// -------------------------------------------------------------------------------------------

test("chat redacts a phone number and flags it for the owner", async () => {
  const e = env();
  const { playerId, token } = await seedPlayer(e);
  const res = await worker.fetch(post("/chat", { playerId, token, name: "Kid", text: "call me 555-123-4567" }), e);
  const body = (await res.json()) as { message: { text: string; id: number } };
  assert.equal(res.status, 200);
  assert.ok(!body.message.text.includes("555-123-4567"), "the phone number is not shown in the room");
  assert.ok(body.message.text.includes("[redacted]"));
  const report = await e.DB.prepare("SELECT text FROM chat_reports WHERE kind = 'pii' AND target_id = ?").bind(playerId).first<{ text: string }>();
  assert.ok(report, "a pii report was filed for the owner to review");
  assert.ok(report!.text.includes("555-123-4567"), "the evidence keeps the original text, only the room copy is masked");
});

test("chat redacts a street address and a social handle", async () => {
  const e = env();
  const a = await seedPlayer(e);
  const r1 = await worker.fetch(post("/chat", { playerId: a.playerId, token: a.token, name: "Kid", text: "meet me at 123 Main St" }), e);
  const b1 = (await r1.json()) as { message: { text: string } };
  assert.ok(!b1.message.text.includes("123 Main St"));

  const b = await seedPlayer(e);
  const r2 = await worker.fetch(post("/chat", { playerId: b.playerId, token: b.token, name: "Kid", text: "my snap is john.doe99" }), e);
  const b2 = (await r2.json()) as { message: { text: string } };
  assert.ok(!b2.message.text.includes("john.doe99"));
});

test("chat leaves ages, scores and plain sentences alone", async () => {
  const e = env();
  for (const text of ["I'm 8", "level 100", "1234 cm", "discord is fun", "my best is 199000cm today"]) {
    const { playerId, token } = await seedPlayer(e);
    const res = await worker.fetch(post("/chat", { playerId, token, name: "Kid", text }), e);
    const body = (await res.json()) as { message: { text: string } };
    assert.equal(body.message.text, text, `"${text}" should not be touched`);
    const report = await e.DB.prepare("SELECT 1 AS x FROM chat_reports WHERE kind = 'pii' AND target_id = ?").bind(playerId).first();
    assert.equal(report, null, `"${text}" should not file a pii report`);
  }
});

// -------------------------------------------------------------------------------------------
// Profanity evasions: leetspeak was already caught; these were the gaps.
// -------------------------------------------------------------------------------------------

test("profanity filter catches spaced-out, repeated and look-alike-Unicode evasions", async () => {
  const e = env();
  for (const text of ["n i g g e r you", "fuuuuck you", "ｆｕｃｋ you", "𝓯𝓾𝓬𝓴 you"]) {
    const { playerId, token } = await seedPlayer(e);
    const res = await worker.fetch(post("/chat", { playerId, token, name: "Kid", text }), e);
    const body = (await res.json()) as { message: { text: string } };
    assert.ok(!/fuck|nigger/i.test(body.message.text.normalize("NFKC")), `"${text}" should be starred out, got "${body.message.text}"`);
    const strike = await e.DB.prepare("SELECT n FROM chat_censors WHERE player_id = ?").bind(playerId).first<{ n: number }>();
    assert.equal(strike?.n, 1, `"${text}" should count as a censor strike`);
  }
});

test("an evaded name is rejected the same as a plain one", async () => {
  const e = env();
  const { playerId, token } = await seedPlayer(e);
  const res = await worker.fetch(post("/score", { playerId, token, name: "fuuuck", mode: "solo", cm: 100 }), e);
  const row = await e.DB.prepare("SELECT name FROM scores WHERE player_id = ?").bind(playerId).first<{ name: string }>();
  assert.equal(res.status, 200);
  assert.equal(row?.name, "climber");
});

// -------------------------------------------------------------------------------------------
// /rename requires the player's token.
// -------------------------------------------------------------------------------------------

test("/rename refuses a request without the player's token", async () => {
  const e = env();
  const victim = await seedPlayer(e);
  await e.DB.prepare("INSERT INTO scores (player_id, name, mode, cm, created_at) VALUES (?, 'Victim', 'solo', 500, ?)")
    .bind(victim.playerId, Date.now()).run();

  const impersonate = await worker.fetch(post("/rename", { playerId: victim.playerId, name: "Hacked" }), e);
  assert.equal(impersonate.status, 403);
  const wrongToken = await worker.fetch(post("/rename", { playerId: victim.playerId, token: "not-the-token", name: "Hacked" }), e);
  assert.equal(wrongToken.status, 403);
  const stillVictim = await e.DB.prepare("SELECT name FROM scores WHERE player_id = ?").bind(victim.playerId).first<{ name: string }>();
  assert.equal(stillVictim?.name, "Victim", "the board row must not have moved");

  const legit = await worker.fetch(post("/rename", { playerId: victim.playerId, token: victim.token, name: "NewName" }), e);
  assert.equal(legit.status, 200);
  const renamed = await e.DB.prepare("SELECT name FROM scores WHERE player_id = ?").bind(victim.playerId).first<{ name: string }>();
  assert.equal(renamed?.name, "NewName");
});

// -------------------------------------------------------------------------------------------
// /claim is throttled per IP.
// -------------------------------------------------------------------------------------------

test("/claim locks out a guessing script after a handful of attempts", async () => {
  const e = env();
  const ip = "203.0.113.9";
  const attempt = () => worker.fetch(post("/claim", { code: "AAAAAA" }, { "CF-Connecting-IP": ip }), e);
  const statuses: number[] = [];
  for (let i = 0; i < 20; i++) statuses.push((await attempt()).status);
  assert.ok(statuses.includes(429), `expected a 429 somewhere in ${JSON.stringify(statuses)} — brute force was not throttled`);
  // a different caller is unaffected
  const other = await worker.fetch(post("/claim", { code: "AAAAAA" }, { "CF-Connecting-IP": "198.51.100.4" }), e);
  assert.notEqual(other.status, 429);
});

// -------------------------------------------------------------------------------------------
// A block is honoured server-side once the caller identifies itself.
// -------------------------------------------------------------------------------------------

test("GET /chat hides a blocked sender from the player who blocked them", async () => {
  const e = env();
  const victim = await seedPlayer(e);
  const bully = await seedPlayer(e);
  await worker.fetch(post("/chat", { playerId: bully.playerId, token: bully.token, name: "Bully", text: "hey" }), e);
  await ensureReports(e);
  await e.DB.prepare(
    "INSERT INTO chat_reports (kind, target_id, target_name, reporter_id, message_id, text, created_at) VALUES ('block', ?, 'Bully', ?, NULL, NULL, ?)",
  ).bind(bully.playerId, victim.playerId, Date.now()).run();

  const unfiltered = await worker.fetch(get("/chat?after=0"), e);
  const unfilteredBody = (await unfiltered.json()) as { messages: { player_id: string }[] };
  assert.ok(unfilteredBody.messages.some((m) => m.player_id === bully.playerId));

  const filtered = await worker.fetch(get(`/chat?after=0&player=${victim.playerId}`), e);
  const filteredBody = (await filtered.json()) as { messages: { player_id: string }[] };
  assert.ok(!filteredBody.messages.some((m) => m.player_id === bully.playerId), "the blocked sender's message is gone for the blocker");
});


// -------------------------------------------------------------------------------------------
// The daily score is checked by replaying its tape, not by trusting the number.
// -------------------------------------------------------------------------------------------

const NO_EVENTS = { onPower: () => {}, onGameOver: () => {}, onCoins: () => {}, onGems: () => {} };
const DAILY_KIT = { magnet: 0, power: 0, floor: 0 } as const;

/** A real daily climb, played through the sim so the recorder writes a genuine tape. */
function climbToday(flings = 60) {
  const seed = clientDailySeed(todayKey());
  const game = new Game({ ...DAILY_KIT }, NO_EVENTS, { rules: "solo", seed, worldVersion: dailyWorld(todayKey(), new World(1, 0).version), chill: false, lineup: [], silent: true });
  const dt = 1 / 120;
  let n = 0, done = 0;
  for (let i = 0; i < 37; i++) { game.update(dt); n++; }          // a moment before the first fling, as a player would
  while (game.phase !== "dead" && done < flings && n < 40_000) {
    const c = game.climbers[0];
    if (c && c.state !== "lost" && (done === 0 || n % 90 === 0)) { game.launch(c, { x: (n % 180 ? 1 : -1) * 260, y: -640 }); done++; }
    game.update(dt); n++;
  }
  const tape = game.sealTape(true);
  assert.ok(tape, "the run produced a tape");
  return { tape: tape!, cm: game.heightCm };
}

test("the Worker's daily seed is the client's daily seed", () => {
  for (const day of ["2026-09-17", "2026-01-01", "2030-12-31"]) assert.equal(workerDailySeed(day), clientDailySeed(day));
});

test("a daily score with its tape is replayed and kept at the height the replay reaches", async () => {
  const e = env("enforce");
  const { playerId, token } = await seedPlayer(e);
  const { tape, cm } = climbToday();
  assert.ok(cm > 0);
  const res = await worker.fetch(post("/score", { playerId, token, name: "Kid", mode: "daily", cm, seconds: tape.seconds, tape }), e);
  const j = await res.json() as { ok: boolean; best: number; verified: boolean };
  assert.equal(res.status, 200);
  assert.equal(j.verified, true);
  assert.equal(j.best, cm);
  const row = await e.DB.prepare("SELECT cm FROM daily WHERE player_id = ?").bind(playerId).first<{ cm: number }>();
  assert.equal(row?.cm, cm);
  const log = await e.DB.prepare("SELECT claimed, replayed, verdict FROM tapes WHERE player_id = ?").bind(playerId).first<{ claimed: number; replayed: number; verdict: string }>();
  assert.equal(log?.claimed, cm); assert.equal(log?.replayed, cm); assert.equal(log?.verdict, "ok");
});

test("a claim above what the tape climbs to is refused in enforce mode and never lands", async () => {
  const e = env("enforce");
  const { playerId, token } = await seedPlayer(e);
  const { tape, cm } = climbToday();
  const res = await worker.fetch(post("/score", { playerId, token, name: "Kid", mode: "daily", cm: cm + 40, tape }), e);
  assert.equal(res.status, 422);
  const j = await res.json() as { ok: boolean; verified: boolean; reason: string };
  assert.equal(j.ok, false);
  assert.equal(j.reason, "claim above replay");
  const row = await e.DB.prepare("SELECT cm FROM daily WHERE player_id = ?").bind(playerId).first();
  assert.equal(row, null, "no row for a claim the replay does not confirm");
  const log = await e.DB.prepare("SELECT verdict, replayed FROM tapes WHERE player_id = ?").bind(playerId).first<{ verdict: string; replayed: number }>();
  assert.equal(log?.verdict, "claim above replay");
  assert.equal(log?.replayed, cm);
});

test("in shadow mode the same bad claim lands, but the verdict is on record for the owner", async () => {
  const e = env("shadow");
  const { playerId, token } = await seedPlayer(e);
  const { tape, cm } = climbToday();
  const res = await worker.fetch(post("/score", { playerId, token, name: "Kid", mode: "daily", cm: cm + 40, tape }), e);
  assert.equal(res.status, 200);
  const j = await res.json() as { verified: boolean; reason: string };
  assert.equal(j.verified, false);
  assert.equal(j.reason, "claim above replay");
  const log = await e.DB.prepare("SELECT verdict FROM tapes WHERE player_id = ?").bind(playerId).first<{ verdict: string }>();
  assert.equal(log?.verdict, "claim above replay");
});

test("a console fetch with a number and no tape is refused in enforce mode", async () => {
  const e = env("enforce");
  const { playerId, token } = await seedPlayer(e);
  const res = await worker.fetch(post("/score", { playerId, token, name: "Kid", mode: "daily", cm: 99999 }), e);
  assert.equal(res.status, 422);
  assert.equal(((await res.json()) as { reason: string }).reason, "no tape");
});

test("a tape from another day, with kit, or off the step grid is refused before any replay runs", async () => {
  const e = env("enforce");
  const { tape } = climbToday();
  const cases: [string, unknown][] = [
    ["wrong day", { ...tape, seed: clientDailySeed("2001-01-01") }],
    ["kit on a daily", { ...tape, kit: { magnet: 2, power: 0, floor: 0 } }],
    ["not a daily tape", { ...tape, daily: false }],
    ["event off the step grid", { ...tape, events: [{ ...tape.events[0], t: tape.events[0].t + 0.004 }, ...tape.events.slice(1)] }],
    ["too many events", { ...tape, events: Array.from({ length: 4001 }, (_, i) => ({ t: i / 120, k: "fling", id: 0, v: { x: 1, y: -1 } })) }],
  ];
  for (const [reason, bad] of cases) {
    const { playerId, token } = await seedPlayer(e);
    const res = await worker.fetch(post("/score", { playerId, token, name: "Kid", mode: "daily", cm: 10, tape: bad }), e);
    assert.equal(res.status, 422, reason);
    assert.equal(((await res.json()) as { reason: string }).reason, reason);
  }
});

// -------------------------------------------------------------------------------------------
// PII the first filter missed: email, international and digit-spaced numbers, bare handles.
// -------------------------------------------------------------------------------------------

test("chat redacts emails, international and digit-spaced numbers, and bare handles", async () => {
  const e = env();
  const { playerId, token } = await seedPlayer(e);
  const cases: [string, string][] = [
    ["email me kid99@gmail.com", "email me [redacted]"],
    ["kid99 at gmail dot com", "[redacted]"],
    ["+44 7911 123456", "[redacted]"],
    ["text me at 5 5 5 1 2 3 4 5 6 7", "text me at [redacted]"],
    ["@kid_99 on insta", "[redacted] on insta"],
    ["add me on discord Kid_99", "add me on [redacted]"],
  ];
  let last = 0;
  for (const [text, want] of cases) {
    // the per-player 3 s throttle: reset the last post's clock so each case posts
    if (last) await e.DB.prepare("UPDATE chat SET created_at = created_at - 10000 WHERE player_id = ?").bind(playerId).run();
    const res = await worker.fetch(post("/chat", { playerId, token, name: "Kid", text }), e);
    assert.equal(res.status, 200, text);
    const j = await res.json() as { message: { text: string } };
    assert.equal(j.message.text, want, text);
    last++;
  }
  const flags = await e.DB.prepare("SELECT COUNT(*) AS n FROM chat_reports WHERE kind = 'pii' AND target_id = ?").bind(playerId).first<{ n: number }>();
  assert.equal(flags?.n, cases.length, "every redaction went to the owner");
});

test("chat still leaves an age, a score, a plain platform mention and a handle-less word alone", async () => {
  const e = env();
  const { playerId, token } = await seedPlayer(e);
  for (const text of ["I'm 8 and I got 1234 cm", "discord is fun", "ig: coolkid", "on discord tonight?"]) {
    await e.DB.prepare("UPDATE chat SET created_at = created_at - 10000 WHERE player_id = ?").bind(playerId).run();
    const res = await worker.fetch(post("/chat", { playerId, token, name: "Kid", text }), e);
    const j = await res.json() as { message: { text: string } };
    assert.equal(j.message.text, text, text);
  }
});

// /score and /run are the player's own posts: a post about somebody else's profile is refused.
test("a score or run posted about another player's profile is refused", async () => {
  const e = env();
  const victim = await seedPlayer(e);
  for (const path of ["/score", "/run"]) {
    const forged = await worker.fetch(post(path, { playerId: victim.playerId, token: "not-the-token", name: "Hacked", mode: "solo", cm: 500 }), e);
    assert.equal(forged.status, 403, `${path} without the owner's token`);
    const own = await worker.fetch(post(path, { playerId: victim.playerId, token: victim.token, name: "Me", mode: "solo", cm: 500 }), e);
    assert.equal(own.status, 200, `${path} with the owner's token`);
  }
  const row = await e.DB.prepare("SELECT name FROM scores WHERE player_id = ? AND mode = 'solo'").bind(victim.playerId).first<{ name: string }>();
  assert.equal(row?.name, "Me");
  // a lower re-post cannot relabel a standing best either
  await worker.fetch(post("/score", { playerId: victim.playerId, token: victim.token, name: "Later", mode: "solo", cm: 100 }), e);
  const again = await e.DB.prepare("SELECT name, cm FROM scores WHERE player_id = ? AND mode = 'solo'").bind(victim.playerId).first<{ name: string; cm: number }>();
  assert.deepEqual([again?.name, again?.cm], ["Me", 500]);
});

// League seating is one statement: the newest bucket with a seat free, else a fresh one.
test("league buckets fill to thirty and then open the next", async () => {
  const e = env();
  const buckets = new Map<number, number>();
  for (let i = 0; i < 31; i++) {
    const p = await seedPlayer(e, "lg");
    const r = await worker.fetch(post("/run", { playerId: p.playerId, token: p.token, name: "Kid", mode: "solo", cm: 100 + i }), e);
    assert.equal(r.status, 200);
  }
  const rows = await e.DB.prepare("SELECT bucket, COUNT(*) AS n FROM league GROUP BY bucket").all<{ bucket: number; n: number }>();
  for (const r of rows.results ?? []) buckets.set(r.bucket, r.n);
  assert.deepEqual([...buckets.entries()].sort(), [[1, 30], [2, 1]]);
});

// The async race: a run's tape goes up under the player's token and comes back by id.
test("a shared run is kept by id and handed back; a forged post is refused", async () => {
  const e = env();
  const p = await seedPlayer(e);
  const tape = { v: 1, seed: 7, world: 27, kit: {}, chill: false, daily: false, cm: 1234, seconds: 61, events: [{ t: 0.5, id: 1, k: "fling", v: { x: 10, y: -400 } }] };
  const forged = await worker.fetch(post("/race", { playerId: p.playerId, token: "x".repeat(20), name: "Kid", tape }), e);
  assert.equal(forged.status, 403);
  const bad = await worker.fetch(post("/race", { playerId: p.playerId, token: p.token, name: "Kid", tape: { ...tape, events: [] } }), e);
  assert.equal(bad.status, 400);
  const ok = await worker.fetch(post("/race", { playerId: p.playerId, token: p.token, name: "Kid", tape }), e);
  assert.equal(ok.status, 200);
  const { id } = (await ok.json()) as { id: string };
  assert.match(id, /^[a-z0-9]{8}$/);
  const back = await worker.fetch(new Request(`https://x/race?id=${id}`), e);
  assert.equal(back.status, 200);
  const got = (await back.json()) as { name: string; cm: number; tape: typeof tape };
  assert.equal(got.name, "Kid"); assert.equal(got.cm, 1234); assert.deepEqual(got.tape, tape);
  const missing = await worker.fetch(new Request("https://x/race?id=nosuchrun"), e);
  assert.equal(missing.status, 404);
});

// The plausibility screen: physics bounds on a daily claim, checked on the request.
import { plausible, MAX_CM_PER_FLING } from "../worker/src/replay";
import { Game as SimGame } from "../src/game/game";
test("a claim the inputs could never have climbed is refused before any replay", () => {
  const levels = { magnet: 0, power: 0, floor: 0 };
  const events = { onPower: () => {}, onGameOver: () => {}, onCoins: () => {}, onGems: () => {} };
  const g = new SimGame(levels, events, { seed: 77, rules: "solo", silent: true });
  g.phase = "running";
  for (let i = 0; i < 8; i++) {
    const c = g.climbers[0];
    if (c.state === "stuck" || c.state === "linked") g.launch(c, { x: i % 2 ? 80 : -80, y: -600 });
    for (let k = 0; k < 90; k++) g.update(1 / 120);
  }
  const tape = g.sealTape(true)!;
  assert.equal(plausible(tape, g.heightCm), null, "a real run passes at its own height");
  assert.equal(plausible(tape, 50_000), "height per fling", "fifty metres on eight flings does not");
  const fast = { ...tape, events: tape.events.map((e) => e.k === "fling" ? { ...e, v: { x: 0, y: -5000 } } : e) };
  assert.equal(plausible(fast, g.heightCm), "fling beyond the slingshot");
  const longRun = { ...tape, events: Array.from({ length: 4000 }, (_, i) => ({ t: Math.round(i * 2 / 120 * 10000) / 10000, k: "fling" as const, id: 1, v: { x: 0, y: -500 } })), steps: 8000 };
  assert.equal(plausible(longRun, 4000 * MAX_CM_PER_FLING), "height per second", "sixty-seven seconds cannot climb that far however many flings");
  assert.equal(plausible({ ...tape, steps: 1 }, g.heightCm), "sealed before its last input");
});

// The live race room, with two fake seats and a replay that reads the tape's own number.
import { Match, type Message } from "../worker/src/match";
test("a live race starts on the second seat, relays inputs, and settles on replayed tapes", () => {
  const replay = (tape: unknown) => { const t = tape as { cm: number; bad?: boolean }; return t.bad ? { ok: false, cm: 0, reason: "wrong fridge" } : { ok: true, cm: t.cm }; };
  const m = new Match(replay, () => 0.5);
  const a: Message[] = [], b: Message[] = [], c: Message[] = [];
  m.join({ id: "A", name: "Ann", world: 27, send: (x) => a.push(x) });
  assert.deepEqual(a, [{ k: "wait", id: "A", others: [] }]);
  m.join({ id: "C", name: "Cat", world: 26, send: (x) => c.push(x) });
  assert.deepEqual(c, [{ k: "update" }], "another build is turned away");
  m.join({ id: "B", name: "Bob", world: 27, send: (x) => b.push(x) });
  assert.equal(a[1].k, "start"); assert.equal(b[0].k, "start");
  const sa = a[1] as Extract<Message, { k: "start" }>, sb = b[0] as Extract<Message, { k: "start" }>;
  assert.equal(sa.seed, sb.seed); assert.ok(sa.seed > 0); assert.deepEqual(sa.them, { id: "B", name: "Bob" });
  m.join({ id: "D", name: "Dan", world: 27, send: (x) => c.push(x) });
  assert.deepEqual(c[1], { k: "full" });
  m.input("A", { t: 0.5, k: "fling", id: 1, v: { x: 1, y: -2 } });
  assert.deepEqual(b[1], { k: "in", e: { t: 0.5, k: "fling", id: 1, v: { x: 1, y: -2 } }, from: "A" });
  assert.equal(a.length, 2, "an input never comes back to its sender");
  assert.equal(m.finish("A", { cm: 900 }, 950), true, "waits on the other tape");
  assert.deepEqual(b[2], { k: "ended", id: "A", cm: 950 });
  assert.equal(m.finish("B", { cm: 700 }, 600), false);
  const ra = a.at(-1) as Extract<Message, { k: "result" }>;
  assert.equal(ra.k, "result"); assert.equal(ra.winner, "A");
  // the claim never rises above the replay, and a claim below it stands
  assert.deepEqual(ra.rows.map((r) => [r.id, r.cm, r.verified]), [["A", 900, true], ["B", 600, true]]);
  assert.deepEqual(b.at(-1), ra);
});
test("a live race with one tape unverified, or one player gone, still settles", () => {
  const replay = (tape: unknown) => { const t = tape as { cm: number; bad?: boolean }; return t.bad ? { ok: false, cm: 0, reason: "wrong fridge" } : { ok: true, cm: t.cm }; };
  const m = new Match(replay, () => 0.1);
  const a: Message[] = [], b: Message[] = [];
  m.join({ id: "A", name: "Ann", world: 27, send: (x) => a.push(x) });
  m.join({ id: "B", name: "Bob", world: 27, send: (x) => b.push(x) });
  m.finish("A", { cm: 500, bad: true }, 500);
  m.leave("B");
  const r = a.at(-1) as Extract<Message, { k: "result" }>;
  assert.equal(r.k, "result"); assert.equal(r.winner, null, "nobody climbed anything the room believes");
  assert.deepEqual(r.rows.map((x) => [x.id, x.cm, x.verified, x.reason]), [["A", 0, false, "wrong fridge"], ["B", 0, false, "no tape"]]);
  // a seat left before the start is simply free again
  const n = new Match(replay); const c: Message[] = [];
  n.join({ id: "A", name: "Ann", world: 27, send: () => {} }); n.leave("A");
  n.join({ id: "B", name: "Bob", world: 27, send: (x) => c.push(x) });
  assert.deepEqual(c, [{ k: "wait", id: "B", others: [] }]);
});
test("a host who steps away before the start keeps the seat; the race starts when both are here", () => {
  const replay = () => ({ ok: true, cm: 1 });
  const m = new Match(replay, () => 0.4);
  const a: Message[] = [], b: Message[] = [];
  m.join({ id: "A", name: "Ann", world: 27, send: (x) => a.push(x) });
  m.away("A");
  // the room is put to sleep and comes back from what it kept
  const n = new Match(replay, () => 0.4);
  n.restore(m.lobby!);
  n.join({ id: "B", name: "Bob", world: 27, send: (x) => b.push(x) });
  assert.deepEqual(b, [{ k: "wait", id: "B", others: [{ id: "A", name: "Ann", present: false }] }], "the joiner is told who it waits on");
  assert.equal(n.started, false);
  n.join({ id: "A", name: "Ann", world: 27, send: (x) => a.push(x) });
  assert.equal(a.at(-1)?.k, "start"); assert.equal(b.at(-1)?.k, "start");
  assert.equal(n.lobby, null, "nothing to keep once the race is on");
  // a host who closes the lobby is named to the friend still waiting in it
  const q = new Match(replay); const c: Message[] = [];
  q.join({ id: "A", name: "Ann", world: 27, send: () => {} });
  q.join({ id: "B", name: "Bob", world: 27, send: (x) => c.push(x) });
  assert.equal(q.started, true);
  const r = new Match(replay); const d: Message[] = [];
  r.join({ id: "A", name: "Ann", world: 27, send: () => {} }); r.away("A");
  r.join({ id: "B", name: "Bob", world: 27, send: (x) => d.push(x) });
  r.leave("A");
  assert.deepEqual(d.slice(1), [{ k: "left", id: "A", name: "Ann" }, { k: "wait", id: "B", others: [] }]);
});
test("a race seats its players on opposite doors, replays each from theirs, and keeps a seat across the result", () => {
  const sides: number[] = [];
  const replay = (_t: unknown, _s: number, _w: number, side: 0 | 1) => { sides.push(side); return { ok: true, cm: 100 + side }; };
  const m = new Match(replay, () => 0.2);
  const a: Message[] = [], b: Message[] = [];
  m.join({ id: "A", name: "Ann", world: 27, send: (x) => a.push(x) });
  m.join({ id: "B", name: "Bob", world: 27, send: (x) => b.push(x) });
  assert.equal((a.at(-1) as Extract<Message, { k: "start" }>).side, 0);
  assert.equal((b.at(-1) as Extract<Message, { k: "start" }>).side, 1);
  m.finish("A", { cm: 1 }, 1); m.finish("B", { cm: 1 }, 1);
  assert.deepEqual(sides, [0, 1], "each tape replays from the door its seat started on");
  // the result panel sits open, the socket idles out and comes back: still a seat, not a watcher
  const a2: Message[] = [];
  m.join({ id: "A", name: "Ann", world: 27, send: (x) => a2.push(x) });
  assert.deepEqual(a2, [], "a seated player back at a settled room is not turned away");
  const c: Message[] = [];
  m.join({ id: "C", name: "Cat", world: 27, send: (x) => c.push(x) });
  assert.deepEqual(c, [{ k: "full" }], "a stranger at a settled room is");
  m.again("A"); m.again("B");
  assert.equal(a2.at(-1)?.k, "start", "and the rematch reaches the fresh socket");
  assert.equal((a2.at(-1) as Extract<Message, { k: "start" }>).side, 0);
});
test("a race already decided tells the leader so, again if need be, and again on a reconnect", () => {
  const m = new Match(() => ({ ok: true, cm: 1 }), () => 0.6);
  const a: Message[] = [], b: Message[] = [];
  m.join({ id: "A", name: "Ann", world: 27, send: (x) => a.push(x) });
  m.join({ id: "B", name: "Bob", world: 27, send: (x) => b.push(x) });
  m.progress("B", 300, 1000);
  m.finish("A", { cm: 397 }, 397);
  assert.deepEqual(b.at(-1), { k: "ended", id: "A", cm: 397 }, "the first word");
  m.progress("B", 380, 1500);
  assert.equal(b.length, 2, "below the finisher nothing more is said");
  m.progress("B", 549, 1600);
  assert.deepEqual(b.at(-1), { k: "ended", id: "A", cm: 397 }, "above it, the reminder");
  m.progress("B", 560, 1900);
  assert.equal(b.length, 3, "at most one a second");
  // the word was lost to a dropped socket: the fresh one hears it with its start, and gets
  // every input the other seat made so far, so the ghost can be built again whole
  m.input("A", { t: 0.5, k: "fling", id: 1, v: { x: 1, y: -2 } });
  const b2: Message[] = [];
  m.join({ id: "B", name: "Bob", world: 27, send: (x) => b2.push(x) });
  assert.deepEqual(b2.map((x) => x.k), ["start", "catchup", "ended"]);
  assert.deepEqual((b2[1] as Extract<Message, { k: "catchup" }>).events, [], "A's fling after A finished was not an input of the race");
  const w: Message[] = [];
  m.watch({ id: "W", send: (x) => w.push(x) });
  assert.deepEqual(w.map((x) => x.k), ["watching", "start", "catchup", "catchup"], "a late watcher gets both seats' inputs");
  const na = a.length;
  m.progress("A", 999, 5000);
  assert.equal(a.length, na, "a finished seat is never told about itself");
});

// Accounts: a Firebase ID token signed by a key the test made, verified against that key.
import { setJwksForTests } from "../worker/src/index";
import { verifyFirebaseIdToken } from "../worker/src/auth";
const b64u = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer);
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function firebaseKeys() {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const kid = "test-kid";
  const sign = async (claims: Record<string, unknown>) => {
    const head = b64u(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })), body = b64u(JSON.stringify(claims));
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(`${head}.${body}`));
    return `${head}.${body}.${b64u(sig)}`;
  };
  const jwks = async () => [{ kid, kty: "RSA", alg: "RS256", n: jwk.n!, e: jwk.e! }];
  return { sign, jwks };
}
const claimsFor = (uid: string, project = "mc-test", now = Math.floor(Date.now() / 1000)) => ({
  iss: `https://securetoken.google.com/${project}`, aud: project, sub: uid, user_id: uid, iat: now - 5, exp: now + 3600, auth_time: now - 5,
  email: `${uid}@example.com`, firebase: { sign_in_provider: "google.com" },
});

test("a Firebase ID token is verified on signature and claims alone", async () => {
  const { sign, jwks } = await firebaseKeys();
  const who = await verifyFirebaseIdToken(await sign(claimsFor("u1")), "mc-test", jwks);
  assert.deepEqual(who, { uid: "u1", email: "u1@example.com", provider: "google.com" });
  await assert.rejects(verifyFirebaseIdToken(await sign(claimsFor("u1", "other-project")), "mc-test", jwks), /another project/);
  await assert.rejects(verifyFirebaseIdToken(await sign({ ...claimsFor("u1"), exp: Math.floor(Date.now() / 1000) - 10 }), "mc-test", jwks), /expired/);
  const good = await sign(claimsFor("u1"));
  const tampered = good.slice(0, -4) + (good.endsWith("AAAA") ? "BBBB" : "AAAA");
  await assert.rejects(verifyFirebaseIdToken(tampered, "mc-test", jwks), /bad signature/);
  const other = await firebaseKeys();
  await assert.rejects(verifyFirebaseIdToken(await other.sign(claimsFor("u1")), "mc-test", jwks), /bad signature|unknown signing key/);
});

test("/auth ties a new account to the phone's profile and hands a known account's profile to a second phone", async () => {
  const { sign, jwks } = await firebaseKeys();
  setJwksForTests(jwks);
  try {
    const e = { ...env(), FIREBASE_PROJECT_ID: "mc-test" } as Env;
    const phoneA = await seedPlayer(e, "acc");
    const idToken = await sign(claimsFor("uid-42"));
    const forged = await worker.fetch(post("/auth", { idToken, playerId: phoneA.playerId, token: "not-the-token" }), e);
    assert.equal(forged.status, 403);
    const bad = await worker.fetch(post("/auth", { idToken: "nope", playerId: phoneA.playerId, token: phoneA.token }), e);
    assert.equal(bad.status, 401);
    const first = await worker.fetch(post("/auth", { idToken, playerId: phoneA.playerId, token: phoneA.token }), e);
    assert.equal(first.status, 200);
    const j1 = (await first.json()) as { adopted: boolean; playerId: string; uid: string };
    assert.deepEqual([j1.adopted, j1.playerId, j1.uid], [false, phoneA.playerId, "uid-42"]);
    // the same account from a second phone: that phone adopts phone A's profile
    const phoneB = await seedPlayer(e, "acc");
    const second = await worker.fetch(post("/auth", { idToken: await sign(claimsFor("uid-42")), playerId: phoneB.playerId, token: phoneB.token }), e);
    const j2 = (await second.json()) as { adopted: boolean; playerId: string; token: string };
    assert.deepEqual([j2.adopted, j2.playerId, j2.token], [true, phoneA.playerId, phoneA.token]);
    // and off when the project is not configured
    const off = await worker.fetch(post("/auth", { idToken, playerId: phoneA.playerId, token: phoneA.token }), env());
    assert.equal(off.status, 503);
  } finally { setJwksForTests(undefined); }
});

// With the verifier deployed, a daily claim lands at once and the replay runs afterwards:
// the row is cut to the replayed height when the claim stood above it.
import { Verifier } from "../worker/src/verify";
test("a daily post answers at once and the verifier cuts an inflated claim afterwards", async () => {
  const base = env("enforce");
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => { pending.push(p); }, passThroughOnException: () => {} } as unknown as ExecutionContext;
  const e = { ...base, VERIFY: {
    idFromName: (n: string) => n,
    get: () => ({ fetch: (_u: string, init: RequestInit) => new Verifier({} as DurableObjectState, e).fetch(new Request("https://verify/", init)) }),
  } } as unknown as Env;
  const { playerId, token } = await seedPlayer(e);
  const { tape, cm } = climbToday();
  const res = await worker.fetch(post("/score", { playerId, token, name: "Kid", mode: "daily", cm: cm + 40, tape }), e, ctx);
  assert.equal(res.status, 200);
  const j = await res.json() as { verified: string; best: number };
  assert.equal(j.verified, "pending"); assert.equal(j.best, cm + 40);
  const before = await e.DB.prepare("SELECT cm FROM daily WHERE player_id = ?").bind(playerId).first<{ cm: number }>();
  assert.equal(before?.cm, cm + 40, "the claim stands until the replay says otherwise");
  assert.equal(pending.length, 1, "the replay was handed off");
  await Promise.all(pending);
  const after = await e.DB.prepare("SELECT cm FROM daily WHERE player_id = ?").bind(playerId).first<{ cm: number }>();
  assert.equal(after?.cm, cm, "cut to what the tape climbs to");
  const log = await e.DB.prepare("SELECT verdict, replayed FROM tapes WHERE player_id = ?").bind(playerId).first<{ verdict: string; replayed: number }>();
  assert.deepEqual([log?.verdict, log?.replayed], ["ok", cm]);
  // a tape the structural checks refuse never waits on the object
  const p2 = await seedPlayer(e);
  const bad = await worker.fetch(post("/score", { playerId: p2.playerId, token: p2.token, name: "Kid", mode: "daily", cm: 10, tape: { ...tape, chill: true } }), e, ctx);
  assert.equal(bad.status, 422);
});


test("a race can be run again from the same room, and a third phone can watch it", () => {
  const replay = (tape: unknown) => ({ ok: true, cm: (tape as { cm: number }).cm });
  const m = new Match(replay, () => 0.3);
  const a: Message[] = [], b: Message[] = [], w: Message[] = [];
  m.join({ id: "A", name: "Ann", world: 27, look: { creature: "toy", pattern: "classic" }, send: (x) => a.push(x) });
  m.join({ id: "B", name: "Bob", world: 27, look: { creature: "dino", pattern: "lemon" }, send: (x) => b.push(x) });
  m.watch({ id: "W", send: (x) => w.push(x) });
  assert.equal(w[0].k, "watching"); assert.equal(w[1].k, "start");
  const ws = w[1] as Extract<Message, { k: "start" }>;
  assert.deepEqual(ws.players?.map((p) => [p.id, p.look?.creature]), [["A", "toy"], ["B", "dino"]], "a watcher gets both seats, dressed");
  m.input("B", { t: 1, k: "move", id: 1, to: { x: 5, y: 5 } });
  assert.deepEqual(w.at(-1), { k: "in", e: { t: 1, k: "move", id: 1, to: { x: 5, y: 5 } }, from: "B" }, "a watcher sees every input");
  m.input("W", { t: 2, k: "move", id: 1, to: { x: 0, y: 0 } });
  assert.equal(a.filter((x) => x.k === "in").length, 1, "a watcher's inputs go nowhere");
  m.finish("A", { cm: 800 }, 800); m.finish("B", { cm: 900 }, 900);
  assert.equal((w.at(-1) as Extract<Message, { k: "result" }>).winner, "B");
  const firstSeed = m.seed;
  m.again("A");
  assert.deepEqual(b.at(-1), { k: "again", id: "A" }, "the other player hears the ask");
  assert.equal(m.settled, true, "one ask is not a rematch");
  m.again("B");
  assert.equal(m.settled, false); assert.notEqual(m.seed, firstSeed, "a fresh fridge");
  assert.equal(a.at(-1)!.k, "start"); assert.equal(b.at(-1)!.k, "start"); assert.equal(w.at(-1)!.k, "start", "the watcher comes along");
  m.finish("A", { cm: 100 }, 100); m.finish("B", { cm: 50 }, 50);
  assert.equal((a.at(-1) as Extract<Message, { k: "result" }>).winner, "A", "the second race settles on its own tapes");
});

import { parseCode, cardSvg } from "../worker/src/card";
test("a daily share card carries its day, rank and streak", () => {
  const c = parseCode("daily.8287.MLocke");
  assert.ok(c && c.mode === "daily" && c.cm === 8287);
  const svg = cardSvg({ ...c!, verified: true, day: "2026-09-18", rank: 3, streak: 2 });
  assert.match(svg, /DAILY · SEP 18/); assert.match(svg, /#3 that day/); assert.match(svg, /2 days running/);
  assert.match(cardSvg({ ...c!, verified: true, day: "2026-09-18" }), /Same fridge for everyone/);
});

// Web Push: the VAPID token verifies against the public half, and a payload encrypted to a
// subscription decrypts with that subscription's keys, the way a browser would.
import { vapidJwt, encryptPayload } from "../worker/src/push";
import { dueNotices } from "../worker/src/notices";
test("a VAPID token verifies and an aes128gcm payload decrypts", async () => {
  const b64u = (b: ArrayBuffer | Uint8Array) => Buffer.from(b as ArrayBuffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const fromB64u = (s: string) => new Uint8Array(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
  const vapid = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwt = await vapidJwt(await crypto.subtle.exportKey("jwk", vapid.privateKey), "https://push.example", "mailto:x@y.z");
  const [h, b, sig] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), { typ: "JWT", alg: "ES256" });
  assert.equal(JSON.parse(Buffer.from(b, "base64url").toString()).aud, "https://push.example");
  assert.ok(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, vapid.publicKey, fromB64u(sig), new TextEncoder().encode(`${h}.${b}`)));
  // the browser's side of a subscription
  const ua = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
  const body = await encryptPayload({ endpoint: "https://push.example/x", p256dh: b64u(uaPublic), auth: b64u(authSecret) }, JSON.stringify({ title: "hi" }));
  const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0), idlen = body[20], asPublic = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen);
  assert.equal(rs, 4096); assert.equal(idlen, 65);
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, ua.privateKey, 256));
  const enc = new TextEncoder();
  const cat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let a = 0; for (const x of p) { o.set(x, a); a += x.length; } return o; };
  const hk = async (s: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) => new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: s, info }, await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), n * 8));
  const ikm = await hk(authSecret, shared, cat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hk(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16), nonce = await hk(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]), cipher));
  assert.equal(plain[plain.length - 1], 2, "the last-record delimiter");
  assert.deepEqual(JSON.parse(new TextDecoder().decode(plain.slice(0, -1))), { title: "hi" });
});

test("the reminders fall on the Central hours they are meant for", () => {
  // 2026-09-18 is a Friday; 6 pm CDT is 23:00Z
  assert.deepEqual(dueNotices(Date.UTC(2026, 8, 18, 23, 5)), [{ kind: "daily", key: "2026-09-18" }]);
  assert.deepEqual(dueNotices(Date.UTC(2026, 8, 18, 22, 5)), []);
  // Monday 2026-09-21, 9 am CDT is 14:00Z: the league
  assert.deepEqual(dueNotices(Date.UTC(2026, 8, 21, 14, 0)), [{ kind: "league", key: "2026-W39" }]);
  // the 1st at 9 am: the month, and in October a Thursday, so no league
  assert.deepEqual(dueNotices(Date.UTC(2026, 9, 1, 14, 0)), [{ kind: "month", key: "2026-10" }]);
});
