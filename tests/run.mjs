import { build } from "vite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// The Worker's score-card renderer (worker/src/card.ts) pulls in a wasm module and binary
// font/image assets that only wrangler's own bundler knows how to load. worker.test.ts never
// exercises that code path, so those imports are stubbed out for the test build rather than
// dragging a wasm loader into the pipeline for code the tests never call.
const stubCardAssets = {
  name: "stub-worker-card-assets",
  enforce: "pre",
  resolveId(source) {
    if (/\.(wasm|ttf|jpg)(\?|$)/.test(source)) return "\0stub-asset:" + source;
  },
  load(id) {
    if (id.startsWith("\0stub-asset:")) return "export default new Uint8Array(0);";
  },
};

// Reuse Vite's TS pipeline without adding a second test/transpiler dependency.
const entries = {
  magnetism: {}, "sample-player": {}, "sample-engine": {}, worker: { plugins: [stubCardAssets] },
};
for (const [entry, extra] of Object.entries(entries)) {
await build({
  configFile: false, logLevel: "warn",
  plugins: extra.plugins ?? [],
  build: {
    lib: { entry: `tests/${entry}.test.ts`, formats: ["es"], fileName: () => `${entry}.test.mjs` },
    outDir: "node_modules/.cache/magnet-climbers-tests",
    rollupOptions: { external: [/^node:/] }, minify: false,
  },
});
await import(pathToFileURL(resolve(`node_modules/.cache/magnet-climbers-tests/${entry}.test.mjs`)).href);
}
