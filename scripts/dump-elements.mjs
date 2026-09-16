// Dumps every in-game element straight from the source of truth, so a reference page
// cannot drift from the code. Run: node scripts/dump-elements.mjs > elements.json
import { build } from "vite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";

const entry = resolve("node_modules/.cache/mc-elements-entry.ts");
writeFileSync(entry, `
export { FRIDGE_ITEMS } from ${JSON.stringify(resolve("src/game/items.ts"))};
export { CREATURES, PATTERNS, unlockText } from ${JSON.stringify(resolve("src/game/creatures.ts"))};
export { CFG, CLIMBER_COLORS, SHOP_ENABLED, EXPEDITIONS_ENABLED } from ${JSON.stringify(resolve("src/game/config.ts"))};
export { howToSections, boostItems, hazardItems } from ${JSON.stringify(resolve("src/game/how-to-play.ts"))};
`);

await build({
  configFile: false, logLevel: "warn",
  build: {
    lib: { entry, formats: ["es"], fileName: () => "elements.mjs" },
    outDir: "node_modules/.cache/mc-elements", rollupOptions: { external: [/^node:/] }, minify: false,
  },
});

const m = await import(pathToFileURL(resolve("node_modules/.cache/mc-elements/elements.mjs")).href);
const out = {
  config: {
    dangerCm: m.CFG.dangerCm, handWarn: m.CFG.handWarn, handFirstAfter: m.CFG.handFirstAfter,
    handIntervalBase: m.CFG.handIntervalBase, handIntervalMin: m.CFG.handIntervalMin,
    comboChance: m.CFG.comboChance, maxHp: m.CFG.maxHp, maxDrag: m.CFG.maxDrag, pxPerCm: m.CFG.pxPerCm,
    shopEnabled: m.SHOP_ENABLED, expeditionsEnabled: m.EXPEDITIONS_ENABLED,
    palette: m.CLIMBER_COLORS.length,
  },
  items: m.FRIDGE_ITEMS.map((i) => ({
    id: i.id, name: i.name, family: i.family, description: i.description,
    power: i.power ?? null, kind: i.kind ?? null, metal: !!i.metal, hazard: !!i.hazard,
    behavior: i.behavior ?? null, theme: i.theme ?? null,
  })),
  creatures: m.CREATURES.map((c) => ({ id: c.id, name: c.name, blurb: c.blurb, detail: c.detail, unlock: m.unlockText(c.unlock) })),
  patterns: m.PATTERNS.map((p) => ({ id: p.id, name: p.name })),
  howTo: m.howToSections().map((s) => ({ title: s.title, blurb: s.blurb ?? null, rows: s.rows.map((r) => ({ name: r.name, text: r.text, count: r.count ?? null })) })),
};
process.stdout.write(JSON.stringify(out, null, 1));
