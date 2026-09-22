import { build } from "vite"; import { pathToFileURL } from "node:url"; import { resolve } from "node:path";
await build({ configFile: false, logLevel: "warn", build: { lib: { entry: "tests/band-probe.ts", formats: ["es"], fileName: () => "band-probe.mjs" }, outDir: "node_modules/.cache/magnet-climbers-tests", rollupOptions: { external: [/^node:/] }, minify: false } });
await import(pathToFileURL(resolve("node_modules/.cache/magnet-climbers-tests/band-probe.mjs")).href);
