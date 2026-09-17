import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// base is relative so the built bundle can be served from any sub-path
// (GitHub Pages, a Capacitor webview, or a CDN) without rebuilding.
export default defineConfig({
  base: "./",
  define: {
    __BUILD__: JSON.stringify(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date()),
    ),
  },
  server: { host: true, port: 5180 },
  // the owner-only placement workbench builds alongside the game at /placement.html
  build: { target: "es2020", sourcemap: false, rollupOptions: { input: { main: "index.html", placement: "placement.html", scale: "scale.html" } } },
  // Stop Vite walking up to the parent repo's Tailwind postcss.config.js
  css: { postcss: { plugins: [] } },
  plugins: [
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.png", "icons/*.svg"],
      manifest: {
        name: "Magnet Climbers",
        short_name: "Climbers",
        description:
          "Slingshot a team of rubbery magnet people up an endless fridge. Chain together to cross the gaps.",
        theme_color: "#1a1d24",
        background_color: "#1a1d24",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icons/toy-icon-192.png?icon-v=2", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/toy-icon-512.png?icon-v=2", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/toy-icon-maskable-512.png?icon-v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Icon revisions trigger manifest refreshes; serve the same cached PNG offline.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^icon-v$/],
        // Foley ships as mp3, not the WAV masters: 51s of PCM was 4.8 MB of install weight
          globPatterns: ["**/*.{js,css,html,png,svg,webp,woff2,mp3}"],
          // Owner reference pages, not the game. Everything under public/ is install weight
          // for every player, and neither of these is reachable from inside the game.
          globIgnores: ["elements/**", "art-archive/**"],
        navigateFallback: "index.html",
        // ...but the fallback must not swallow them. Excluding a page from the precache means
        // its navigation falls through to index.html, and the game's index is built with a
        // relative base, so its asset paths resolve under /elements/ and 404: a white page.
        navigateFallbackDenylist: [/^\/elements\//, /^\/art-archive\//],
      },
    }),
  ],
});
