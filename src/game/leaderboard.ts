/** Thin client for the leaderboard Worker. Silent no-op when no API URL is configured. */
import { dayKeyAt } from "./day";
export interface ScoreRow {
  name: string;
  cm: number;
  /** run duration of that best, when the client sent it */
  seconds?: number | null;
  player_id: string;
  created_at: number;
}

export type Mode = "crew" | "solo";
export type BoardMode = Mode | "lifetime" | "coins" | "daily" | "league";

/**
 * The daily climb: one fridge for everybody for a Central day. The seed comes from the date alone,
 * so every device generates the same door without asking the server for it, and the board the
 * Worker keeps is the same day's.
 */
export const todayKey = (at = Date.now()): string => dayKeyAt(at);
export function dailySeed(day = todayKey()): number {
  let hash = 2166136261;
  for (let i = 0; i < day.length; i++) hash = Math.imul(hash ^ day.charCodeAt(i), 16777619);
  return (hash >>> 0) || 1;
}

/** Set VITE_LEADERBOARD_URL to the deployed Worker URL to enable the board; leave unset to play without one. */
const envUrl = ((import.meta.env.VITE_LEADERBOARD_URL as string | undefined) ?? "").trim();
export const API = envUrl === "off" ? "" : envUrl.replace(/\/$/, "");

export const leaderboardEnabled = API.length > 0;
/** Where the Worker lives, for the owner's admin panel. Empty when the board is off. */
export const apiBase = API;
/** Check an ADMIN_KEY against the Worker. Nothing is stored unless it answers. */
export async function checkAdminKey(key: string): Promise<boolean> {
  if (!API || !key) return false;
  try {
    const r = await fetch(`${API}/admin/api/overview`, { headers: { Authorization: `Bearer ${key}` } });
    return r.ok;
  } catch { return false; }
}

async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!leaderboardEnabled) return null;
  try {
    const r = await fetch(API + path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export interface GlobalStats { total_cm: number; runs: number; players: number }

export interface CloudSave { blob: string; rev: number }

/** Cloud save + device linking. All calls are no-ops when the API is not configured. */
export const cloud = {
  push: async (playerId: string, token: string, blob: string, rev: number): Promise<{ ok: true; rev: number } | { conflict: true; rev: number; blob: string } | null> => {
    if (!leaderboardEnabled) return null;
    try {
      const r = await fetch(API + "/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId, token, blob, rev }) });
      if (r.status === 409) { const j = (await r.json()) as { rev: number; blob: string }; return { conflict: true, rev: j.rev, blob: j.blob }; }
      if (!r.ok) return null;
      const j = (await r.json()) as { rev: number };
      return { ok: true, rev: j.rev };
    } catch { return null; }
  },
  pull: (playerId: string, token: string) =>
    call<CloudSave>(`/save?player=${encodeURIComponent(playerId)}`, { headers: { "X-Save-Token": token } }),
  link: (playerId: string, token: string) => call<{ code: string; expiresAt: number }>("/link", { method: "POST", body: JSON.stringify({ playerId, token }) }),
  merge: (fromId: string, fromToken: string, toId: string, toToken: string) =>
    call<{ ok: boolean }>("/merge", { method: "POST", body: JSON.stringify({ fromId, fromToken, toId, toToken }) }),
  claim: (code: string) => call<{ playerId: string; token: string; blob: string; rev: number }>("/claim", { method: "POST", body: JSON.stringify({ code }) }),
};

export const leaderboard = {
  stats: () => call<GlobalStats>("/stats"),
  /** The token proves the profile is yours; without it the Worker refuses, and used to not. */
  rename: (playerId: string, token: string, name: string) =>
    call<{ ok: boolean; name: string }>("/rename", { method: "POST", body: JSON.stringify({ playerId, token, name }) }),
  /** Adds one finished run's height to the global total. */
  /**
   * A finished run, for the lifetime board. `cm` is the increment and `total` is what this
   * device believes the lifetime is: the server adds the one and then takes the higher of the
   * two. Without the total a post that never landed -- no signal, a closed tab, a 429 -- was
   * gone for good, and nothing ever reconciled it, so the board drifted quietly below the
   * figure the player reads on their own screen and never caught up.
   */
  /** The async race: a run's tape goes up under a short id, and a link with that id brings it down. */
  race: {
    post: (playerId: string, token: string, name: string, tape: unknown) =>
      call<{ ok: boolean; id: string }>("/race", { method: "POST", body: JSON.stringify({ playerId, token, name, tape }) }),
    get: (id: string) => call<{ id: string; name: string; cm: number; seconds: number; tape: unknown }>(`/race?id=${encodeURIComponent(id)}`),
  },
  run: (playerId: string, token: string, name: string, mode: Mode, cm: number, total: number) =>
    call<{ ok: boolean }>("/run", { method: "POST", body: JSON.stringify({ playerId, token, name, mode, cm, total }) }),
  /** This week's bucket: about thirty players, the ten at the top going up and the ten at the bottom down. */
  league: (playerId: string) => call<LeagueStanding>(`/league?player=${encodeURIComponent(playerId)}`),
  top: (mode: BoardMode, limit = 25) => call<ScoreRow[]>(`/top?mode=${mode}&limit=${limit}`),
  rank: (mode: BoardMode, playerId: string) => call<{ rank: number | null; cm?: number; resetAt?: number }>(`/rank?mode=${mode}&player=${encodeURIComponent(playerId)}`),
  /** `at` is when the climb happened: a re-post of an older best keeps its own date. */
  /** A daily post carries the run's tape: the Worker climbs it again and that height is the score. */
  /** The token says the post is the player's own; the Worker refuses a post about someone else. */
  submit: (playerId: string, token: string, name: string, mode: Mode | "daily", cm: number, seconds?: number, at?: number, tape?: unknown) =>
    call<{ ok: boolean; best: number; taken?: boolean; day?: string; verified?: boolean | "pending"; reason?: string }>("/score", { method: "POST", body: JSON.stringify({ playerId, token, name, mode, cm, ...(seconds ? { seconds } : {}), ...(at ? { at } : {}), ...(tape ? { tape } : {}) }) }),
};

export interface LeagueStanding {
  week: string;
  tier: number;
  tierName: string;
  bucket: number;
  rank: number | null;
  cm?: number;
  promote: number;
  relegate: number;
  rows: ScoreRow[];
}

export interface ChatMessage { id: number; name: string; text: string; player_id: string; created_at: number; avatar?: string | null }
/** Global chat: polled while the panel is open. */
export const chat = {
  /**
   * `player` is what makes a block mean anything. Blocking used to hide a sender on the one
   * device that did it and nowhere else, so the blocked player carried on posting to the room.
   * The Worker already had the block on file; it just needed to be told who is asking.
   */
  list: (after = 0, player = "") =>
    call<{ messages: ChatMessage[]; online: number }>(`/chat?after=${after}${player ? `&player=${encodeURIComponent(player)}` : ""}`),
  /** One page of older messages, for a log scrolled back to its top. `more` is false at the start of history. */
  older: (before: number, limit = 40, player = "") =>
    call<{ messages: ChatMessage[]; more: boolean }>(`/chat?before=${before}&limit=${limit}${player ? `&player=${encodeURIComponent(player)}` : ""}`),
  /** Block or report someone. Fire and forget: blocking already took effect on the device. */
  report: async (playerId: string, token: string, kind: "block" | "report", targetId: string, messageId = 0, text = ""): Promise<void> => {
    if (!leaderboardEnabled || !token) return;
    try {
      await fetch(API + "/chat/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, token, kind, targetId, ...(messageId ? { messageId } : {}), ...(text ? { text } : {}) }),
      });
    } catch { /* a flag that does not reach the Worker still hides them here */ }
  },
  send: async (playerId: string, token: string, name: string, text: string, avatar = ""): Promise<{ ok: true; message: ChatMessage } | { error: string } | null> => {
    if (!leaderboardEnabled) return null;
    try {
      const r = await fetch(API + "/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId, token, name, text, avatar }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: ChatMessage; error?: string };
      if (r.ok && j.message) return { ok: true, message: j.message };
      return { error: r.status === 429 ? "Slow down a little" : r.status === 403 ? (j.error === "muted" ? "You are muted" : "Finish a run first, then chat") : "Could not send" };
    } catch { return null; }
  },
};
