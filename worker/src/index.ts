/**
 * Magnet Climbers leaderboard API.
 *   GET  /top?mode=crew|solo|lifetime&limit=25 → [{ name, cm, player_id, created_at }]
 *   GET  /rank?mode=crew&player=<id>        → { rank, cm } or { rank: null }
 *   POST /score  { playerId, name, mode, cm } → { ok, best }
 *   POST /run    { playerId, name?, mode, cm } → { ok }   adds to the global and the player's lifetime totals
 *   POST /rename { playerId, name }           → { ok, name }  renames every board row for that player
 *   POST /save   { playerId, token, blob, rev } → { ok, rev } | 409 { rev, blob }   cloud save (token = per-player secret)
 *   GET  /save?player=&token=                  → { blob, rev } | 404
 *   POST /link   { playerId, token }            → { code, expiresAt }   6-char code, 10 minutes
 *   POST /claim  { code }                       → { playerId, token, blob, rev }   adopt that player on this device
 *   GET  /stats                                → { total_cm, runs, players }
 *
 * Trust model: honour system with sanity caps. Runs are seeded and deterministic,
 * so a later version can submit the input log and have the server replay it.
 */
import PROFANITY from "../../src/game/data/profanity.json";

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

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
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
    "Access-Control-Allow-Headers": "Content-Type",
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

    if (req.method === "GET" && url.pathname === "/top") {
      const mode = url.searchParams.get("mode") ?? "crew";
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
      if (mode === "lifetime") {
        const rows = await env.DB.prepare(
          "SELECT name, cm, player_id, updated_at AS created_at FROM lifetime WHERE player_id NOT LIKE 'smoke-%' ORDER BY cm DESC, updated_at ASC LIMIT ?",
        ).bind(limit).all();
        return json(rows.results, h);
      }
      if (!validMode(mode)) return json({ error: "bad mode" }, h, 400);
      const rows = await env.DB.prepare(
        "SELECT name, cm, player_id, created_at FROM scores WHERE mode = ? AND player_id NOT LIKE 'smoke-%' ORDER BY cm DESC, created_at ASC LIMIT ?",
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
      if (!validMode(mode) || !player) return json({ error: "bad request" }, h, 400);
      const me = await env.DB.prepare("SELECT cm FROM scores WHERE mode = ? AND player_id = ?").bind(mode, player).first<{ cm: number }>();
      if (!me) return json({ rank: null }, h);
      const above = await env.DB.prepare("SELECT COUNT(*) AS n FROM scores WHERE mode = ? AND cm > ? AND player_id NOT LIKE 'smoke-%'").bind(mode, me.cm).first<{ n: number }>();
      return json({ rank: (above?.n ?? 0) + 1, cm: me.cm }, h);
    }

    if (req.method === "POST" && url.pathname === "/score") {
      let body: { playerId?: unknown; name?: unknown; mode?: unknown; cm?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const playerId = String(body.playerId ?? "").slice(0, 64);
      let name = String(body.name ?? "").replace(NAME_RE, "").trim().slice(0, 12) || "climber";
      if (nameIsProfane(name)) name = "climber";
      const cm = Math.floor(Number(body.cm));
      if (!playerId || !validMode(body.mode) || !Number.isFinite(cm) || cm <= 0 || cm > MAX_CM) {
        return json({ error: "bad score" }, h, 400);
      }
      const now = Date.now();
      // keep only the player's best per mode; the name updates every submit
      await env.DB.prepare(
        `INSERT INTO scores (player_id, name, mode, cm, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(player_id, mode) DO UPDATE SET
           name = excluded.name,
           cm = MAX(scores.cm, excluded.cm),
           created_at = CASE WHEN excluded.cm > scores.cm THEN excluded.created_at ELSE scores.created_at END`,
      ).bind(playerId, name, body.mode, cm, now).run();
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

    if (req.method === "GET" && url.pathname === "/stats") {
      const st = await env.DB.prepare("SELECT total_cm, runs FROM stats WHERE id = 1").first<{ total_cm: number; runs: number }>();
      const pl = await env.DB.prepare("SELECT COUNT(DISTINCT player_id) AS n FROM scores WHERE player_id NOT LIKE 'smoke-%'").first<{ n: number }>();
      return json({ total_cm: st?.total_cm ?? 0, runs: st?.runs ?? 0, players: pl?.n ?? 0 }, h);
    }

    return json({ error: "not found" }, h, 404);
  },
};
