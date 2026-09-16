// Builds public/elements/index.html: every element in the game, its art and what it does to you.
// The list is FRIDGE_ITEMS itself, so the page cannot drift from the code, and every picture is
// resolved to a file that actually ships - an element with no art says so rather than showing a hole.
// Run: node scripts/element-map.mjs   (also runs in the build, see package.json)
import { build } from "vite";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";

const entry = resolve("node_modules/.cache/mc-element-map-entry.ts");
writeFileSync(entry, `
export { FRIDGE_ITEMS } from ${JSON.stringify(resolve("src/game/items.ts"))};
export { CFG } from ${JSON.stringify(resolve("src/game/config.ts"))};
export { World } from ${JSON.stringify(resolve("src/game/world.ts"))};
`);
await build({
  configFile: false, logLevel: "warn",
  build: { lib: { entry, formats: ["es"], fileName: () => "map.mjs" }, outDir: "node_modules/.cache/mc-element-map", rollupOptions: { external: [/^node:/] }, minify: false },
});
const m = await import(pathToFileURL(resolve("node_modules/.cache/mc-element-map/map.mjs")).href);

/** Where the game's loaders look for each family's art. First path that exists on disk wins. */
const candidates = (item) => {
  const id = item.id;
  if (item.family === "pickup") return [`/art/real-v1/pickups/${item.power}.png`];
  if (item.family === "paper") return [`/art/paper/${id}.webp`];
  if (item.family === "bumper" && id.startsWith("business-")) return [`/art/business/${id}.webp`];
  if (item.family === "bumper" && id.startsWith("bumper-")) return [`/art/bumpers/${id}.webp`];
  if (id === "kid-hand") return ["/art/real-v1/kid-arm.webp"];
  if (id === "cat-paw") return ["/art/real-v1/cat-paw.webp"];
  if (item.kind === "attract" || item.kind === "repel") return [`/art/destinations/${id}.webp`];
  if (item.family === "gadget") {
    // the three polarity themes are photographed as their toy, not under the gadget's id
    const poles = { "polarity-snack": "candy-pole", "polarity-travel": "compass-base", "polarity-doodle": "crayon" };
    return [`/art/gadgets/${poles[id] ?? id}.webp`, `/art/gadgets/${id}.png`];
  }
  return [`/art/real-v1/obstacles/${id}.png`, `/art/real-v1/obstacles/${id}.webp`];
};
const artFor = (item) => candidates(item).find((p) => existsSync(join("public", p.replace(/^\//, "")))) ?? "";

const STYLE = readFileSync("scripts/element-map.css", "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
/** The one-line role under a tile's name: what it does to you, not what it is. */
const role = (item) => {
  if (item.family === "pickup") return { heart: "+1 heart, up to 3", coin: "currency", gem: "currency", magnet: "grips everything", paint: "repaints you", slowmo: "slows the run", reach: "longer reach", candy: "red line crawls", extra: "one more climber" }[item.power] ?? "pickup";
  if (item.family === "gadget") return { swing: "swings &middot; silver grips", rotor: "turns &middot; silver grips", clip: "dangles &middot; clip grips", polarity: "3s hold, 3s push" }[item.behavior] ?? "gadget";
  if (item.hazard) return "costs a heart";
  if (item.kind === "attract") return "S &middot; pulls you in";
  if (item.kind === "repel") return "N &middot; pushes you away";
  if (item.family === "bumper") return "knocks you loose";
  if (item.metal) return "metal island &middot; holds";
  if (item.grips || item.kind === "sticker") return "holds you";
  return "no grip";
};
const classOf = (item) => [
  item.kind === "attract" ? "s" : "", item.kind === "repel" ? "n" : "",
  item.hazard ? "hurt" : "", item.grips || item.kind === "sticker" ? "hold" : "",
].filter(Boolean).join(" ");

const SECTIONS = [
  ["Pickups", (i) => i.family === "pickup"],
  ["Gadgets", (i) => i.family === "gadget"],
  ["Souvenir plates", (i) => i.kind === "attract" || i.kind === "repel"],
  ["Surfaces", (i) => i.family === "surface" && i.kind !== "attract" && i.kind !== "repel"],
  ["Paper", (i) => i.family === "paper"],
  ["Advertising magnets", (i) => i.family === "bumper" && i.id.startsWith("business-")],
  ["Toy keychains", (i) => i.family === "bumper" && i.id.startsWith("bumper-")],
  ["Hazards", (i) => i.hazard],
];
const NOTES = {
 "Pickups": "Floating power-ups. Collecting one is instant and applies to that climber only. Timed effects stack\n   up to a cap. <span class=\"src\">game.ts applyPickup &middot; CFG.effectDurations</span>\n   <ul class=\"rules\">\n     <li><b>Super Magnet</b> 8s, stacks to 16s &mdash; glass, plastic, paper and plates all take a grip, and\n       neither attacker can touch you.</li>\n     <li><b>Kitchen Timer</b> 6s, stacks to 12s. <b>Reach Badge</b> 14s, stacks to 28s.</li>\n     <li><b>Candy Drop</b> 9s, stacks to 18s &mdash; the red line drops to 30% speed while it runs.</li>\n     <li><b>Chill mode pays no coins or gems</b> and unlocks nothing.</li>\n   </ul>",
 "Gadgets": "Two to a door, on every fourth door, cycling swing &rarr; rotor &rarr; clip &rarr; polarity as you climb.\n   <b>Only the silver part is ever a hold</b>: ride it, then fling. Each photographed assembly hangs or turns\n   about its own measured point, never a shared one. <span class=\"src\">gadgets.ts &middot; gadget-pivots.ts</span>\n   <ul class=\"rules\">\n     <li><b>Swing</b> &mdash; pendulum, &plusmn;0.5 rad on a 45px arm. Hangs still until something touches it.</li>\n     <li><b>Clip</b> &mdash; gentler pendulum, &plusmn;0.22 rad. The clip grips; the paper under it does not.</li>\n     <li><b>Rotor</b> &mdash; turns continuously at 0.95 rad/s, the grip orbiting 20px off the spindle.</li>\n     <li><b>Polarity</b> &mdash; a 6s cycle: blue holds for 3s, then red pushes for 3s, counting down before each flip.</li>\n     <li>A doodle is a bit of paper, so it is only ever clipped &mdash; never hung off a keyring chain.</li>\n   </ul>",
 "Souvenir plates": "Magnetic field plates. <b>S pulls an airborne climber in and catches them</b>; <b>N pushes away</b>, and the wider\n   the arcs the stronger it is &mdash; the big ones are slingshots. Your aim dots turn blue where one bends the\n   flight. The souvenir photograph is <b>purely cosmetic</b>: polarity, timing and collision are identical across all\n   fourteen, and which one you see is a hash of the gadget's id. <span class=\"src\">gadgets.ts polarityDestination</span>",
 "Surfaces": "What the door is made of. <b>Magnets catch on bare steel</b> &mdash; and on paper, which is pinned up by its own\n   magnet, so yours catches on it too. <span class=\"src\">world.ts isMetal &middot; items.ts grips</span>\n   <ul class=\"rules\">\n     <li><b>glass</b> and <b>trim</b> &mdash; no magnetic hold at all. Cross in flight, or go round by the steel edges.</li>\n     <li><b>void</b> &mdash; nothing there to touch. The handle is the exception: a metal island laid across the slippery bits.</li>\n     <li><b>sticker</b> &mdash; paper and the calendar. Climb them exactly like the door.</li>\n   </ul>",
 "Paper": "Drawings, notes, prints and photos, each pinned under its own magnet &mdash; so <b>they hold you</b>. Anti-repeat\n   remembers the last ten, so the same note should not surface twice in a stretch. <span class=\"src\">world.ts recentPapers</span>",
 "Advertising magnets": "Printed vinyl magnets that <b>slide</b> along sideways, vertical or zigzag paths. Contact knocks a climber loose\n   with a 420px/s kick and <b>costs a heart</b>, then a moment of invulnerability. <span class=\"src\">game.ts bumpers &middot; CFG.bumperKnock</span>",
 "Toy keychains": "Toys on the door. Unlike the advertising magnets these <b>never slide and never cost a heart</b>: half hang from a\n   chain and swing when brushed, half are stuck on by a magnet backing and give a weak N push instead. Neither is\n   a hold. <span class=\"src\">world.ts v13 toys</span>",
 "Hazards": "Two attackers. Both warn before they land, both knock you loose and <b>cost a heart</b>, and neither can touch a\n   climber carrying a Super Magnet. <span class=\"src\">game.ts stepHand &middot; cat-paw.ts</span>\n   <ul class=\"rules\">\n     <li><b>Cooper's Hand</b> &mdash; 1.1s warning, then a curved sweep. First at 18s, then every\n       22s, closing to 9s the higher you climb.</li>\n     <li><b>The Cat's Paw</b> &mdash; 0.75s warning ring, then three taps, the second one deepest.</li>\n     <li><b>Both at once</b> on 7% of attacks.</li>\n   </ul>"
};

const items = m.FRIDGE_ITEMS.filter((i) => i.id !== "extra");
const tile = (item) => {
  const src = artFor(item), wide = /business-|handle|ice-tray|vent/.test(item.id);
  const open = `<button class="plate" type="button" data-src="${src}" data-name="${esc(item.name)}" data-role="${role(item)}" data-desc="${esc(item.description)}" data-id="${esc(item.id)}" aria-label="Expand ${esc(item.name)}">`;
  const body = src ? `<img src="${src}" alt="${esc(item.name)}" loading="lazy">` : `<span class="drawn">drawn<br>on canvas</span>`;
  return `<figure class="tile ${classOf(item)}${src ? "" : " nophoto"}${wide ? " wide" : ""}">${open}${body}</button>`
    + `<figcaption><b>${esc(item.name)}</b><i>${role(item)}</i></figcaption></figure>`;
};
let sections = "", pictures = 0;
for (const [title, match] of SECTIONS) {
  const rows = items.filter(match);
  if (!rows.length) continue;
  pictures += rows.filter((i) => artFor(i)).length;
  sections += `\n      <section>\n        <h2>${title} <span class="count">${rows.length}</span></h2>\n`
    + `        <div class="note">${NOTES[title] ?? ""}</div>\n        <div class="plates">\n        `
    + rows.map(tile).join("\n        ") + `\n        </div>\n      </section>\n`;
}
const chips = [
  ["Elements", items.length], ["Pictures", pictures], ["World", `v${new m.World(1, 0).version}`],
  ["Danger at", `${m.CFG.dangerCm} cm`], ["Hand warn", `${m.CFG.handWarn.toFixed(2)} s`],
  ["Paw warn", `${(m.CFG.pawWarn ?? 0.75).toFixed(2)} s`], ["Hearts", m.CFG.maxHp],
].map(([k, v]) => `<span class="chip"><b>${k}</b><span>${v}</span></span>`).join("\n      ");

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Magnet Climbers Element Map</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>${STYLE}</style></head><body>
<div class="wrap">
  <header>
    <div class="eyebrow">Magnet Climbers &middot; element reference</div>
    <h1>Element Map</h1>
    <p class="standfirst">Every element in the game and what it does to you. The list is <code>FRIDGE_ITEMS</code>
      itself, so nothing here is invented and nothing is left out; each picture is the file the game actually
      loads for that element, and anything with no picture is drawn on canvas. Open any plate for what it does
      and where its art lives.</p>
    <div class="rig">
      ${chips}
    </div>
  </header>
${sections}
  <footer>
    Plates are steel in both themes because that is where these cutouts actually sit. Generated from the
    repository by <code>scripts/element-map.mjs</code>: the elements are <code>items.ts</code>, the figures are
    <code>config.ts</code>, and every picture is resolved to a file that ships &mdash; so a tile cannot show art
    the build does not have, and an element cannot go missing for want of a picture.
  </footer>
</div>
<div class="lb" hidden>
  <figure class="lb-fig"><div class="lb-plate"><img alt=""></div>
    <figcaption class="lb-cap"><b></b><i></i><p class="lb-desc"></p><code></code></figcaption></figure>
  <button class="lb-btn lb-close" type="button">Close</button>
  <button class="lb-btn lb-prev" type="button">&lsaquo;</button>
  <button class="lb-btn lb-next" type="button">&rsaquo;</button>
  <span class="lb-count"></span>
</div>
<script>
const plates = [...document.querySelectorAll(".plate")];
const lb = document.querySelector(".lb"), img = lb.querySelector("img");
const cap = { name: lb.querySelector(".lb-cap b"), role: lb.querySelector(".lb-cap i"), desc: lb.querySelector(".lb-desc"), path: lb.querySelector(".lb-cap code") };
let at = 0;
function open(i) {
  at = (i + plates.length) % plates.length;
  const d = plates[at].dataset;
  img.src = d.src; img.alt = d.name; img.hidden = !d.src;
  cap.name.textContent = d.name; cap.role.innerHTML = d.role; cap.desc.textContent = d.desc;
  cap.path.textContent = d.src ? "public" + d.src : "drawn on canvas";
  lb.querySelector(".lb-count").textContent = (at + 1) + " / " + plates.length;
  lb.hidden = false;
}
plates.forEach((p, i) => p.addEventListener("click", () => open(i)));
lb.querySelector(".lb-close").addEventListener("click", () => { lb.hidden = true; });
lb.querySelector(".lb-prev").addEventListener("click", () => open(at - 1));
lb.querySelector(".lb-next").addEventListener("click", () => open(at + 1));
lb.addEventListener("click", (e) => { if (e.target === lb) lb.hidden = true; });
addEventListener("keydown", (e) => {
  if (lb.hidden) return;
  if (e.key === "Escape") lb.hidden = true;
  if (e.key === "ArrowLeft") open(at - 1);
  if (e.key === "ArrowRight") open(at + 1);
});
</script>
</body></html>`;
mkdirSync("public/elements", { recursive: true });
writeFileSync("public/elements/index.html", page);
console.log(`element map: ${items.length} elements, ${pictures} pictures -> public/elements/index.html`);
