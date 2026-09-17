/**
 * Owner admin panel at /admin (HTML) with a JSON API under /admin/api/*.
 * Locked with the ADMIN_KEY secret:  npx wrangler secret put ADMIN_KEY
 * The page keeps the key in localStorage and sends it as a Bearer token.
 */
import { ensureCensors, ensureReports, ensureScoreResets, TIERS, type Env } from "./index";
import { weekKey } from "./week";

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

  /** A board row carries how long the run took; `seconds` arrived after launch, so an
   *  older database that has not gained the column yet still answers without it. */
  const board = (mode: "crew" | "solo") => env.DB
    .prepare("SELECT player_id, name, cm, created_at, seconds FROM scores WHERE mode = ? ORDER BY cm DESC LIMIT 30").bind(mode).all()
    .catch(() => env.DB.prepare("SELECT player_id, name, cm, created_at FROM scores WHERE mode = ? ORDER BY cm DESC LIMIT 30").bind(mode).all());

  if (path === "/overview") {
    // both tables are created on demand, so make sure they exist before a join reads them
    await Promise.all([ensureReports(env), ensureCensors(env)]);
    // the same day and week the game's boards run on: UTC calendar day, weekKey() for the league
    const today = new Date().toISOString().slice(0, 10), week = weekKey();
    const [chatRows, mutes, stats, players, crew, solo, coins, reports, daily, league, lifetime] = await Promise.all([
      env.DB.prepare("SELECT id, player_id, name, text, created_at FROM chat ORDER BY id DESC LIMIT 80").all(),
      env.DB.prepare("SELECT player_id, until FROM chat_mutes").all(),
      env.DB.prepare("SELECT total_cm, runs FROM stats WHERE id = 1").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM lifetime WHERE player_id NOT LIKE 'smoke-%'").first<{ n: number }>(),
      board("crew"),
      board("solo"),
      // coins on hand, refreshed from every cloud save — the same board the game shows
      env.DB.prepare("SELECT player_id, name, coins, updated_at FROM wallet WHERE player_id NOT LIKE 'smoke-%' AND coins > 0 ORDER BY coins DESC LIMIT 30").all().catch(() => ({ results: [] })),
      // what players have flagged: newest first, with how many times each target has been flagged
      env.DB.prepare(`SELECT r.id, r.kind, r.target_id, r.target_name, r.reporter_id, r.message_id, r.text, r.created_at,
        (SELECT COUNT(*) FROM chat_reports o WHERE o.target_id = r.target_id) AS tally,
        (SELECT n FROM chat_censors c WHERE c.player_id = r.target_id) AS strikes
        FROM chat_reports r ORDER BY r.id DESC LIMIT 60`).all().catch(() => ({ results: [] })),
      // the three boards the game added later; each table is created on its first write, so a
      // fresh database answers with an empty board rather than an error
      env.DB.prepare("SELECT player_id, name, cm, seconds, created_at FROM daily WHERE day = ? AND player_id NOT LIKE 'smoke-%' ORDER BY cm DESC LIMIT 30").bind(today).all().catch(() => ({ results: [] })),
      env.DB.prepare("SELECT player_id, name, tier, bucket, cm, updated_at FROM league WHERE week = ? AND player_id NOT LIKE 'smoke-%' ORDER BY tier DESC, bucket, cm DESC LIMIT 150").bind(week).all().catch(() => ({ results: [] })),
      env.DB.prepare("SELECT player_id, name, cm, runs, updated_at FROM lifetime WHERE player_id NOT LIKE 'smoke-%' ORDER BY cm DESC LIMIT 30").all()
        .catch(() => env.DB.prepare("SELECT player_id, name, cm, runs FROM lifetime WHERE player_id NOT LIKE 'smoke-%' ORDER BY cm DESC LIMIT 30").all()),
    ]);
    return json({
      chat: chatRows.results, mutes: mutes.results, stats, players: players?.n ?? 0, crew: crew.results, solo: solo.results, coins: coins.results, reports: reports.results,
      today, week, tiers: TIERS, daily: daily.results, league: league.results, lifetime: lifetime.results,
    });
  }
  if (path === "/player") {
    const id = url.searchParams.get("id") ?? "";
    const [scores, life, save, msgs, wallet] = await Promise.all([
      env.DB.prepare("SELECT mode, cm, name, created_at, seconds FROM scores WHERE player_id = ?").bind(id).all()
        .catch(() => env.DB.prepare("SELECT mode, cm, name, created_at FROM scores WHERE player_id = ?").bind(id).all()),
      env.DB.prepare("SELECT name, cm, runs, updated_at FROM lifetime WHERE player_id = ?").bind(id).first(),
      env.DB.prepare("SELECT rev, updated_at, length(blob) AS bytes FROM saves WHERE player_id = ?").bind(id).first(),
      env.DB.prepare("SELECT id, text, created_at FROM chat WHERE player_id = ? ORDER BY id DESC LIMIT 20").bind(id).all(),
      env.DB.prepare("SELECT coins, updated_at FROM wallet WHERE player_id = ?").bind(id).first().catch(() => null),
    ]);
    return json({ scores: scores.results, lifetime: life, save, chat: msgs.results, wallet });
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
    const player = str("playerId");
    // what is being cleared, so a stale client cannot post the same climb back
    const going = await env.DB.prepare(mode
      ? "SELECT mode, cm FROM scores WHERE player_id = ? AND mode = ?"
      : "SELECT mode, cm FROM scores WHERE player_id = ?").bind(...(mode ? [player, mode] : [player])).all<{ mode: string; cm: number }>();
    const clearedCm = new Map((going.results ?? []).map((r) => [r.mode, r.cm]));
    await env.DB.prepare(mode ? "DELETE FROM scores WHERE player_id = ? AND mode = ?" : "DELETE FROM scores WHERE player_id = ?").bind(...(mode ? [player, mode] : [player])).run();
    // remember the clear, or the device that set the score posts it straight back on its
    // next boot: the board heals itself from each player's local best
    await ensureScoreResets(env);
    const now = Date.now();
    for (const m of mode ? [mode] : ["crew", "solo"]) {
      await env.DB.prepare("INSERT OR REPLACE INTO score_resets (player_id, mode, at, cm) VALUES (?, ?, ?, ?)")
        .bind(player, m, now, clearedCm.get(m) ?? 0).run().catch(() => {});
    }
    return json({ ok: true });
  }
  if (path === "/rename") {
    const name = str("name", 12).replace(/[^\p{L}\p{N} _.\-!?]/gu, "").trim() || "climber";
    await env.DB.batch([
      env.DB.prepare("UPDATE scores SET name = ? WHERE player_id = ?").bind(name, str("playerId")),
      env.DB.prepare("UPDATE lifetime SET name = ? WHERE player_id = ?").bind(name, str("playerId")),
      env.DB.prepare("UPDATE chat SET name = ? WHERE player_id = ?").bind(name, str("playerId")),
      env.DB.prepare("UPDATE wallet SET name = ? WHERE player_id = ?").bind(name, str("playerId")),
      env.DB.prepare("UPDATE league SET name = ? WHERE player_id = ?").bind(name, str("playerId")),
      env.DB.prepare("UPDATE daily SET name = ? WHERE player_id = ?").bind(name, str("playerId")),
    ]);
    return json({ ok: true, name });
  }
  if (path === "/report/clear") {
    // clearing a flag is housekeeping, not a verdict: muting is a separate button
    const id = Number(body.id ?? 0), player = str("playerId");
    // marking a filter flag handled forgives the strikes too, so a player who cleans up
    // their language gets the same three before the owner hears about them again
    const row = id
      ? await env.DB.prepare("SELECT kind, target_id FROM chat_reports WHERE id = ?").bind(id).first<{ kind: string; target_id: string }>().catch(() => null)
      : { kind: "", target_id: player };
    await env.DB.prepare(id ? "DELETE FROM chat_reports WHERE id = ?" : "DELETE FROM chat_reports WHERE target_id = ?")
      .bind(id ? id : player).run().catch(() => {});
    if (row?.target_id && (!id || row.kind === "censor")) {
      await env.DB.prepare("DELETE FROM chat_censors WHERE player_id = ?").bind(row.target_id).run().catch(() => {});
    }
    return json({ ok: true });
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
input{font:inherit;padding:6px 8px;border-radius:8px;border:1px solid #333;background:#0f1216;color:#fff}.muted{opacity:.6}.n{white-space:nowrap}.id{font-family:ui-monospace,monospace;font-size:11px;opacity:.7}
.row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}#out{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;max-height:40vh;overflow:auto}
/* a board row is rank, name, metres, time, date and a button: that needs more than one grid column, and the button must never be the thing that gets clipped */
.wide{grid-column:1/-1;max-width:1200px}.board{grid-column:span 2;min-width:0}.board table{table-layout:auto}.board td:last-child{white-space:nowrap;text-align:right}
@media(max-width:760px){.board{grid-column:1/-1}}
/* chat as a list, one message per block, so a long line wraps under its own header instead of squeezing the text column */
.chat{display:flex;flex-direction:column;gap:6px}.msg{padding:8px 10px;border-radius:8px;background:#151920;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px}
.msg .who{grid-column:1;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.msg .text{grid-column:1;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.4}
.msg .acts{grid-column:2;grid-row:1/span 2;align-self:start;white-space:nowrap}.msg.new{outline:1px solid #ffb74d66}
#live{font-size:12px;opacity:.7}#live.on::before{content:"● ";color:#7bd88f}
/* the league is one table per bucket, laid side by side: a bucket is a board of its own, so each gets its own rank column */
.tiers{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}.tiers h3{margin:0 0 4px;font-size:13px;color:#7cc}
</style></head><body>
<header><b>Magnet Climbers admin</b><input id="key" type="password" placeholder="ADMIN_KEY" style="flex:1;max-width:320px"><button class="ok" onclick="saveKey()">Use key</button><button onclick="load()">Refresh</button><a href="https://magnetclimbers.com/art-archive/" target="_blank" style="color:#7cc">Art archive</a><a href="https://magnetclimbers.com/elements/" target="_blank" style="color:#7cc">Element map</a><a href="https://magnetclimbers.com/placement.html" target="_blank" style="color:#7cc">Placement</a><a href="https://magnetclimbers.com/scale.html" target="_blank" style="color:#7cc">Scale bench</a><a href="https://magnetclimbers.com/roadmap/" target="_blank" style="color:#7cc">Roadmap</a><span id="status"></span><span id="live"></span></header>
<main>
<section><h2>Stats</h2><div id="stats"></div></section>
<section><h2>Player lookup</h2><div class="row"><input id="pid" placeholder="p-xxxxxxxx" style="flex:1"><button onclick="lookup()">Look up</button></div>
<div class="row"><input id="newname" placeholder="new name" maxlength="12"><button onclick="rename()">Rename</button><button class="bad" onclick="delScore('')">Delete all scores</button><button class="bad" onclick="delScore('solo')">Delete solo</button></div>
<div class="row"><input id="lifecm" placeholder="lifetime cm" type="number"><button onclick="setLife()">Set lifetime</button><button class="bad" onclick="mute(0,true)">Mute forever + wipe chat</button><button onclick="mute(24,false)">Mute 24h</button><button onclick="unmute()">Unmute</button></div>
<div id="out"></div></section>
<section class="wide"><h2>Flagged</h2><table id="reports"></table></section>
<section class="board"><h2>Solo board</h2><table id="solo"></table></section>
<section class="board"><h2>Coins board</h2><table id="coins"></table></section>
<section class="board"><h2>Today's board <span class="muted" id="dailymeta"></span></h2><table id="daily"></table></section>
<section class="board"><h2>Lifetime board</h2><table id="lifetime"></table></section>
<section class="wide"><h2>League <span class="muted" id="leaguemeta"></span></h2><div id="league" class="tiers"></div></section>
<section class="wide"><h2>Chat <span class="muted" id="chatmeta"></span> <button class="bad" onclick="clearChat()">Clear all</button></h2><div id="mutes" class="muted"></div><div id="chat" class="chat"></div></section>
</main>
<script>
const $=(s)=>document.querySelector(s);const key=()=>localStorage.getItem("mc-admin-key")||"";
function saveKey(){localStorage.setItem("mc-admin-key",$("#key").value.trim());load();}
async function api(path,body){const r=await fetch("/admin/api"+path,{method:body?"POST":"GET",headers:{"Authorization":"Bearer "+key(),"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});const j=await r.json().catch(()=>({}));if(!r.ok){$("#status").textContent=j.error||r.status;throw new Error(j.error||r.status);}return j;}
const when=(t)=>new Date(t).toLocaleString("en-US",{timeZone:"America/Chicago",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
const esc=(s)=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
// how long the run took, next to when it happened; older rows predate the column
const took=(s)=>s?\`\${Math.floor(s/60)}m \${String(s%60).padStart(2,"0")}s\`:'<span class="muted">—</span>';
const pick=(id)=>{$("#pid").value=id;lookup();};
let load=async function(){$("#status").textContent="…";const d=await api("/overview");$("#status").textContent="ok";
$("#stats").innerHTML=\`<b>\${(d.stats.total_cm/100).toFixed(1)} m</b> over <b>\${d.stats.runs}</b> runs by <b>\${d.players}</b> climbers\`;
$("#mutes").innerHTML=d.mutes.length?"Muted: "+d.mutes.map(m=>\`<span class="id">\${esc(m.player_id)}</span> (\${m.until?"until "+when(m.until):"forever"}) <button onclick="unmute('\${esc(m.player_id)}')">unmute</button>\`).join(" · "):"No mutes.";
const newest=d.chat[0]?.id||0,fresh=lastSeen&&newest>lastSeen?d.chat.filter(m=>m.id>lastSeen).length:0;
$("#chatmeta").textContent=\`newest first · \${d.chat.length} shown\${fresh?" · "+fresh+" new":""}\`;
$("#chat").innerHTML=d.chat.map(m=>\`<div class="msg\${lastSeen&&m.id>lastSeen?" new":""}"><div class="who"><b>\${esc(m.name)}</b><span class="id" onclick="pick('\${esc(m.player_id)}')" style="cursor:pointer">\${esc(m.player_id)}</span><span class="id">\${when(m.created_at)}</span></div><div class="acts"><button class="bad" onclick="delChat(\${m.id})">del</button> <button onclick="mute(24,false,'\${esc(m.player_id)}')">mute 24h</button></div><div class="text">\${esc(m.text)}</div></div>\`).join("")||'<div class="muted">Empty</div>';
lastSeen=newest;
for(const mode of ["solo"])$("#"+mode).innerHTML=d[mode].map((r,i)=>\`<tr><td>\${i+1}</td><td><b>\${esc(r.name)}</b><br><span class="id" onclick="pick('\${esc(r.player_id)}')" style="cursor:pointer">\${esc(r.player_id)}</span></td><td class="n">\${r.cm} cm</td><td class="n">\${took(r.seconds)}</td><td class="n">\${when(r.created_at)}</td><td><button class="bad" onclick="delScoreFor('\${esc(r.player_id)}','\${mode}')">del</button></td></tr>\`).join("");
$("#reports").innerHTML=(d.reports||[]).map(r=>\`<tr><td class="n">\${when(r.created_at)}</td><td class="n"><b>\${r.kind==="block"?"BLOCK":r.kind==="censor"?"CENSORED":"REPORT"}</b> x\${r.tally}</td><td><b>\${esc(r.target_name)}</b><br><span class="id" onclick="pick('\${esc(r.target_id)}')" style="cursor:pointer">\${esc(r.target_id)}</span></td><td>\${r.text?esc(r.text):'<span class="muted">no message, just the player</span>'}</td><td class="id">\${r.kind==="censor"?"filter · "+(r.strikes||0)+" starred":"by "+esc(r.reporter_id)}</td><td class="n"><button onclick="mute(24,false,'\${esc(r.target_id)}')">mute 24h</button> <button class="bad" onclick="mute(0,true,'\${esc(r.target_id)}')">mute + wipe</button> \${r.message_id?\`<button class="bad" onclick="delChat(\${r.message_id})">del msg</button> \`:""}<button onclick="clearReport(\${r.id})">done</button></td></tr>\`).join("")||'<tr><td class="muted">Nothing flagged.</td></tr>';
$("#coins").innerHTML=(d.coins||[]).map((r,i)=>\`<tr><td>\${i+1}</td><td><b>\${esc(r.name)}</b><br><span class="id" onclick="pick('\${esc(r.player_id)}')" style="cursor:pointer">\${esc(r.player_id)}</span></td><td class="n">\${r.coins.toLocaleString()} coins</td><td class="n">\${when(r.updated_at)}</td></tr>\`).join("")||"<tr><td>Nobody has banked a coin yet.</td></tr>";
const who=(r)=>\`<td><b>\${esc(r.name)}</b><br><span class="id" onclick="pick('\${esc(r.player_id)}')" style="cursor:pointer">\${esc(r.player_id)}</span></td>\`;
$("#dailymeta").textContent=d.today||"";
$("#daily").innerHTML=(d.daily||[]).map((r,i)=>\`<tr><td>\${i+1}</td>\${who(r)}<td class="n">\${r.cm} cm</td><td class="n">\${took(r.seconds)}</td><td class="n">\${when(r.created_at)}</td></tr>\`).join("")||"<tr><td class=\\"muted\\">Nobody has climbed today's door yet.</td></tr>";
$("#lifetime").innerHTML=(d.lifetime||[]).map((r,i)=>\`<tr><td>\${i+1}</td>\${who(r)}<td class="n">\${(r.cm/100).toFixed(1)} m</td><td class="n">\${r.runs} runs</td><td class="n">\${r.updated_at?when(r.updated_at):'<span class="muted">—</span>'}</td></tr>\`).join("")||"<tr><td class=\\"muted\\">Empty</td></tr>";
// one table per bucket, highest tier first; the top and bottom ten of each move at the week's end
const tiers=d.tiers||[],groups=new Map();for(const r of d.league||[]){const k=r.tier+"/"+r.bucket;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
$("#leaguemeta").textContent=\`week \${d.week||""} · \${(d.league||[]).length} placed · \${groups.size} buckets\`;
$("#league").innerHTML=[...groups.entries()].map(([k,rows])=>{const [t,b]=k.split("/");return \`<div><h3>\${esc(tiers[t]||"Tier "+t)} · bucket \${b}</h3><table>\${rows.map((r,i)=>\`<tr><td>\${i+1}</td>\${who(r)}<td class="n">\${(r.cm/100).toFixed(1)} m</td></tr>\`).join("")}</table></div>\`;}).join("")||'<div class="muted">Nobody placed this week yet.</div>';}
async function lookup(){const id=$("#pid").value.trim();if(!id)return;$("#out").textContent=JSON.stringify(await api("/player?id="+encodeURIComponent(id)),null,1);}
async function rename(){await api("/rename",{playerId:$("#pid").value.trim(),name:$("#newname").value});load();lookup();}
async function delScore(mode){if(!confirm("Delete scores?"))return;await api("/score/delete",{playerId:$("#pid").value.trim(),mode});load();}
async function delScoreFor(id,mode){if(!confirm("Delete "+mode+" score for "+id+"?"))return;await api("/score/delete",{playerId:id,mode});load();}
async function setLife(){await api("/lifetime/set",{playerId:$("#pid").value.trim(),cm:Number($("#lifecm").value)});load();}
async function mute(hours,wipe,id){await api("/mute",{playerId:id||$("#pid").value.trim(),hours,wipe});load();}
async function unmute(id){await api("/unmute",{playerId:id||$("#pid").value.trim()});load();}
async function delChat(id){await api("/chat/delete",{id});load();}
async function clearReport(id){await api("/report/clear",{id});load();}
async function clearChat(){if(!confirm("Delete every chat message?"))return;await api("/chat/clear",{});load();}
// The game hands the key over in the link's fragment (never sent to a server), so the
// owner types it once, in the game, rather than again here on a phone keyboard.
(function(){const m=/[#&]key=([^&]+)/.exec(location.hash);if(!m)return;
try{localStorage.setItem("mc-admin-key",decodeURIComponent(m[1]));}catch(e){}
history.replaceState(null,"",location.pathname);})();
let lastSeen=0;
// The queue moves without anyone pressing Refresh. Every thirty seconds while the tab is
// visible, and straight away when it becomes visible again, with the moment it last looked
// shown in the header so a stale page never passes for a live one.
let lastLoad=0;const tick=()=>{if(!lastLoad)return;const s=Math.round((Date.now()-lastLoad)/1000);$("#live").textContent=s<5?"just now":s+"s ago";};
const _load=load;load=async function(){await _load();lastLoad=Date.now();$("#live").classList.add("on");tick();};
setInterval(()=>{if(document.visibilityState==="visible"&&key())load().catch(()=>{});},30000);setInterval(tick,1000);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&key())load().catch(()=>{});});
$("#key").value=key();if(key())load();
</script></body></html>`;
