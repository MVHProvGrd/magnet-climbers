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
        // the push handlers ride along in the generated worker (public/push-sw.js)
        importScripts: ["push-sw.js"],
        // Icon revisions trigger manifest refreshes; serve the same cached PNG offline.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^icon-v$/],
        // Everything precached downloads the instant the worker installs, competing for the
        // pipe with whatever the player is actually looking at. Two things have to be there
        // before the game can start: the code, and the menu it opens on. The rest of the
        // door -- gadgets, paper, destinations, the photographic props, nearly eight
        // megabytes of it -- is cached below as it is genuinely asked for, so a first launch
        // downloads a menu instead of a catalogue and a second launch is already offline.
        globPatterns: [
          "**/*.{js,css,html,svg,woff2}",
          "icons/*.png",
          "art/ui/*.webp", "art/title-logo.webp", "art/title-fridge.webp",
        ],
        // Toy-keyring art, not the game's own menu flow -- not reachable from inside the
        // game, so it shouldn't hold up a first launch just because it ships in public/.
        globIgnores: ["elements/**"],
        runtimeCaching: [
          {
            // Art never changes under a name: a re-cut ships as -v2. So the cache is the
            // truth once a file is in it, and a repeat sighting costs no network at all.
            urlPattern: ({ url }) => /\/art\/.*\.(webp|png|svg)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "mc-art",
              // comfortably above the 171 art files that exist, so a long session never
              // evicts something it is about to draw again, and a year because a re-cut
              // ships under a new name rather than replacing an old one
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Foley is smaller than the art but the same argument applies: a sound the
            // player has never triggered should not hold up the menu.
            urlPattern: ({ url }) => /\.mp3$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "mc-audio",
              // above the ~110 foley files, for the same reason: a cap under the real
              // count turns the cache into a queue that re-downloads what it just dropped
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: "index.html",
        // ...but the fallback must not swallow them. Excluding a page from the precache means
        // its navigation falls through to index.html, and the game's index is built with a
        // relative base, so its asset paths resolve under /elements/ and 404: a white page.
        navigateFallbackDenylist: [/^\/elements\//],
      },
    }),
  ],
});
