import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// base is relative so the built bundle can be served from any sub-path
// (GitHub Pages, a Capacitor webview, or a CDN) without rebuilding.
export default defineConfig({
  base: "./",
  server: { host: true, port: 5180 },
  build: { target: "es2020", sourcemap: false },
  // Stop Vite walking up to the parent repo's Tailwind postcss.config.js
  css: { postcss: { plugins: [] } },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
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
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
});
