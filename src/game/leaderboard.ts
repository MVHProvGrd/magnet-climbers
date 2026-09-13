/** Thin client for the leaderboard Worker. Silent no-op when no API URL is configured. */
export interface ScoreRow {
  name: string;
  cm: number;
  player_id: string;
  created_at: number;
}

export type Mode = "crew" | "solo";
export type BoardMode = Mode | "lifetime";

const DEFAULT_API = "https://magnet-climbers-api.magnetclimbers.workers.dev";
/** Override with VITE_LEADERBOARD_URL; set it to "off" to disable the board. */
const envUrl = ((import.meta.env.VITE_LEADERBOARD_URL as string | undefined) ?? "").trim();
const raw = envUrl || DEFAULT_API;
const API = raw === "off" ? "" : raw.replace(/\/$/, "");

export const leaderboardEnabled = API.length > 0;

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
  pull: (playerId: string, token: string) => call<CloudSave>(`/save?player=${encodeURIComponent(playerId)}&token=${encodeURIComponent(token)}`),
  link: (playerId: string, token: string) => call<{ code: string; expiresAt: number }>("/link", { method: "POST", body: JSON.stringify({ playerId, token }) }),
  merge: (fromId: string, fromToken: string, toId: string, toToken: string) =>
    call<{ ok: boolean }>("/merge", { method: "POST", body: JSON.stringify({ fromId, fromToken, toId, toToken }) }),
  claim: (code: string) => call<{ playerId: string; token: string; blob: string; rev: number }>("/claim", { method: "POST", body: JSON.stringify({ code }) }),
};

export const leaderboard = {
  stats: () => call<GlobalStats>("/stats"),
  rename: (playerId: string, name: string) =>
    call<{ ok: boolean; name: string }>("/rename", { method: "POST", body: JSON.stringify({ playerId, name }) }),
  /** Adds one finished run's height to the global total. */
  run: (playerId: string, name: string, mode: Mode, cm: number) =>
    call<{ ok: boolean }>("/run", { method: "POST", body: JSON.stringify({ playerId, name, mode, cm }) }),
  top: (mode: BoardMode, limit = 25) => call<ScoreRow[]>(`/top?mode=${mode}&limit=${limit}`),
  rank: (mode: BoardMode, playerId: string) => call<{ rank: number | null; cm?: number }>(`/rank?mode=${mode}&player=${encodeURIComponent(playerId)}`),
  submit: (playerId: string, name: string, mode: Mode, cm: number) =>
    call<{ ok: boolean; best: number }>("/score", { method: "POST", body: JSON.stringify({ playerId, name, mode, cm }) }),
};
