/**
 * Owner admin panel at /admin (HTML) with a JSON API under /admin/api/*.
 * Locked with the ADMIN_KEY secret:  npx wrangler secret put ADMIN_KEY
 * The page keeps the key in localStorage and sends it as a Bearer token.
 */
import type { Env } from "./index";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export async function handleAdmin(req: Request, url: URL, env: Env & { ADMIN_KEY?: string }, h: Record<string, string>): Promise<Response | null> {
  if (!url.pathname.startsWith("/admin")) return null;
  if (url.pathname === "/admin" || url.pathname === "/admin/") {
    return new Response(PAGE, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...h, "Content-Type": "application/json" } });
  if (!env.ADMIN_KEY) return json({ error: "ADMIN_KEY secret is not set on the Worker" }, 503);
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${env.ADMIN_KEY}`) return json({ error: "unauthorized" }, 401);
  const body = req.method === "POST" ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};
  const str = (k: string, max = 64) => String(body[k] ?? "").slice(0, max);
  const path = url.pathname.replace(/^\/admin\/api/, "");

  if (path === "/overview") {
    const [chatRows, mutes, stats, players, crew, solo] = await Promise.all([
      env.DB.prepare("SELECT id, player_id, name, text, created_at FROM chat ORDER BY id DESC LIMIT 80").all(),
      env.DB.prepare("SELECT player_id, until FROM chat_mutes").all(),
      env.DB.prepare("SELECT total_cm, runs FROM stats WHERE id = 1").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM lifetime WHERE player_id NOT LIKE 'smoke-%'").first<{ n: number }>(),
      env.DB.prepare("SELECT player_id, name, cm, created_at FROM scores WHERE mode = 'crew' ORDER BY cm DESC LIMIT 30").all(),
      env.DB.prepare("SELECT player_id, name, cm, created_at FROM scores WHERE mode = 'solo' ORDER BY cm DESC LIMIT 30").all(),
    ]);
    return json({ chat: chatRows.results, mutes: mutes.results, stats, players: players?.n ?? 0, crew: crew.results, solo: solo.results });
  }
  if (path === "/player") {
    const id = url.searchParams.get("id") ?? "";
    const [scores, life, save, msgs] = await Promise.all([
      env.DB.prepare("SELECT mode, cm, name, created_at FROM scores WHERE player_id = ?").bind(id).all(),
      env.DB.prepare("SELECT name, cm, runs, updated_at FROM lifetime WHERE player_id = ?").bind(id).first(),
      env.DB.prepare("SELECT rev, updated_at, length(blob) AS bytes FROM saves WHERE player_id = ?").bind(id).first(),
      env.DB.prepare("SELECT id, text, created_at FROM chat WHERE player_id = ? ORDER BY id DESC LIMIT 20").bind(id).all(),
    ]);
    return json({ scores: scores.results, lifetime: life, save, chat: msgs.results });
  }
  if (req.method !== "POST") return json({ error: "not found" }, 404);
  if (path === "/chat/delete") { await env.DB.prepare("DELETE FROM chat WHERE id = ?").bind(Number(body.id)).run(); return json({ ok: true }); }
  if (path === "/chat/clear") { await env.DB.prepare("DELETE FROM chat").run(); return json({ ok: true }); }
  if (path === "/mute") {
    const hours = Number(body.hours ?? 0);
    await env.DB.prepare("INSERT OR REPLACE INTO chat_mutes (player_id, until) VALUES (?, ?)").bind(str("playerId"), hours > 0 ? Date.now() + hours * 3600_000 : 0).run();
    if (body.wipe) await env.DB.prepare("DELETE FROM chat WHERE player_id = ?").bind(str("playerId")).run();
    return json({ ok: true });
  }
  if (path === "/unmute") { await env.DB.prepare("DELETE FROM chat_mutes WHERE player_id = ?").bind(str("playerId")).run(); return json({ ok: true }); }
  if (path === "/score/delete") {
    const mode = str("mode", 8);
    await env.DB.prepare(mode ? "DELETE FROM scores WHERE player_id = ? AND mode = ?" : "DELETE FROM scores WHERE player_id = ?").bind(...(mode ? [str("playerId"), mode] : [str("playerId")])).run();
    return json({ ok: true });
  }
  if (path === "/rename") {
    const name = str("name", 12).replace(/[^\p{L}\p{N} _.\-!?]/gu, "").trim() || "climber";
    await env.DB.batch([
      env.DB.prepare("UPDATE scores SET name = ? WHERE player_id = ?").bind(name, str("playerId")),
      env.DB.prepare("UPDATE lifetime SET name = ? WHERE player_id = ?").bind(name, str("playerId")),
      env.DB.prepare("UPDATE chat SET name = ? WHERE player_id = ?").bind(name, str("playerId")),
    ]);
    return json({ ok: true, name });
  }
  if (path === "/lifetime/set") {
    await env.DB.prepare("UPDATE lifetime SET cm = ? WHERE player_id = ?").bind(Math.max(0, Math.floor(Number(body.cm ?? 0))), str("playerId")).run();
    return json({ ok: true });
  }
  return json({ error: "not found" }, 404);
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Magnet Climbers admin</title>
<style>
body{margin:0;background:#14171c;color:#eee;font:14px system-ui,sans-serif}header{display:flex;gap:12px;align-items:center;padding:12px 16px;background:#1e2229;position:sticky;top:0}
main{padding:16px;display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(340px,1fr))}section{background:#1b1f26;border-radius:12px;padding:14px}
h2{margin:0 0 8px;font-size:15px;color:#ffb74d}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:5px 6px;border-bottom:1px solid #2b3038;text-align:left;vertical-align:top}
button{border:0;border-radius:8px;padding:5px 9px;background:#2b2f38;color:#fff;cursor:pointer;font-weight:700;font-size:12px}button.bad{background:#a33}button.ok{background:#2f6fd6}
input{font:inherit;padding:6px 8px;border-radius:8px;border:1px solid #333;background:#0f1216;color:#fff}.muted{opacity:.6}.id{font-family:ui-monospace,monospace;font-size:11px;opacity:.7}
.row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}#out{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;max-height:40vh;overflow:auto}
</style></head><body>
<header><b>Magnet Climbers admin</b><input id="key" type="password" placeholder="ADMIN_KEY" style="flex:1;max-width:320px"><button class="ok" onclick="saveKey()">Use key</button><button onclick="load()">Refresh</button><a href="https://magnetclimbers.com/art-archive/" target="_blank" style="color:#7cc">Art archive</a><span id="status"></span></header>
<main>
<section><h2>Stats</h2><div id="stats"></div></section>
<section><h2>Player lookup</h2><div class="row"><input id="pid" placeholder="p-xxxxxxxx" style="flex:1"><button onclick="lookup()">Look up</button></div>
<div class="row"><input id="newname" placeholder="new name" maxlength="12"><button onclick="rename()">Rename</button><button class="bad" onclick="delScore('')">Delete all scores</button><button class="bad" onclick="delScore('crew')">Delete crew</button><button class="bad" onclick="delScore('solo')">Delete solo</button></div>
<div class="row"><input id="lifecm" placeholder="lifetime cm" type="number"><button onclick="setLife()">Set lifetime</button><button class="bad" onclick="mute(0,true)">Mute forever + wipe chat</button><button onclick="mute(24,false)">Mute 24h</button><button onclick="unmute()">Unmute</button></div>
<div id="out"></div></section>
<section style="grid-column:1/-1;max-width:1200px"><h2 style="display:flex;gap:10px;align-items:center">Chat (newest first) <button class="bad" onclick="clearChat()">Clear all</button></h2><div id="mutes" class="muted"></div><table id="chat"></table></section>
<section><h2>Crew board</h2><table id="crew"></table></section>
<section><h2>Solo board</h2><table id="solo"></table></section>
</main>
<script>
const $=(s)=>document.querySelector(s);const key=()=>localStorage.getItem("mc-admin-key")||"";
function saveKey(){localStorage.setItem("mc-admin-key",$("#key").value.trim());load();}
async function api(path,body){const r=await fetch("/admin/api"+path,{method:body?"POST":"GET",headers:{"Authorization":"Bearer "+key(),"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});const j=await r.json().catch(()=>({}));if(!r.ok){$("#status").textContent=j.error||r.status;throw new Error(j.error||r.status);}return j;}
const when=(t)=>new Date(t).toLocaleString("en-US",{timeZone:"America/Chicago",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
const esc=(s)=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
const pick=(id)=>{$("#pid").value=id;lookup();};
async function load(){$("#status").textContent="…";const d=await api("/overview");$("#status").textContent="ok";
$("#stats").innerHTML=\`<b>\${(d.stats.total_cm/100).toFixed(1)} m</b> over <b>\${d.stats.runs}</b> runs by <b>\${d.players}</b> climbers\`;
$("#mutes").innerHTML=d.mutes.length?"Muted: "+d.mutes.map(m=>\`<span class="id">\${esc(m.player_id)}</span> (\${m.until?"until "+when(m.until):"forever"}) <button onclick="unmute('\${esc(m.player_id)}')">unmute</button>\`).join(" · "):"No mutes.";
$("#chat").innerHTML=d.chat.map(m=>\`<tr><td class="id">\${when(m.created_at)}</td><td><b>\${esc(m.name)}</b> <span class="id" onclick="pick('\${esc(m.player_id)}')" style="cursor:pointer">\${esc(m.player_id)}</span></td><td>\${esc(m.text)}</td><td><button class="bad" onclick="delChat(\${m.id})">del</button> <button onclick="mute(24,false,'\${esc(m.player_id)}')">mute 24h</button></td></tr>\`).join("")||"<tr><td>Empty</td></tr>";
for(const mode of ["crew","solo"])$("#"+mode).innerHTML=d[mode].map((r,i)=>\`<tr><td>\${i+1}</td><td><b>\${esc(r.name)}</b><br><span class="id" onclick="pick('\${esc(r.player_id)}')" style="cursor:pointer">\${esc(r.player_id)}</span></td><td>\${r.cm} cm</td><td>\${when(r.created_at)}</td><td><button class="bad" onclick="delScoreFor('\${esc(r.player_id)}','\${mode}')">del</button></td></tr>\`).join("");}
async function lookup(){const id=$("#pid").value.trim();if(!id)return;$("#out").textContent=JSON.stringify(await api("/player?id="+encodeURIComponent(id)),null,1);}
async function rename(){await api("/rename",{playerId:$("#pid").value.trim(),name:$("#newname").value});load();lookup();}
async function delScore(mode){if(!confirm("Delete scores?"))return;await api("/score/delete",{playerId:$("#pid").value.trim(),mode});load();}
async function delScoreFor(id,mode){if(!confirm("Delete "+mode+" score for "+id+"?"))return;await api("/score/delete",{playerId:id,mode});load();}
async function setLife(){await api("/lifetime/set",{playerId:$("#pid").value.trim(),cm:Number($("#lifecm").value)});load();}
async function mute(hours,wipe,id){await api("/mute",{playerId:id||$("#pid").value.trim(),hours,wipe});load();}
async function unmute(id){await api("/unmute",{playerId:id||$("#pid").value.trim()});load();}
async function delChat(id){await api("/chat/delete",{id});load();}
async function clearChat(){if(!confirm("Delete every chat message?"))return;await api("/chat/clear",{});load();}
$("#key").value=key();if(key())load();
</script></body></html>`;
