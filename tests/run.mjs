import { build } from "vite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// Reuse Vite's TS pipeline without adding a second test/transpiler dependency.
await build({
  configFile: false, logLevel: "warn",
  build: {
    lib: { entry: "tests/magnetism.test.ts", formats: ["es"], fileName: () => "magnetism.test.mjs" },
    outDir: "node_modules/.cache/magnet-climbers-tests",
    rollupOptions: { external: [/^node:/] }, minify: false,
  },
});
await import(pathToFileURL(resolve("node_modules/.cache/magnet-climbers-tests/magnetism.test.mjs")).href);
