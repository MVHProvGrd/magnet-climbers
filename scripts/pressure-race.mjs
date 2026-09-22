// Builds tests/pressure.ts with Vite's TS pipeline (as tests/run.mjs does) and runs it.
// Env: API (worker URL), ROUNDS (default 10), SPEED (sim speed, default 6), OUT (json path).
import { build } from "vite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await build({
  configFile: false, logLevel: "warn",
  build: {
    lib: { entry: "tests/pressure.ts", formats: ["es"], fileName: () => "pressure.mjs" },
    outDir: "node_modules/.cache/magnet-climbers-tests",
    rollupOptions: { external: [/^node:/] }, minify: false,
  },
});
await import(pathToFileURL(resolve("node_modules/.cache/magnet-climbers-tests/pressure.mjs")).href);
