/**
 * Magnet Climbers leaderboard API.
 *   GET  /top?mode=crew|solo|lifetime&limit=25 → [{ name, cm, player_id, created_at }]
 *   GET  /rank?mode=crew&player=<id>        → { rank, cm } or { rank: null }
 *   POST /score  { playerId, name, mode, cm, seconds? } → { ok, best }   seconds = run duration of that climb
 *   POST /run    { playerId, name?, mode, cm } → { ok }   adds to the global and the player's lifetime totals
 *   POST /rename { playerId, name }           → { ok, name }  renames every board row for that player
 *   POST /save   { playerId, token, blob, rev } → { ok, rev } | 409 { rev, blob }   cloud save (token = per-player secret)
 *   GET  /save?player=&token=                  → { blob, rev } | 404
 *   POST /link   { playerId, token }            → { code, expiresAt }   6-char code, 10 minutes
 *   POST /claim  { code }                       → { playerId, token, blob, rev }   adopt that player on this device
 *   POST /merge  { fromId, fromToken, toId, toToken } → { ok }  fold an old device profile into the linked one
 *   GET  /stats                                → { total_cm, runs, players }
 *   GET  /admin                                → owner panel (ADMIN_KEY secret); JSON API under /admin/api/*
 *   GET  /chat?after=<id>                      → { messages: [{ id, name, text, player_id, created_at, avatar }], online }
 *   GET  /chat?before=<id>&limit=<n>           → { messages, more }   older page, for scrolling back through the log
 *   POST /chat   { playerId, token, name, text, avatar? } → { ok, message } | 429 (3 s per player) | 403 (muted)
 *   POST /chat/report { playerId, token, kind: "block"|"report", targetId, messageId? } → { ok }   shown on the admin panel
 *   GET  /c/<mode>.<cm>.<name>[/<playerId>][.png] → challenge share page (Open Graph) / score card PNG; the
 *        height is checked against that player's scoreboard best, else the card says "unverified"
 *
 * Trust model: honour system with sanity caps. Runs are seeded and deterministic,
 * so a later version can submit the input log and have the server replay it.
 */
import { handleShare, type Challenge } from "./card";
import { handleAdmin } from "./admin";
import { weekKey } from "./week";
import { censorChat, nameHasProfanity } from "../../src/game/profanity";

/** Server-side mirror of the client name filter — same word list, same leetspeak/Unicode/
 *  repeat normalization, kept in one place (src/game/profanity.ts) so the two never drift. */
const nameIsProfane = nameHasProfanity;

// Formatted phone numbers (555-123-4567, 555.123.4567, (555) 123-4567) and bare 10/11-digit
// runs, which are effectively never anything else in a chat message — a climb height tops
// out at 6 digits (MAX_CM) and nobody spells out a 10-digit age or score.
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b|\b\d{10,11}\b/g;
// House-number + street-name + suffix, e.g. "123 Main St" / "45 Oak Avenue".
const ADDRESS_RE = /\b\d{1,5}\s+[a-z]+(?:\s+[a-z]+){0,2}\s+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|way|pl|place|cir|circle|hwy|highway)\b\.?/gi;
// A messaging-app name followed by a handle ("my snap is john.doe99", "discord: Kid_99"), or
// a Discord-style "name#1234" tag on its own. The handle must contain a digit or a joining
// character (a plain word after "is" — "discord is fun" — is left alone).
const HANDLE_RE = /\b(?:snap(?:chat)?|insta(?:gram)?|ig|discord|kik|tiktok|whatsapp|telegram|skype|facebook)\b(?:\s*(?:is|:|=|@)\s*)([a-z0-9](?:[a-z0-9._-]{1,22}[a-z0-9])?)/gi;
const TAG_RE = /\b[a-z0-9_]{2,20}#\d{3,6}\b/gi;

/** Phone numbers, street addresses and social handles, masked out before anything else runs.
 *  Deliberately narrow (formatted numbers, "number street suffix", "platform: handle") so an
 *  age ("I'm 8"), a score ("1234 cm") or a plain sentence ("level 100") never gets touched. */
function maskPII(text: string): { clean: string; hit: boolean } {
  let hit = false;
  let out = text.replace(PHONE_RE, () => { hit = true; return "[redacted]"; });
  out = out.replace(ADDRESS_RE, () => { hit = true; return "[redacted]"; });
  out = out.replace(TAG_RE, () => { hit = true; return "[redacted]"; });
  out = out.replace(HANDLE_RE, (full, handle: string) => {
    if (!/[0-9._-]/.test(handle)) return full; // "discord is fun" — no real handle here
    hit = true;
    return "[redacted]";
  });
  return { clean: out, hit };
}

/** Chat text filter: PII is redacted, profane words become stars, links are dropped.
 *  Whole-message rejection is for names only. */
function cleanChat(text: string): { clean: string; censored: boolean; pii: boolean } {
  const noLinks = text.replace(/https?:\/\/\S+|www\.\S+|\S+\.(com|net|org|io|gg|xyz)\b\S*/gi, "[link]");
  const { clean: noPII, hit: pii } = maskPII(noLinks);
  const { clean, censored } = censorChat(noPII);
  return { clean, censored, pii };
}

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  /** owner key for /admin; set with `npx wrangler secret put ADMIN_KEY` */
  ADMIN_KEY?: string;
}

const MAX_CM = 200_000;
/** A lifetime is many runs deep, so it is capped far above a single climb rather than at it. */
const MAX_LIFETIME_CM = 2_000_000_000;
const NAME_RE = /[^\p{L}\p{N} _.\-!?]/gu;
/** Chat rows kept before the oldest are pruned. Deep enough that scrolling back has somewhere to go. */
const CHAT_HISTORY = 5000;

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  const ok = allowed.includes(origin) || origin.endsWith(".magnetclimbers.com");
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  };
}

/** How many times each player has had a word starred out of their chat. Created on demand. */
let censorsReady = false;
export async function ensureCensors(env: Env): Promise<void> {
  if (censorsReady) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS chat_censors (
    player_id TEXT PRIMARY KEY,
    n INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`).run().catch(() => {});
  censorsReady = true;
}
/** Strikes before a player's own words start going to the owner for review. */
const CENSOR_REVIEW_AT = 3;

/** Board rows the owner has cleared, so a device does not put its old best straight back.
 *  Created on demand, like the reports table, so nothing has to be migrated by hand. */
let resetsReady = false;
export async function ensureScoreResets(env: Env): Promise<void> {
  if (resetsReady) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS score_resets (
    player_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    at INTEGER NOT NULL,
    cm INTEGER,
    PRIMARY KEY (player_id, mode)
  )`).run().catch(() => {});
  // the column arrived after the table; D1 tolerates the failed ALTER when it is already there
  await env.DB.prepare("ALTER TABLE score_resets ADD COLUMN cm INTEGER").run().catch(() => {});
  resetsReady = true;
}

/** Blocks and reports from players. Created on demand so no migration has to be run by hand. */
let reportsReady = false;
export async function ensureReports(env: Env): Promise<void> {
  if (reportsReady) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS chat_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_name TEXT NOT NULL,
    reporter_id TEXT NOT NULL,
    message_id INTEGER,
    text TEXT,
    created_at INTEGER NOT NULL
  )`).run().catch(() => {});
  // one row per reporter, target and message: tapping report twice is not two reports
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS chat_reports_once ON chat_reports(kind, reporter_id, target_id, IFNULL(message_id, 0))").run().catch(() => {});
  reportsReady = true;
}

/** Per-IP request counters for the write routes. Created on demand, like the other tables. */
let rateLimitsReady = false;
async function ensureRateLimits(env: Env): Promise<void> {
  if (rateLimitsReady) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT NOT NULL,
    bucket INTEGER NOT NULL,
    n INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (key, bucket)
  )`).run().catch(() => {});
  rateLimitsReady = true;
}

/** Fixed-window per-key limiter backed by D1, so the count holds across Worker instances
 *  instead of living in memory (which a Worker cannot rely on between requests). A key stays
 *  over its limit for the rest of the window it tripped in, which is deliberately a little
 *  stricter than a sliding window and much simpler. Returns true when `key` is over `limit`
 *  requests in the current `windowMs` window. */
async function rateLimited(env: Env, key: string, limit: number, windowMs: number): Promise<boolean> {
  await ensureRateLimits(env);
  const bucket = Math.floor(Date.now() / windowMs);
  await env.DB.prepare(
    "INSERT INTO rate_limits (key, bucket, n) VALUES (?, ?, 1) ON CONFLICT(key, bucket) DO UPDATE SET n = rate_limits.n + 1",
  ).bind(key, bucket).run().catch(() => {});
  const row = await env.DB.prepare("SELECT n FROM rate_limits WHERE key = ? AND bucket = ?").bind(key, bucket).first<{ n: number }>().catch(() => null);
  // occasional sweep so old buckets don't sit in the table forever; cheap enough to run inline
  if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM rate_limits WHERE bucket < ?").bind(bucket - 8).run().catch(() => {});
  return (row?.n ?? 0) > limit;
}

/** Cloudflare's canonical client IP header; falls back to a shared bucket if it is ever
 *  missing (local `wrangler dev`, tests), which just makes the limit apply to everyone at
 *  once rather than not applying at all. */
const clientIp = (req: Request) => req.headers.get("CF-Connecting-IP") ?? "unknown";

const json = (data: unknown, headers: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

const validMode = (m: unknown): m is "crew" | "solo" => m === "crew" || m === "solo";

/**
 * The daily climb: one fridge for everybody, one scored attempt, a fresh board at UTC midnight.
 * The day is decided here, never by the client -- otherwise a player could pick the day whose
 * board they like. The client derives the same seed from the same date string.
 */
const dayKey = (at = Date.now()) => new Date(at).toISOString().slice(0, 10);

/**
 * The weekly league. Every finished run adds its metres to your week; players sit in buckets of
 * about thirty, and at the end of a week the top ten of a bucket go up a tier and the bottom ten
 * go down. The global board is unwinnable for all but ten people; a bucket is a board anybody can
 * lead, which is the whole point.
 *
 * There is no cron job. A player is placed the first time they climb in a new week, and their new
 * tier is worked out from where they finished the week before, so the league keeps itself.
 */
export const TIERS = ["Paper", "Plastic", "Steel", "Chrome", "Gold"] as const;
const BUCKET_SIZE = 30;
const PROMOTE = 10;
const RELEGATE = 10;
let leagueReady = false;
async function ensureLeague(env: Env): Promise<void> {
  if (leagueReady) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS league (
    player_id TEXT NOT NULL,
    week TEXT NOT NULL,
    tier INTEGER NOT NULL,
    bucket INTEGER NOT NULL,
    name TEXT NOT NULL,
    cm INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, week)
  )`).run().catch(() => {});
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS league_bucket ON league (week, tier, bucket, cm DESC)").run().catch(() => {});
  leagueReady = true;
}

/** Where a player sits this week, placing them (and settling last week) the first time they climb. */
async function placeInLeague(env: Env, playerId: string, name: string): Promise<{ week: string; tier: number; bucket: number }> {
  await ensureLeague(env);
  const week = weekKey();
  const mine = await env.DB.prepare("SELECT tier, bucket FROM league WHERE player_id = ? AND week = ?")
    .bind(playerId, week).first<{ tier: number; bucket: number }>();
  if (mine) return { week, tier: mine.tier, bucket: mine.bucket };

  // last week decides this week's tier: the top of a bucket goes up, the bottom goes down
  const last = await env.DB.prepare("SELECT week, tier, bucket, cm FROM league WHERE player_id = ? AND week < ? ORDER BY week DESC LIMIT 1")
    .bind(playerId, week).first<{ week: string; tier: number; bucket: number; cm: number }>();
  let tier = last?.tier ?? 0;
  if (last) {
    const above = await env.DB.prepare("SELECT COUNT(*) AS n FROM league WHERE week = ? AND tier = ? AND bucket = ? AND cm > ?")
      .bind(last.week, last.tier, last.bucket, last.cm).first<{ n: number }>();
    const size = await env.DB.prepare("SELECT COUNT(*) AS n FROM league WHERE week = ? AND tier = ? AND bucket = ?")
      .bind(last.week, last.tier, last.bucket).first<{ n: number }>();
    const rank = (above?.n ?? 0) + 1, members = size?.n ?? 1;
    if (rank <= PROMOTE) tier = Math.min(TIERS.length - 1, tier + 1);
    else if (members >= PROMOTE + RELEGATE && rank > members - RELEGATE) tier = Math.max(0, tier - 1);
  }
  // the newest bucket of that tier, or a fresh one when it is full
  const open = await env.DB.prepare(
    "SELECT bucket, COUNT(*) AS n FROM league WHERE week = ? AND tier = ? GROUP BY bucket ORDER BY bucket DESC LIMIT 1",
  ).bind(week, tier).first<{ bucket: number; n: number }>();
  const bucket = !open ? 1 : open.n >= BUCKET_SIZE ? open.bucket + 1 : open.bucket;
  await env.DB.prepare("INSERT OR IGNORE INTO league (player_id, week, tier, bucket, name, cm, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?)")
    .bind(playerId, week, tier, bucket, name, Date.now()).run();
  return { week, tier, bucket };
}

let dailyReady = false;
async function ensureDaily(env: Env): Promise<void> {
  if (dailyReady) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS daily (
    player_id TEXT NOT NULL,
    day TEXT NOT NULL,
    name TEXT NOT NULL,
    cm INTEGER NOT NULL,
    seconds INTEGER,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, day)
  )`).run().catch(() => {});
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS daily_board ON daily (day, cm DESC)").run().catch(() => {});
  dailyReady = true;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    const admin = await handleAdmin(req, url, env, h);
    if (admin) return admin;
    if (req.method === "GET" && (url.pathname.startsWith("/c/") || url.hostname.startsWith("share."))) {
      const share = await handleShare(req, url, (c: Challenge) => nameIsProfane(c.name), async (c, playerId) => {
        if (!playerId) return { ok: false };
        const row = await env.DB.prepare("SELECT name, cm FROM scores WHERE player_id = ? AND mode = ?").bind(playerId, c.mode).first<{ name: string; cm: number }>();
        return row && row.cm >= c.cm ? { ok: true, name: row.name } : { ok: false };
      });
      if (share) return share;
    }

    if (req.method === "GET" && url.pathname === "/top") {
      const mode = url.searchParams.get("mode") ?? "crew";
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
      if (mode === "lifetime") {
        const rows = await env.DB.prepare(
          "SELECT name, cm, player_id, updated_at AS created_at FROM lifetime WHERE player_id NOT LIKE 'smoke-%' ORDER BY cm DESC, updated_at ASC LIMIT ?",
        ).bind(limit).all();
        return json(rows.results, h);
      }
      if (mode === "coins") {
        const rows = await env.DB.prepare(
          "SELECT name, coins AS cm, player_id, updated_at AS created_at FROM wallet WHERE player_id NOT LIKE 'smoke-%' AND coins > 0 ORDER BY coins DESC, updated_at ASC LIMIT ?",
        ).bind(limit).all();
        return json(rows.results, h);
      }
      if (mode === "daily") {
        await ensureDaily(env);
        const rows = await env.DB.prepare(
          "SELECT name, cm, player_id, created_at, seconds FROM daily WHERE day = ? AND player_id NOT LIKE 'smoke-%' ORDER BY cm DESC, created_at ASC LIMIT ?",
        ).bind(dayKey(), limit).all();
        return json(rows.results, h);
      }
      if (!validMode(mode)) return json({ error: "bad mode" }, h, 400);
      // `seconds` arrived after launch; until the column exists the board still answers
      const rows = await env.DB.prepare(
        "SELECT name, cm, player_id, created_at, seconds FROM scores WHERE mode = ? AND player_id NOT LIKE 'smoke-%' ORDER BY cm DESC, created_at ASC LIMIT ?",
      ).bind(mode, limit).all().catch(() => env.DB.prepare(
        "SELECT name, cm, player_id, created_at FROM scores WHERE mode = ? AND player_id NOT LIKE 'smoke-%' ORDER BY cm DESC, created_at ASC LIMIT ?",
      ).bind(mode, limit).all());
      return json(rows.results, h);
    }

    if (req.method === "GET" && url.pathname === "/rank") {
      const mode = url.searchParams.get("mode") ?? "crew";
      const player = url.searchParams.get("player") ?? "";
      if (mode === "lifetime" && player) {
        const me = await env.DB.prepare("SELECT cm FROM lifetime WHERE player_id = ?").bind(player).first<{ cm: number }>();
        if (!me) return json({ rank: null }, h);
        const above = await env.DB.prepare("SELECT COUNT(*) AS n FROM lifetime WHERE cm > ? AND player_id NOT LIKE 'smoke-%'").bind(me.cm).first<{ n: number }>();
        return json({ rank: (above?.n ?? 0) + 1, cm: me.cm }, h);
      }
      if (validMode(mode) && player) {
        await ensureScoreResets(env);
        const cleared = await env.DB.prepare("SELECT at FROM score_resets WHERE player_id = ? AND mode = ?")
          .bind(player, mode).first<{ at: number }>().catch(() => null);
        if (cleared?.at) {
          const mine = await env.DB.prepare("SELECT cm FROM scores WHERE player_id = ? AND mode = ?").bind(player, mode).first<{ cm: number }>();
          if (!mine) return json({ rank: null, resetAt: cleared.at }, h);
        }
      }
      if (mode === "daily" && player) {
        await ensureDaily(env);
        const day = dayKey();
        const me = await env.DB.prepare("SELECT cm FROM daily WHERE player_id = ? AND day = ?").bind(player, day).first<{ cm: number }>();
        if (!me) return json({ rank: null, day }, h);
        const above = await env.DB.prepare("SELECT COUNT(*) AS n FROM daily WHERE day = ? AND cm > ? AND player_id NOT LIKE 'smoke-%'").bind(day, me.cm).first<{ n: number }>();
        return json({ rank: (above?.n ?? 0) + 1, cm: me.cm, day }, h);
      }
      if (mode === "coins" && player) {
        const me = await env.DB.prepare("SELECT coins FROM wallet WHERE player_id = ?").bind(player).first<{ coins: number }>();
        if (!me) return json({ rank: null }, h);
        const above = await env.DB.prepare("SELECT COUNT(*) AS n FROM wallet WHERE coins > ? AND player_id NOT LIKE 'smoke-%'").bind(me.coins).first<{ n: number }>();
        return json({ rank: (above?.n ?? 0) + 1, cm: me.coins }, h);
      }
      if (!validMode(mode) || !player) return json({ error: "bad request" }, h, 400);
      const me = await env.DB.prepare("SELECT cm FROM scores WHERE mode = ? AND player_id = ?").bind(mode, player).first<{ cm: number }>();
      if (!me) return json({ rank: null }, h);
      const above = await env.DB.prepare("SELECT COUNT(*) AS n FROM scores WHERE mode = ? AND cm > ? AND player_id NOT LIKE 'smoke-%'").bind(mode, me.cm).first<{ n: number }>();
      return json({ rank: (above?.n ?? 0) + 1, cm: me.cm }, h);
    }

    if (req.method === "POST" && url.pathname === "/score") {
      if (await rateLimited(env, `score:${clientIp(req)}`, 30, 60_000)) return json({ error: "slow down" }, h, 429);
      let body: { playerId?: unknown; name?: unknown; mode?: unknown; cm?: unknown; seconds?: unknown; at?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const playerId = String(body.playerId ?? "").slice(0, 64);
      let name = String(body.name ?? "").replace(NAME_RE, "").trim().slice(0, 12) || "climber";
      if (nameIsProfane(name)) name = "climber";
      const cm = Math.floor(Number(body.cm));
      const secs = Number.isFinite(Number(body.seconds)) && Number(body.seconds) > 0 ? Math.min(86400, Math.round(Number(body.seconds))) : null;
      if (!playerId || !Number.isFinite(cm) || cm <= 0 || cm > MAX_CM) return json({ error: "bad score" }, h, 400);
      // The daily climb is one attempt on one shared fridge: the first score of the day stands,
      // whatever a later one says, and the day is this server's, not the caller's.
      if (body.mode === "daily") {
        await ensureDaily(env);
        const day = dayKey();
        const had = await env.DB.prepare("SELECT cm FROM daily WHERE player_id = ? AND day = ?").bind(playerId, day).first<{ cm: number }>();
        if (had) return json({ ok: true, best: had.cm, day, taken: true }, h);
        await env.DB.prepare("INSERT INTO daily (player_id, day, name, cm, seconds, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(playerId, day, name, cm, secs, Date.now()).run();
        return json({ ok: true, best: cm, day }, h);
      }
      if (!validMode(body.mode)) return json({ error: "bad score" }, h, 400);
      const now = Date.now();
      // A score the owner cleared does not come back. An updated client knows this already -
      // it drops the best when /rank reports the clear - but a phone still running the old
      // bundle keeps re-posting, so the Worker refuses it here too: same climb or smaller,
      // and nothing to show it was climbed after the clear.
      await ensureScoreResets(env);
      const wiped = await env.DB.prepare("SELECT at, cm FROM score_resets WHERE player_id = ? AND mode = ?")
        .bind(playerId, body.mode).first<{ at: number; cm: number | null }>().catch(() => null);
      const when = Math.floor(Number(body.at));
      const climbedSince = Number.isFinite(when) && when > (wiped?.at ?? 0);
      if (wiped && !climbedSince && cm <= (wiped.cm ?? 0)) return json({ ok: true, best: 0, ignored: "cleared" }, h);
      // A device re-posting a best it set earlier says when it set it, so a healed row keeps
      // the day the climb happened instead of claiming it was set the moment the app opened.
      const claimed = Math.floor(Number(body.at));
      const at = Number.isFinite(claimed) && claimed > 1700000000000 && claimed <= now ? claimed : now;
      // keep only the player's best per mode; the name updates every submit
      const upsert = (withSeconds: boolean) => env.DB.prepare(withSeconds
        ? `INSERT INTO scores (player_id, name, mode, cm, created_at, seconds) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(player_id, mode) DO UPDATE SET
             name = excluded.name,
             cm = MAX(scores.cm, excluded.cm),
             seconds = CASE WHEN excluded.cm > scores.cm THEN excluded.seconds ELSE scores.seconds END,
             created_at = CASE WHEN excluded.cm > scores.cm THEN excluded.created_at ELSE scores.created_at END`
        : `INSERT INTO scores (player_id, name, mode, cm, created_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(player_id, mode) DO UPDATE SET
             name = excluded.name,
             cm = MAX(scores.cm, excluded.cm),
             created_at = CASE WHEN excluded.cm > scores.cm THEN excluded.created_at ELSE scores.created_at END`);
      // add the column on the fly if it is missing (D1 tolerates a failed ALTER), then write
      await upsert(true).bind(playerId, name, body.mode, cm, at, secs).run().catch(async () => {
        await env.DB.prepare("ALTER TABLE scores ADD COLUMN seconds INTEGER").run().catch(() => {});
        await upsert(true).bind(playerId, name, body.mode, cm, at, secs).run().catch(() => upsert(false).bind(playerId, name, body.mode, cm, at).run());
      });
      const best = await env.DB.prepare("SELECT cm FROM scores WHERE mode = ? AND player_id = ?").bind(body.mode, playerId).first<{ cm: number }>();
      return json({ ok: true, best: best?.cm ?? cm }, h);
    }

    if (req.method === "GET" && url.pathname === "/league") {
      const player = url.searchParams.get("player") ?? "";
      if (!player) return json({ error: "bad request" }, h, 400);
      await ensureLeague(env);
      const week = weekKey();
      const mine = await env.DB.prepare("SELECT tier, bucket, cm FROM league WHERE player_id = ? AND week = ?")
        .bind(player, week).first<{ tier: number; bucket: number; cm: number }>();
      // nobody is placed until they climb: show the tier they would carry in, and an empty table
      if (!mine) {
        const last = await env.DB.prepare("SELECT tier FROM league WHERE player_id = ? ORDER BY week DESC LIMIT 1")
          .bind(player).first<{ tier: number }>();
        return json({ week, tier: last?.tier ?? 0, tierName: TIERS[last?.tier ?? 0], bucket: 0, rank: null, promote: PROMOTE, relegate: RELEGATE, rows: [] }, h);
      }
      const rows = await env.DB.prepare(
        "SELECT name, cm, player_id, updated_at AS created_at FROM league WHERE week = ? AND tier = ? AND bucket = ? AND player_id NOT LIKE 'smoke-%' ORDER BY cm DESC, updated_at ASC LIMIT 40",
      ).bind(week, mine.tier, mine.bucket).all();
      const above = await env.DB.prepare("SELECT COUNT(*) AS n FROM league WHERE week = ? AND tier = ? AND bucket = ? AND cm > ?")
        .bind(week, mine.tier, mine.bucket, mine.cm).first<{ n: number }>();
      return json({ week, tier: mine.tier, tierName: TIERS[mine.tier], bucket: mine.bucket,
        rank: (above?.n ?? 0) + 1, cm: mine.cm, promote: PROMOTE, relegate: RELEGATE, rows: rows.results }, h);
    }

    if (req.method === "POST" && url.pathname === "/rename") {
      if (await rateLimited(env, `rename:${clientIp(req)}`, 20, 60_000)) return json({ error: "slow down" }, h, 429);
      let body: { playerId?: unknown; token?: unknown; name?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const playerId = String(body.playerId ?? "").slice(0, 64);
      const token = String(body.token ?? "").slice(0, 64);
      let name = String(body.name ?? "").replace(NAME_RE, "").trim().slice(0, 12);
      if (!playerId || name.length < 3) return json({ error: "bad name" }, h, 400);
      // without this, anyone could rename anyone else's rows on a public leaderboard
      const owner = await env.DB.prepare("SELECT token FROM saves WHERE player_id = ?").bind(playerId).first<{ token: string }>();
      if (!owner || owner.token !== token) return json({ error: "forbidden" }, h, 403);
      if (nameIsProfane(name)) name = "climber";
      await env.DB.batch([
        env.DB.prepare("UPDATE scores SET name = ? WHERE player_id = ?").bind(name, playerId),
        env.DB.prepare("UPDATE lifetime SET name = ? WHERE player_id = ?").bind(name, playerId),
        env.DB.prepare("UPDATE wallet SET name = ? WHERE player_id = ?").bind(name, playerId),
        env.DB.prepare("UPDATE league SET name = ? WHERE player_id = ?").bind(name, playerId),
      ]);
      return json({ ok: true, name }, h);
    }

    if (req.method === "POST" && url.pathname === "/save") {
      if (await rateLimited(env, `save:${clientIp(req)}`, 30, 60_000)) return json({ error: "slow down" }, h, 429);
      let body: { playerId?: unknown; token?: unknown; blob?: unknown; rev?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const playerId = String(body.playerId ?? "").slice(0, 64);
      const token = String(body.token ?? "").slice(0, 64);
      const blob = typeof body.blob === "string" ? body.blob : JSON.stringify(body.blob ?? null);
      const rev = Math.floor(Number(body.rev ?? 0));
      if (!playerId || token.length < 16 || blob.length > 64_000) return json({ error: "bad save" }, h, 400);
      const cur = await env.DB.prepare("SELECT token, blob, rev FROM saves WHERE player_id = ?").bind(playerId).first<{ token: string; blob: string; rev: number }>();
      if (cur && cur.token !== token) return json({ error: "forbidden" }, h, 403);
      if (cur && rev < cur.rev) return json({ error: "conflict", rev: cur.rev, blob: cur.blob }, h, 409);
      const next = (cur?.rev ?? 0) + 1;
      await env.DB.prepare(
        "INSERT INTO saves (player_id, token, blob, rev, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET blob = excluded.blob, rev = excluded.rev, updated_at = excluded.updated_at",
      ).bind(playerId, token, blob, next, Date.now()).run();
      // coins on hand for the COINS board: read straight from the save so it needs no extra call
      try {
        const data = JSON.parse(blob) as { coins?: unknown; name?: unknown };
        const coins = Math.max(0, Math.min(1_000_000_000, Math.floor(Number(data?.coins ?? 0))));
        let name = String(data?.name ?? "").replace(NAME_RE, "").trim().slice(0, 12);
        if (name.length < 3 || nameIsProfane(name)) name = "climber";
        if (Number.isFinite(coins)) await env.DB.prepare(
          "INSERT INTO wallet (player_id, name, coins, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET name = excluded.name, coins = excluded.coins, updated_at = excluded.updated_at",
        ).bind(playerId, name, coins, Date.now()).run();
      } catch { /* a save that is not JSON has no wallet */ }
      return json({ ok: true, rev: next }, h);
    }

    if (req.method === "GET" && url.pathname === "/save") {
      const playerId = url.searchParams.get("player") ?? "";
      const token = url.searchParams.get("token") ?? "";
      if (!playerId || !token) return json({ error: "bad request" }, h, 400);
      const cur = await env.DB.prepare("SELECT token, blob, rev FROM saves WHERE player_id = ?").bind(playerId).first<{ token: string; blob: string; rev: number }>();
      if (!cur) return json({ error: "none" }, h, 404);
      if (cur.token !== token) return json({ error: "forbidden" }, h, 403);
      return json({ blob: cur.blob, rev: cur.rev }, h);
    }

    if (req.method === "POST" && url.pathname === "/link") {
      if (await rateLimited(env, `link:${clientIp(req)}`, 10, 5 * 60_000)) return json({ error: "slow down" }, h, 429);
      let body: { playerId?: unknown; token?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const playerId = String(body.playerId ?? "").slice(0, 64);
      const token = String(body.token ?? "").slice(0, 64);
      const cur = await env.DB.prepare("SELECT token FROM saves WHERE player_id = ?").bind(playerId).first<{ token: string }>();
      if (!cur || cur.token !== token) return json({ error: "save first" }, h, 403);
      // unambiguous alphabet, six chars
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
      const expiresAt = Date.now() + 10 * 60_000;
      await env.DB.batch([
        env.DB.prepare("DELETE FROM link_codes WHERE expires_at < ? OR player_id = ?").bind(Date.now(), playerId),
        env.DB.prepare("INSERT INTO link_codes (code, player_id, expires_at) VALUES (?, ?, ?)").bind(code, playerId, expiresAt),
      ]);
      return json({ code, expiresAt }, h);
    }

    if (req.method === "POST" && url.pathname === "/claim") {
      // The whole point of a 6-char code is that guessing it is infeasible; a script with no
      // throttle can still try thousands of codes inside the 10-minute window, so cap attempts
      // per IP well under what it would take to have a real shot at a live code.
      if (await rateLimited(env, `claim:${clientIp(req)}`, 12, 10 * 60_000)) return json({ error: "slow down" }, h, 429);
      let body: { code?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const code = String(body.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      if (code.length !== 6) return json({ error: "bad code" }, h, 400);
      const row = await env.DB.prepare("SELECT player_id, expires_at FROM link_codes WHERE code = ?").bind(code).first<{ player_id: string; expires_at: number }>();
      if (!row || row.expires_at < Date.now()) return json({ error: "expired" }, h, 404);
      const sv = await env.DB.prepare("SELECT token, blob, rev FROM saves WHERE player_id = ?").bind(row.player_id).first<{ token: string; blob: string; rev: number }>();
      if (!sv) return json({ error: "no save" }, h, 404);
      await env.DB.prepare("DELETE FROM link_codes WHERE code = ?").bind(code).run();
      return json({ playerId: row.player_id, token: sv.token, blob: sv.blob, rev: sv.rev }, h);
    }

    if (req.method === "POST" && url.pathname === "/merge") {
      if (await rateLimited(env, `merge:${clientIp(req)}`, 15, 60_000)) return json({ error: "slow down" }, h, 429);
      let body: { fromId?: unknown; fromToken?: unknown; toId?: unknown; toToken?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const fromId = String(body.fromId ?? "").slice(0, 64), fromToken = String(body.fromToken ?? "").slice(0, 64);
      const toId = String(body.toId ?? "").slice(0, 64), toToken = String(body.toToken ?? "").slice(0, 64);
      if (!fromId || !toId || fromId === toId) return json({ error: "bad request" }, h, 400);
      // the caller must hold both secrets (it just claimed the target and still has its own)
      const to = await env.DB.prepare("SELECT token FROM saves WHERE player_id = ?").bind(toId).first<{ token: string }>();
      if (!to || to.token !== toToken) return json({ error: "forbidden" }, h, 403);
      const from = await env.DB.prepare("SELECT token FROM saves WHERE player_id = ?").bind(fromId).first<{ token: string }>();
      // an old device that never saved to the cloud has no token row; allow the merge of its board rows only if it
      // never uploaded (nothing to prove), otherwise require its token
      if (from && from.token !== fromToken) return json({ error: "forbidden" }, h, 403);
      const toName = await env.DB.prepare("SELECT name FROM lifetime WHERE player_id = ?").bind(toId).first<{ name: string }>();
      const name = toName?.name ?? "climber";
      const now = Date.now();
      await env.DB.batch([
        // best per mode: keep the max
        env.DB.prepare(
          `INSERT INTO scores (player_id, name, mode, cm, created_at)
             SELECT ?, ?, mode, cm, created_at FROM scores WHERE player_id = ?
           ON CONFLICT(player_id, mode) DO UPDATE SET cm = MAX(scores.cm, excluded.cm)`,
        ).bind(toId, name, fromId),
        env.DB.prepare("DELETE FROM scores WHERE player_id = ?").bind(fromId),
        // lifetime: add
        env.DB.prepare(
          `INSERT INTO lifetime (player_id, name, cm, runs, updated_at)
             SELECT ?, ?, cm, runs, ? FROM lifetime WHERE player_id = ?
           ON CONFLICT(player_id) DO UPDATE SET cm = lifetime.cm + excluded.cm, runs = lifetime.runs + excluded.runs, updated_at = excluded.updated_at`,
        ).bind(toId, name, now, fromId),
        env.DB.prepare("DELETE FROM lifetime WHERE player_id = ?").bind(fromId),
        env.DB.prepare("DELETE FROM saves WHERE player_id = ?").bind(fromId),
        env.DB.prepare("DELETE FROM link_codes WHERE player_id = ?").bind(fromId),
      ]);
      return json({ ok: true }, h);
    }

    if (req.method === "POST" && url.pathname === "/run") {
      if (await rateLimited(env, `run:${clientIp(req)}`, 40, 60_000)) return json({ error: "slow down" }, h, 429);
      let body: { playerId?: unknown; mode?: unknown; cm?: unknown; total?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const cm = Math.floor(Number(body.cm));
      const pid = String(body.playerId ?? "");
      // The device's own lifetime figure. A run post that never arrives used to be lost for
      // good, since this table only ever added, so the board sat below what the player could
      // read on their own screen for ever. Taking the higher of the two lets it catch up.
      // Bounded the same way a single run is: a number outside that is simply ignored.
      const claimed = Math.floor(Number(body.total));
      const total = Number.isFinite(claimed) && claimed > 0 && claimed <= MAX_LIFETIME_CM ? claimed : 0;
      if (!pid || !validMode(body.mode) || !Number.isFinite(cm) || cm <= 0 || cm > MAX_CM) {
        return json({ error: "bad run" }, h, 400);
      }
      if (pid.startsWith("smoke-")) return json({ ok: true }, h);
      let name = String((body as { name?: unknown }).name ?? "").replace(NAME_RE, "").trim().slice(0, 12) || "climber";
      if (nameIsProfane(name)) name = "climber";
      const now = Date.now();
      await env.DB.batch([
        env.DB.prepare("UPDATE stats SET total_cm = total_cm + ?, runs = runs + 1 WHERE id = 1").bind(cm),
        env.DB.prepare(
          `INSERT INTO lifetime (player_id, name, cm, runs, updated_at) VALUES (?, ?, ?, 1, ?)
           ON CONFLICT(player_id) DO UPDATE SET cm = MAX(lifetime.cm + excluded.cm, ?5), runs = lifetime.runs + 1, name = excluded.name, updated_at = excluded.updated_at`,
        ).bind(pid, name, cm, now, total),
      ]);
      // the week's league table: metres climbed, not a single best, so playing is what moves you
      const seat = await placeInLeague(env, pid, name);
      await env.DB.prepare("UPDATE league SET cm = cm + ?, name = ?, updated_at = ? WHERE player_id = ? AND week = ?")
        .bind(cm, name, now, pid, seat.week).run()
        // the run itself is already saved above; losing the league update would just leave a
        // player's bucket standing stale, but that should never happen silently
        .catch((err) => console.error("league update failed", pid, seat.week, err));
      return json({ ok: true }, h);
    }

    if (req.method === "GET" && url.pathname === "/chat") {
      const after = Math.max(0, Math.floor(Number(url.searchParams.get("after") ?? 0)));
      // `before` walks backwards through the history for a panel scrolled to its top;
      // `after` is the live poll. They never combine: one asks for newer, one for older.
      const before = Math.max(0, Math.floor(Number(url.searchParams.get("before") ?? 0)));
      const limit = Math.min(100, Math.max(1, Math.floor(Number(url.searchParams.get("limit") ?? 40)) || 40));
      const cols = "id, name, text, player_id, created_at";
      const where = before ? "id < ?" : "id > ?";
      const arg = before || after;
      const rows = await env.DB.prepare(
        `SELECT ${cols}, avatar FROM chat WHERE ${where} ORDER BY id DESC LIMIT ?`,
      ).bind(arg, limit).all<{ id: number; name: string; text: string; player_id: string; created_at: number; avatar: string | null }>().catch(() =>
        // `avatar` arrived after launch; until the column exists the room still answers
        env.DB.prepare(`SELECT ${cols}, NULL AS avatar FROM chat WHERE ${where} ORDER BY id DESC LIMIT ?`).bind(arg, limit)
          .all<{ id: number; name: string; text: string; player_id: string; created_at: number; avatar: string | null }>());
      let messages = (rows.results ?? []).reverse();
      // A block only used to be enforced on the device that made it, which does nothing for
      // everyone else the blocked player is still posting to. `/chat/report` already records
      // a block server-side, so a caller that says who it is gets its own blocked senders
      // filtered out here too, whichever device it is reading from.
      const viewer = url.searchParams.get("player")?.slice(0, 64) || null;
      if (viewer) {
        await ensureReports(env);
        const blocks = await env.DB.prepare("SELECT target_id FROM chat_reports WHERE kind = 'block' AND reporter_id = ?")
          .bind(viewer).all<{ target_id: string }>().catch(() => ({ results: [] as { target_id: string }[] }));
        const blocked = new Set((blocks.results ?? []).map((r) => r.target_id));
        if (blocked.size) messages = messages.filter((m) => !blocked.has(m.player_id));
      }
      // a short page is the end of the history, which is how the panel knows to stop asking
      if (before) return json({ messages, online: 0, more: messages.length === limit }, h);
      const online = await env.DB.prepare("SELECT COUNT(DISTINCT player_id) AS n FROM chat WHERE created_at > ?").bind(Date.now() - 10 * 60_000).first<{ n: number }>();
      return json({ messages, online: online?.n ?? 0 }, h);
    }

    // A player blocking or reporting someone. Both land here so the owner can see who is
    // being complained about; a block is also honoured for that player in GET /chat above,
    // once a caller identifies itself with `?player=`.
    if (req.method === "POST" && url.pathname === "/chat/report") {
      let body: { playerId?: unknown; token?: unknown; kind?: unknown; targetId?: unknown; messageId?: unknown; text?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const playerId = String(body.playerId ?? "").slice(0, 64);
      const token = String(body.token ?? "").slice(0, 64);
      const targetId = String(body.targetId ?? "").slice(0, 64);
      const kind = body.kind === "block" ? "block" : "report";
      const messageId = Math.max(0, Math.floor(Number(body.messageId ?? 0))) || null;
      if (!playerId || token.length < 16 || !targetId || targetId === playerId) return json({ error: "bad report" }, h, 400);
      const owner = await env.DB.prepare("SELECT token FROM saves WHERE player_id = ?").bind(playerId).first<{ token: string }>();
      if (!owner || owner.token !== token) return json({ error: "forbidden" }, h, 403);
      await ensureReports(env);
      // the message as it read when it was reported, so deleting it later does not erase the evidence
      const msg = messageId
        ? await env.DB.prepare("SELECT name, text FROM chat WHERE id = ?").bind(messageId).first<{ name: string; text: string }>()
        : null;
      const name = msg?.name
        ?? (await env.DB.prepare("SELECT name FROM lifetime WHERE player_id = ?").bind(targetId).first<{ name: string }>())?.name
        ?? "climber";
      // the message as the reporter read it; the chat row is gone once it is deleted or pruned,
      // so fall back to what the client sent rather than filing a flag with nothing on it
      const sentClean = cleanChat(String(body.text ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 160));
      const reported = msg?.text ?? (sentClean.clean || null);
      await env.DB.prepare(
        "INSERT OR IGNORE INTO chat_reports (kind, target_id, target_name, reporter_id, message_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).bind(kind, targetId, name, playerId, messageId, reported, Date.now()).run();
      return json({ ok: true }, h);
    }

    if (req.method === "POST" && url.pathname === "/chat") {
      let body: { playerId?: unknown; token?: unknown; name?: unknown; text?: unknown; avatar?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const playerId = String(body.playerId ?? "").slice(0, 64);
      const avatar = /^[a-z0-9-]{1,24}$/.test(String(body.avatar ?? "")) ? String(body.avatar) : null;
      const token = String(body.token ?? "").slice(0, 64);
      const text = String(body.text ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
      if (!playerId || token.length < 16 || text.length < 1) return json({ error: "bad message" }, h, 400);
      // a player with a cloud save must present its token; brand-new players (no save yet) may post once they have synced
      const owner = await env.DB.prepare("SELECT token FROM saves WHERE player_id = ?").bind(playerId).first<{ token: string }>();
      if (!owner || owner.token !== token) return json({ error: "forbidden" }, h, 403);
      const mute = await env.DB.prepare("SELECT until FROM chat_mutes WHERE player_id = ?").bind(playerId).first<{ until: number }>();
      if (mute && (mute.until === 0 || mute.until > Date.now())) return json({ error: "muted" }, h, 403);
      const last = await env.DB.prepare("SELECT created_at FROM chat WHERE player_id = ? ORDER BY id DESC LIMIT 1").bind(playerId).first<{ created_at: number }>();
      if (last && Date.now() - last.created_at < 3000) return json({ error: "slow down" }, h, 429);
      let name = String(body.name ?? "").replace(NAME_RE, "").trim().slice(0, 12);
      const known = await env.DB.prepare("SELECT name FROM lifetime WHERE player_id = ?").bind(playerId).first<{ name: string }>();
      if (known?.name) name = known.name;
      if (name.length < 3 || nameIsProfane(name)) name = "climber";
      const { clean, censored, pii } = cleanChat(text);
      const now = Date.now();
      const insert = () => env.DB.prepare("INSERT INTO chat (player_id, name, text, created_at, avatar) VALUES (?, ?, ?, ?, ?)").bind(playerId, name, clean, now, avatar).run();
      const ins = await insert().catch(async () => {
        // self-heal: add the column the schema gained after launch, then retry once
        await env.DB.prepare("ALTER TABLE chat ADD COLUMN avatar TEXT").run().catch(() => {});
        return insert();
      });
      const id = Number(ins.meta.last_row_id ?? 0);
      if (id % 50 === 0) await env.DB.prepare("DELETE FROM chat WHERE id < ?").bind(id - CHAT_HISTORY).run();
      // Three strikes and the owner sees what they actually typed. The room only ever shows
      // the starred version; the raw text is kept on the flag, not in the chat log.
      if (censored) {
        await ensureCensors(env);
        await env.DB.prepare(
          "INSERT INTO chat_censors (player_id, n, updated_at) VALUES (?, 1, ?) ON CONFLICT(player_id) DO UPDATE SET n = chat_censors.n + 1, updated_at = excluded.updated_at",
        ).bind(playerId, now).run().catch(() => {});
        const strikes = (await env.DB.prepare("SELECT n FROM chat_censors WHERE player_id = ?").bind(playerId).first<{ n: number }>().catch(() => null))?.n ?? 0;
        if (strikes >= CENSOR_REVIEW_AT) {
          await ensureReports(env);
          await env.DB.prepare(
            "INSERT OR IGNORE INTO chat_reports (kind, target_id, target_name, reporter_id, message_id, text, created_at) VALUES ('censor', ?, ?, 'filter', ?, ?, ?)",
          ).bind(playerId, name, id, text, now).run().catch(() => {});
        }
      }
      // A kid trying to share a phone number, an address or a social handle is the biggest
      // real-world risk in this room, so it goes to the owner immediately — no three strikes.
      if (pii) {
        await ensureReports(env);
        await env.DB.prepare(
          "INSERT OR IGNORE INTO chat_reports (kind, target_id, target_name, reporter_id, message_id, text, created_at) VALUES ('pii', ?, ?, 'filter', ?, ?, ?)",
        ).bind(playerId, name, id, text, now).run().catch(() => {});
      }
      return json({ ok: true, message: { id, name, text: clean, player_id: playerId, created_at: now, avatar } }, h);
    }

    if (req.method === "GET" && url.pathname === "/stats") {
      const st = await env.DB.prepare("SELECT total_cm, runs FROM stats WHERE id = 1").first<{ total_cm: number; runs: number }>();
      const pl = await env.DB.prepare("SELECT COUNT(DISTINCT player_id) AS n FROM scores WHERE player_id NOT LIKE 'smoke-%'").first<{ n: number }>();
      return json({ total_cm: st?.total_cm ?? 0, runs: st?.runs ?? 0, players: pl?.n ?? 0 }, h);
    }

    return json({ error: "not found" }, h, 404);
  },
};
