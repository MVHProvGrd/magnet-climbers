/**
 * Magnet Climbers leaderboard API.
 *   GET  /top?mode=crew|solo&limit=25       → [{ name, cm, player_id, created_at }]
 *   GET  /rank?mode=crew&player=<id>        → { rank, cm } or { rank: null }
 *   POST /score  { playerId, name, mode, cm } → { ok, best }
 *
 * Trust model: honour system with sanity caps. Runs are seeded and deterministic,
 * so a later version can submit the input log and have the server replay it.
 */
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
      if (!validMode(mode)) return json({ error: "bad mode" }, h, 400);
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
      const rows = await env.DB.prepare(
        "SELECT name, cm, player_id, created_at FROM scores WHERE mode = ? ORDER BY cm DESC, created_at ASC LIMIT ?",
      ).bind(mode, limit).all();
      return json(rows.results, h);
    }

    if (req.method === "GET" && url.pathname === "/rank") {
      const mode = url.searchParams.get("mode") ?? "crew";
      const player = url.searchParams.get("player") ?? "";
      if (!validMode(mode) || !player) return json({ error: "bad request" }, h, 400);
      const me = await env.DB.prepare("SELECT cm FROM scores WHERE mode = ? AND player_id = ?").bind(mode, player).first<{ cm: number }>();
      if (!me) return json({ rank: null }, h);
      const above = await env.DB.prepare("SELECT COUNT(*) AS n FROM scores WHERE mode = ? AND cm > ?").bind(mode, me.cm).first<{ n: number }>();
      return json({ rank: (above?.n ?? 0) + 1, cm: me.cm }, h);
    }

    if (req.method === "POST" && url.pathname === "/score") {
      let body: { playerId?: unknown; name?: unknown; mode?: unknown; cm?: unknown };
      try { body = await req.json(); } catch { return json({ error: "bad json" }, h, 400); }
      const playerId = String(body.playerId ?? "").slice(0, 64);
      const name = String(body.name ?? "").replace(NAME_RE, "").trim().slice(0, 12) || "climber";
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

    return json({ error: "not found" }, h, 404);
  },
};
