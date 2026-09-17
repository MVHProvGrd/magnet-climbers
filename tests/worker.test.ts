import assert from "node:assert/strict";
import { test } from "node:test";
import worker, { type Env, ensureReports } from "../worker/src/index";
import { makeFakeDB } from "./worker-db";
import { Game } from "../src/game/game";
import { World } from "../src/game/world";
import { dailySeed as workerDailySeed } from "../worker/src/replay";
import { dailySeed as clientDailySeed, todayKey } from "../src/game/leaderboard";

function env(mode: "shadow" | "enforce" = "shadow"): Env {
  const { DB } = makeFakeDB();
  return { DB: DB as never, ALLOWED_ORIGINS: "http://localhost", TAPE_MODE: mode };
}

let nextPlayer = 0;
/** A fresh player with a cloud save already on file, the way every write route expects. */
async function seedPlayer(e: Env, prefix = "p"): Promise<{ playerId: string; token: string }> {
  const playerId = `${prefix}-${++nextPlayer}`;
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
  const game = new Game({ ...DAILY_KIT }, NO_EVENTS, { rules: "solo", seed, worldVersion: new World(1, 0).version, chill: false, lineup: [], silent: true });
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
  const res = await worker.fetch(post("/score", { playerId, token, name: "Kid", mode: "daily", cm: cm + 5000, tape }), e);
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
  const res = await worker.fetch(post("/score", { playerId, token, name: "Kid", mode: "daily", cm: cm + 5000, tape }), e);
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
