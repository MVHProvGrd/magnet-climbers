/** Thin client for the leaderboard Worker. Silent no-op when no API URL is configured. */
export interface ScoreRow {
  name: string;
  cm: number;
  player_id: string;
  created_at: number;
}

export type Mode = "crew" | "solo";

const API = (import.meta.env.VITE_LEADERBOARD_URL as string | undefined)?.replace(/\/$/, "") ?? "";

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

export const leaderboard = {
  top: (mode: Mode, limit = 25) => call<ScoreRow[]>(`/top?mode=${mode}&limit=${limit}`),
  rank: (mode: Mode, playerId: string) => call<{ rank: number | null; cm?: number }>(`/rank?mode=${mode}&player=${encodeURIComponent(playerId)}`),
  submit: (playerId: string, name: string, mode: Mode, cm: number) =>
    call<{ ok: boolean; best: number }>("/score", { method: "POST", body: JSON.stringify({ playerId, name, mode, cm }) }),
};
