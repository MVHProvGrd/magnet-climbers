/**
 * The live race, from the phone's side: a socket to the room and the handful of messages
 * that cross it. See worker/src/match.ts for the room.
 */
import { API, leaderboardEnabled } from "./leaderboard";
import type { Tape, TapeEvent } from "./recorder";

export interface LiveResultRow { id: string; name: string; cm: number; verified: boolean; reason?: string }

export interface LiveHandlers {
  wait(): void;
  start(seed: number, world: number, them: { id: string; name: string; look?: { creature: string; pattern: string } }, countdownMs: number): void;
  input(e: TapeEvent): void;
  ended(cm: number): void;
  left(): void;
  result(rows: LiveResultRow[], winner: string | null): void;
  /** the room refused: full, or the other phone is on another build */
  refused(why: "full" | "update"): void;
  closed(): void;
}

/** A fresh room id from the Worker, or null when live races are off. */
export async function createMatch(): Promise<string | null> {
  if (!leaderboardEnabled) return null;
  try {
    const r = await fetch(`${API}/match`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!r.ok) return null;
    const j = (await r.json()) as { id?: string };
    return j.id ?? null;
  } catch { return null; }
}

export const matchLink = (id: string) => { const u = new URL(location.href); u.search = ""; u.hash = ""; u.searchParams.set("m", id); return u.toString(); };

export class LiveMatch {
  private ws: WebSocket | null = null;
  private closedByUs = false;
  constructor(readonly id: string, private readonly on: LiveHandlers) {}

  connect(hello: { id: string; name: string; world: number; look: { creature: string; pattern: string } }): void {
    const url = `${API.replace(/^http/, "ws")}/match/${encodeURIComponent(this.id)}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ k: "hello", ...hello }));
    ws.onmessage = (ev) => {
      let m: { k: string } & Record<string, unknown>;
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.k === "wait") this.on.wait();
      else if (m.k === "start") this.on.start(m.seed as number, m.world as number, m.them as { id: string; name: string }, (m.countdownMs as number) || 3000);
      else if (m.k === "in") this.on.input(m.e as TapeEvent);
      else if (m.k === "ended") this.on.ended(m.cm as number);
      else if (m.k === "left") this.on.left();
      else if (m.k === "result") this.on.result(m.rows as LiveResultRow[], m.winner as string | null);
      else if (m.k === "full" || m.k === "update") this.on.refused(m.k);
    };
    ws.onclose = () => { if (!this.closedByUs) this.on.closed(); };
    ws.onerror = () => { /* onclose follows */ };
  }

  input(e: TapeEvent): void { this.send({ k: "in", e }); }
  finish(tape: Tape | null, cm: number): void { this.send({ k: "done", tape, cm }); }
  close(): void { this.closedByUs = true; try { this.ws?.close(); } catch { /* already */ } this.ws = null; }

  private send(m: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }
}
