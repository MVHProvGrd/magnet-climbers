/**
 * The live race, from the phone's side: a socket to the room and the handful of messages
 * that cross it. See worker/src/match.ts for the room.
 */
import { API, leaderboardEnabled } from "./leaderboard";
import type { Tape, TapeEvent } from "./recorder";

export interface LiveResultRow { id: string; name: string; cm: number; verified: boolean; reason?: string }

export type LivePlayer = { id: string; name: string; look?: { creature: string; pattern: string } };
export type LiveOther = { id: string; name: string; present: boolean };
export interface LiveHandlers {
  /** seated and waiting; `others` are the other seats and whether their phone is here */
  wait(others: LiveOther[]): void;
  /** `players` is set for a watcher: both seats, in order */
  start(seed: number, world: number, them: LivePlayer, countdownMs: number, players?: LivePlayer[]): void;
  input(e: TapeEvent, from?: string): void;
  /** the other player asked for another go */
  again(id: string): void;
  /** this phone is watching, not racing */
  watching(players: { id: string; name: string }[]): void;
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

type Hello = { id: string; name: string; world: number; look: { creature: string; pattern: string }; watch?: boolean };

export class LiveMatch {
  private ws: WebSocket | null = null;
  private closedByUs = false;
  private hello: Hello | null = null;
  /** inputs that could not go out while the socket was down; they carry their step, so late is fine */
  private outbox: unknown[] = [];
  private retries = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  constructor(readonly id: string, private readonly on: LiveHandlers) {
    // back from the messaging app: straight back in, not at the end of a backed-off timer
    document.addEventListener("visibilitychange", this.onVisible);
  }
  private readonly onVisible = () => {
    if (document.hidden || this.closedByUs || !this.hello || this.connected) return;
    if (this.retry) { clearTimeout(this.retry); this.retry = null; }
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) return;
    this.open();
  };

  connect(hello: Hello): void {
    this.hello = hello;
    this.open();
  }

  private open(): void {
    const hello = this.hello; if (!hello) return;
    const url = `${API.replace(/^http/, "ws")}/match/${encodeURIComponent(this.id)}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retries = 0;
      ws.send(JSON.stringify({ k: "hello", ...hello }));
      for (const m of this.outbox.splice(0)) ws.send(JSON.stringify(m));
    };
    ws.onmessage = (ev) => {
      let m: { k: string } & Record<string, unknown>;
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.k === "wait") this.on.wait((m.others as LiveOther[] | undefined) ?? []);
      else if (m.k === "start") this.on.start(m.seed as number, m.world as number, m.them as LivePlayer, (m.countdownMs as number) || 3000, m.players as LivePlayer[] | undefined);
      else if (m.k === "in") this.on.input(m.e as TapeEvent, m.from as string | undefined);
      else if (m.k === "ended") this.on.ended(m.cm as number);
      else if (m.k === "left") this.on.left();
      else if (m.k === "again") this.on.again(m.id as string);
      else if (m.k === "watching") this.on.watching(m.players as { id: string; name: string }[]);
      else if (m.k === "result") this.on.result(m.rows as LiveResultRow[], m.winner as string | null);
      else if (m.k === "full" || m.k === "update") this.on.refused(m.k);
    };
    // The room keeps the seat for a while; the phone tries to get back into it, a little
    // slower each time, says so after a run's worth of tries, and keeps trying every few
    // seconds after that: a host off texting the link comes back to a seat, not a dead panel.
    ws.onclose = () => {
      if (this.closedByUs || this.ws !== ws) return;
      if (this.retries === 6) this.on.closed();
      const wait = Math.min(8000, 800 * 2 ** this.retries++);
      this.retry = setTimeout(() => { if (!this.closedByUs) this.open(); }, wait);
    };
    ws.onerror = () => { /* onclose follows */ };
  }

  input(e: TapeEvent): void { this.send({ k: "in", e }); }
  finish(tape: Tape | null, cm: number): void { this.send({ k: "done", tape, cm }); }
  /** Ask for another go in the same room; the race restarts when the other phone asks too. */
  again(): void { this.send({ k: "again" }); }
  /** Back into the room as a watcher: the ghosts of both, none of your own. */
  watch(): void { if (this.hello) { this.hello = { ...this.hello, watch: true }; this.close(false); this.open(); } }
  close(forGood = true): void {
    if (forGood) { this.closedByUs = true; document.removeEventListener("visibilitychange", this.onVisible); }
    if (this.retry) { clearTimeout(this.retry); this.retry = null; }
    const ws = this.ws; this.ws = null;
    try { ws?.close(); } catch { /* already */ }
  }
  get connected(): boolean { return this.ws?.readyState === WebSocket.OPEN; }

  private send(m: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else if (this.outbox.length < 400) this.outbox.push(m);
  }
}
