import assert from "node:assert/strict";
import { test } from "node:test";
import worker, { type Env, ensureReports } from "../worker/src/index";
import { makeFakeDB } from "./worker-db";

function env(): Env {
  const { DB } = makeFakeDB();
  return { DB: DB as never, ALLOWED_ORIGINS: "http://localhost" };
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
  const { playerId } = await seedPlayer(e);
  const res = await worker.fetch(post("/score", { playerId, name: "fuuuck", mode: "solo", cm: 100 }), e);
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
