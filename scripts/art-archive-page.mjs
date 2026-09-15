// Builds public/art-archive/index.html: one page showing every set in art/archive, images served from GitHub raw.
import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
const RAW = "https://raw.githubusercontent.com/MVHProvGrd/magnet-climbers/main/art/archive/";
const root = "art/archive";
const readme = await readFile(join(root, "README.md"), "utf8");
const notes = Object.fromEntries([...readme.matchAll(/^\| `([^`]+)\/` \| (.+?) \| (.+?) \| (.+?) \|$/gm)].map((m) => [m[1], { what: m[2], from: m[3], live: m[4] }]));
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && e.name !== 'frames') out.push(...await walk(p));
    else if (/\.(png|jpe?g|webp|gif)$/i.test(e.name)) out.push(p);
  }
  return out.sort();
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
let sections = "";
for (const set of (await readdir(root)).filter((n) => /^\d\d-/.test(n)).sort()) {
  const files = await walk(join(root, set));
  const n = notes[set] ?? { what: "", from: "", live: "" };
  const sheets = files.filter((f) => /sheet/.test(f)), rest = files.filter((f) => !/sheet/.test(f));
  const relPath = (f) => f.slice(root.length + 1).replaceAll('\\', '/');
  const tile = (f) => { const rel = relPath(f); return `<a class="t" href="${RAW}${rel}" target="_blank"><img loading="lazy" src="${RAW}${rel}" alt="${esc(rel)}"><span>${esc(rel.slice(set.length + 1))}</span></a>`; };
  sections += `<section id="${set}"><h2>${esc(set)} <small>${files.length} files</small></h2><p>${esc(n.what)}</p><p class="meta"><b>From:</b> ${esc(n.from)} · <b>Live in:</b> ${esc(n.live)}</p>
${sheets.map((f) => `<a href="${RAW}${relPath(f)}" target="_blank"><img class="sheet" loading="lazy" src="${RAW}${relPath(f)}"></a>`).join("")}
<div class="grid">${rest.map(tile).join("")}</div></section>`;
}
const toc = (await readdir(root)).filter((n) => /^\d\d-/.test(n)).sort().map((s) => `<a href="#${s}">${s}</a>`).join(" · ");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Magnet Climbers art archive</title>
<style>body{margin:0;background:#14171c;color:#eee;font:14px system-ui,sans-serif;padding:16px}h1{margin:0 0 6px}h2{margin:32px 0 6px}small{color:#9aa;font-weight:normal}p{margin:4px 0;color:#cfd6dd}.meta{color:#9aa}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:10px}.t{display:block;background:#1e2229;border-radius:8px;padding:6px;text-decoration:none;color:#bcc}
.t img{width:100%;aspect-ratio:1;object-fit:contain;background:repeating-conic-gradient(#2a2f37 0 25%,#232830 0 50%) 0 0/16px 16px;border-radius:4px}.t span{display:block;font-size:11px;margin-top:4px;word-break:break-all}
.sheet{max-width:100%;border-radius:8px;margin-top:8px;background:#c9d1d8}nav{color:#9aa;margin-bottom:8px}nav a,.t:hover{color:#7cc}</style></head><body>
<h1>Art archive</h1><p>Every art style so far. Images load from the GitHub repo (<code>art/archive</code>); click any to open full size. <a href="https://github.com/MVHProvGrd/magnet-climbers/tree/main/art/archive" style="color:#7cc">README with restore steps</a>.</p>
<p><a href="cat-paw-v2/" style="color:#7cc">Cat paw v2: corrected back view, claws and fading scratches</a> · <a href="cat-paw-v1/" style="color:#7cc">Old underside study</a> · <a href="pop-it-v1/" style="color:#7cc">POP! magnet: click individual bubbles with sound</a></p>
<p><a href="motion-v1/" style="color:#7cc">Animation review: bump the lemon, compare arm swipes and reach badges</a></p>
<p><a href="souvenirs-v1/" style="color:#7cc">New souvenir pack: animated field, compass and split-door review</a></p>
<nav>${toc}</nav>${sections}<script>
if(location.protocol==='file:') document.querySelectorAll('[src],[href]').forEach(el=>{
  for(const attr of ['src','href']){const value=el.getAttribute(attr);if(value?.startsWith('${RAW}'))el.setAttribute(attr,'../../art/archive/'+value.slice('${RAW}'.length).replaceAll('\\\\','/'));}
});
</script></body></html>`;
await mkdir("public/art-archive", { recursive: true });
await writeFile("public/art-archive/index.html", html);
console.log("wrote public/art-archive/index.html", (await stat("public/art-archive/index.html")).size, "bytes");
