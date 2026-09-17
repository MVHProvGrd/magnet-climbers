import { build } from "vite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// The Worker's score-card renderer (worker/src/card.ts) pulls in a wasm module and binary
// font/image assets that only wrangler's own bundler knows how to load. worker.test.ts never
// exercises that code path, so those imports are stubbed out for the test build rather than
// dragging a wasm loader into the pipeline for code the tests never call.
//
// @resvg/resvg-wasm is stubbed by name for a second reason: it lives in worker/node_modules,
// which the root `npm ci` does not install. Left unstubbed, the Worker bundle fails to
// resolve it and the whole entry is dropped -- and because the failure lands after the other
// entries have passed, the run still reports every test green while silently testing eight
// fewer things than it says. A build that cannot see a test must not look like one that ran.
const stubCardAssets = {
  name: "stub-worker-card-assets",
  enforce: "pre",
  resolveId(source) {
    if (/\.(wasm|ttf|jpg)(\?|$)/.test(source)) return "\0stub-asset:" + source;
    if (source === "@resvg/resvg-wasm") return "\0stub-resvg";
  },
  load(id) {
    if (id.startsWith("\0stub-asset:")) return "export default new Uint8Array(0);";
    // only the names card.ts imports, each throwing rather than pretending to render
    if (id === "\0stub-resvg") return `
      const nope = () => { throw new Error("resvg is stubbed in tests: card rendering is not covered here"); };
      export const initWasm = nope, Resvg = class { constructor() { nope(); } };
      export default { initWasm, Resvg };`;
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
