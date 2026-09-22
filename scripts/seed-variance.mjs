// Builds tests/seed-variance.ts with Vite's TS pipeline and runs it. Env: SEEDS (default 60).
import { build } from "vite"; import { pathToFileURL } from "node:url"; import { resolve } from "node:path";
await build({ configFile: false, logLevel: "warn", build: { lib: { entry: "tests/seed-variance.ts", formats: ["es"], fileName: () => "seed-variance.mjs" }, outDir: "node_modules/.cache/magnet-climbers-tests", rollupOptions: { external: [/^node:/] }, minify: false } });
await import(pathToFileURL(resolve("node_modules/.cache/magnet-climbers-tests/seed-variance.mjs")).href);
