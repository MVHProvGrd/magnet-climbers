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
 *   GET  /chat?after=<id>                      → { messages: [{ id, name, text, player_id, created_at }], online }
 *   POST /chat   { playerId, token, name, text } → { ok, message } | 429 (3 s per player) | 403 (muted)
 *   GET  /c/<mode>.<cm>.<name>[/<playerId>][.png] → challenge share page (Open Graph) / score card PNG; the
 *        height is checked against that player's scoreboard best, else the card says "unverified"
 *
 * Trust model: honour system with sanity caps. Runs are seeded and deterministic,
 * so a later version can submit the input log and have the server replay it.
 */
import PROFANITY from "../../src/game/data/profanity.json";
import { handleShare, type Challenge } from "./card";
import { handleAdmin } from "./admin";

const BLOCKED = new Set((PROFANITY as string[]).map((w) => w.toLowerCase()));
const deleet = (t: string) => t.replace(/[0]/g, "o").replace(/[1|]/g, "i").replace(/3/g, "e").replace(/[4@]/g, "a").replace(/[5$]/g, "s").replace(/[7+]/g, "t").replace(/8/g, "b").replace(/9/g, "g");
/** Server-side mirror of the client name filter: substring match on 5+ letter words, whole-token on shorter. */
function nameIsProfane(name: string): boolean {
  const whole = deleet(name.toLowerCase()).replace(/[^a-z]/g, "");
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/).map((t) => deleet(t).replace(/[^a-z]/g, "")).filter(Boolean);
  for (const bad of BLOCKED) {
    if (bad.length < 3) continue;
    if (bad.length <= 4) { if (whole === bad || tokens.some((t) => t === bad || (bad.length === 4 && t.startsWith(bad)))) return true; }
    else if (whole.includes(bad)) return true;
  }
  return false;
}

/** Chat text filter: profane words become stars, links are dropped. Whole-message rejection is for names only. */
function cleanChat(text: string): string {
  return text
    .replace(/https?:\/\/\S+|www\.\S+|\S+\.(com|net|org|io|gg|xyz)\b\S*/gi, "[link]")
    .split(/(\s+)/)
    .map((tok) => (/\s/.test(tok) || !nameIsProfane(tok) ? tok : "*".repeat(Math.min(tok.length, 6))))
    .join("");
}

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  /** owner key for /admin; set with `npx wrangler secret put ADMIN_KEY` */
  ADMIN_KEY?: string;
}

const MAX_CM = 200_000;
const NAME_RE = /[^\p{L}\p{N} _.\-!?]/gu;

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

const json = (data: unknown, headers: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

const validMode = (m: unknown): m is "crew" | "solo" => m === "crew" || m === "solo";

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
      if (!validMode(mode)) return json({ error: "bad mode" }, h, 400);
      const rows = await env.DB.prepare(
        "SELECT name, cm, player_id, created_at, seconds FROM scores WHERE mode = ? AND player_id NOT LIKE 'smoke-%' ORDER BY cm DESC, created_at ASC LIMIT ?",
      ).bind(mode, limit).all();
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
      let body: { playerId?: unknown; name?: unknown; mode?: unknown; cm?: unknown; seconds?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const playerId = String(body.playerId ?? "").slice(0, 64);
      let name = String(body.name ?? "").replace(NAME_RE, "").trim().slice(0, 12) || "climber";
      if (nameIsProfane(name)) name = "climber";
      const cm = Math.floor(Number(body.cm));
      const secs = Number.isFinite(Number(body.seconds)) && Number(body.seconds) > 0 ? Math.min(86400, Math.round(Number(body.seconds))) : null;
      if (!playerId || !validMode(body.mode) || !Number.isFinite(cm) || cm <= 0 || cm > MAX_CM) {
        return json({ error: "bad score" }, h, 400);
      }
      const now = Date.now();
      // keep only the player's best per mode; the name updates every submit
      await env.DB.prepare(
        `INSERT INTO scores (player_id, name, mode, cm, created_at, seconds) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(player_id, mode) DO UPDATE SET
           name = excluded.name,
           cm = MAX(scores.cm, excluded.cm),
           seconds = CASE WHEN excluded.cm > scores.cm THEN excluded.seconds ELSE scores.seconds END,
           created_at = CASE WHEN excluded.cm > scores.cm THEN excluded.created_at ELSE scores.created_at END`,
      ).bind(playerId, name, body.mode, cm, now, secs).run();
      const best = await env.DB.prepare("SELECT cm FROM scores WHERE mode = ? AND player_id = ?").bind(body.mode, playerId).first<{ cm: number }>();
      return json({ ok: true, best: best?.cm ?? cm }, h);
    }

    if (req.method === "POST" && url.pathname === "/rename") {
      let body: { playerId?: unknown; name?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const playerId = String(body.playerId ?? "").slice(0, 64);
      let name = String(body.name ?? "").replace(NAME_RE, "").trim().slice(0, 12);
      if (!playerId || name.length < 3) return json({ error: "bad name" }, h, 400);
      if (nameIsProfane(name)) name = "climber";
      await env.DB.batch([
        env.DB.prepare("UPDATE scores SET name = ? WHERE player_id = ?").bind(name, playerId),
        env.DB.prepare("UPDATE lifetime SET name = ? WHERE player_id = ?").bind(name, playerId),
        env.DB.prepare("UPDATE wallet SET name = ? WHERE player_id = ?").bind(name, playerId),
      ]);
      return json({ ok: true, name }, h);
    }

    if (req.method === "POST" && url.pathname === "/save") {
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
      let body: { playerId?: unknown; mode?: unknown; cm?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const cm = Math.floor(Number(body.cm));
      const pid = String(body.playerId ?? "");
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
           ON CONFLICT(player_id) DO UPDATE SET cm = lifetime.cm + excluded.cm, runs = lifetime.runs + 1, name = excluded.name, updated_at = excluded.updated_at`,
        ).bind(pid, name, cm, now),
      ]);
      return json({ ok: true }, h);
    }

    if (req.method === "GET" && url.pathname === "/chat") {
      const after = Math.max(0, Math.floor(Number(url.searchParams.get("after") ?? 0)));
      const rows = await env.DB.prepare(
        "SELECT id, name, text, player_id, created_at FROM chat WHERE id > ? ORDER BY id DESC LIMIT 40",
      ).bind(after).all<{ id: number; name: string; text: string; player_id: string; created_at: number }>();
      const online = await env.DB.prepare("SELECT COUNT(DISTINCT player_id) AS n FROM chat WHERE created_at > ?").bind(Date.now() - 10 * 60_000).first<{ n: number }>();
      return json({ messages: (rows.results ?? []).reverse(), online: online?.n ?? 0 }, h);
    }

    if (req.method === "POST" && url.pathname === "/chat") {
      let body: { playerId?: unknown; token?: unknown; name?: unknown; text?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const playerId = String(body.playerId ?? "").slice(0, 64);
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
      const clean = cleanChat(text);
      const now = Date.now();
      const ins = await env.DB.prepare("INSERT INTO chat (player_id, name, text, created_at) VALUES (?, ?, ?, ?)").bind(playerId, name, clean, now).run();
      const id = Number(ins.meta.last_row_id ?? 0);
      if (id % 50 === 0) await env.DB.prepare("DELETE FROM chat WHERE id < ?").bind(id - 500).run();
      return json({ ok: true, message: { id, name, text: clean, player_id: playerId, created_at: now } }, h);
    }

    if (req.method === "GET" && url.pathname === "/stats") {
      const st = await env.DB.prepare("SELECT total_cm, runs FROM stats WHERE id = 1").first<{ total_cm: number; runs: number }>();
      const pl = await env.DB.prepare("SELECT COUNT(DISTINCT player_id) AS n FROM scores WHERE player_id NOT LIKE 'smoke-%'").first<{ n: number }>();
      return json({ total_cm: st?.total_cm ?? 0, runs: st?.runs ?? 0, players: pl?.n ?? 0 }, h);
    }

    return json({ error: "not found" }, h, 404);
  },
};
