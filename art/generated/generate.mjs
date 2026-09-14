import fs from "node:fs";
const key = process.env.GKEY, model = "gemini-2.5-flash-image";
const STYLE = `Game asset for a bright casual mobile game set on a stainless steel fridge door. Molded glossy plastic fridge-magnet toy look: chunky rounded forms, saturated colours, one soft highlight from the upper left, crisp silhouette readable at 32 px. Front-on, centered, fills 80% of the frame. No drop shadow, no text unless specified, no border, no watermark. Flat solid magenta background (#FF00FF), perfectly uniform.`;
const pickups = { coin: 'gold coin with a bold embossed "$" symbol, warm yellow-gold', gem: "faceted cyan-blue crystal gem, icy sparkle", heart: "glossy red heart, small white highlight", magnet: "classic red horseshoe magnet with silver tips", extra: "tiny orange bendy magnet-person toy curled in a ball, silver magnet hands and feet", slowmo: "round red kitchen egg timer with a white dial and black numbers", reach: "yellow retractable tape measure with a bit of metal tape pulled out" };
const obstacles = { repel: 'square red enamel magnet plate with a huge white letter "N" in the centre, glowing red rim', attract: 'square blue enamel magnet plate with a huge white letter "S" in the centre, glowing blue rim', glass: "frosted glass panel with a thin aluminium bezel, faint reflections", plastic: "matte grey plastic trim panel with subtle horizontal ribs", gap: "dark recessed gap between two fridge doors, rubber seal edges", vent: "white plastic vent grille with horizontal slats, hint of frost", dispenser: "fridge door water and ice dispenser recess: black panel, chrome lever, small blue display", calendar: "paper wall calendar page with a grid of days and a couple of pen scribbles, held by a small magnet at the top", "ice-tray": "blue plastic ice cube tray seen from above with a few clear ice cubes", handle: "long brushed stainless steel fridge door handle, horizontal, chrome end caps" };
async function gen(prompt, ratio, out) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ratio } } }) });
    const j = await r.json().catch(() => ({}));
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (r.ok && part) { fs.writeFileSync(out, Buffer.from(part.inlineData.data, "base64")); return out; }
    await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
  }
  return null;
}
const jobs = [];
for (const [id, subj] of Object.entries(pickups)) if (!fs.existsSync(`raw/pickup-${id}.png`)) jobs.push(gen(`${STYLE} Subject: ${subj}. Single object.`, "1:1", `raw/pickup-${id}.png`).then((o) => console.log(id, o ? "ok" : "FAILED")));
for (const [id, subj] of Object.entries(obstacles)) jobs.push(gen(`${STYLE} Subject: ${subj}. Wide landscape composition, the object fills the frame edge to edge horizontally.`, "16:9", `raw/obstacle-${id}.png`).then((o) => console.log(id, o ? "ok" : "FAILED")));
fs.mkdirSync("raw", { recursive: true });
await Promise.all(jobs);
