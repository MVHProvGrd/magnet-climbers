// Pulled into the generated service worker (vite.config.ts, workbox.importScripts): the two
// handlers Web Push needs. The Worker sends {title, body, url, tag}; a tap opens the game on
// the page the notice is about, in the window that already has it if there is one.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: "Magnet Climbers", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Magnet Climbers";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    tag: data.tag || "magnet-climbers",
    icon: "./icons/toy-icon-192.png",
    badge: "./icons/toy-icon-192.png",
    data: { url: data.url || "./" },
    renotify: false,
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ("focus" in c) { c.navigate && c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
