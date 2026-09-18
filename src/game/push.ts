/**
 * Reminders, from the phone's side: ask the browser, hand the subscription to the Worker.
 * Works in a browser tab on Android and desktop, and in an installed app on iOS 16.4+.
 */
import { API, leaderboardEnabled } from "./leaderboard";

export const pushSupported = (): boolean =>
  leaderboardEnabled && typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

const toB64url = (b: ArrayBuffer | null): string => b ? btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";
const fromB64url = (s: string): Uint8Array => {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad), (c) => c.charCodeAt(0));
};

/** Ask, subscribe, and register with the Worker. "denied" when the browser said no; "off" when reminders are not switched on server-side. */
export async function enableReminders(playerId: string, token: string): Promise<"on" | "denied" | "off" | "failed"> {
  if (!pushSupported()) return "failed";
  const keyRes = await fetch(`${API}/push/key`).catch(() => null);
  if (!keyRes || keyRes.status === 503) return "off";
  const { key } = (await keyRes.json().catch(() => ({}))) as { key?: string };
  if (!key) return "off";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(key) as BufferSource });
  const body = { playerId, token, endpoint: sub.endpoint, p256dh: toB64url(sub.getKey("p256dh")), auth: toB64url(sub.getKey("auth")) };
  const r = await fetch(`${API}/push/subscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return r?.ok ? "on" : "failed";
}

export async function disableReminders(playerId: string, token: string): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (sub) {
    await fetch(`${API}/push/unsubscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId, token, endpoint: sub.endpoint }) }).catch(() => null);
    await sub.unsubscribe().catch(() => false);
  }
}
