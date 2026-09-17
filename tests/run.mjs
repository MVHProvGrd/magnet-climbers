import { build } from "vite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// Reuse Vite's TS pipeline without adding a second test/transpiler dependency.
for (const entry of ["magnetism", "sample-player", "sample-engine"]) {
await build({
  configFile: false, logLevel: "warn",
  build: {
    lib: { entry: `tests/${entry}.test.ts`, formats: ["es"], fileName: () => `${entry}.test.mjs` },
    outDir: "node_modules/.cache/magnet-climbers-tests",
    rollupOptions: { external: [/^node:/] }, minify: false,
  },
});
await import(pathToFileURL(resolve(`node_modules/.cache/magnet-climbers-tests/${entry}.test.mjs`)).href);
}
