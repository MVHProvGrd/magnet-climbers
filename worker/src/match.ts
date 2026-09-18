/**
 * The live race: two players, one fridge, one Durable Object between them.
 *
 * Nothing about the climb itself crosses the wire. Both phones run the same deterministic sim
 * from the same seed; what crosses is each player's inputs -- a fling, a climb -- as they
 * happen, and the other phone feeds them to a ghost that climbs beside its own toy. When a run
 * ends the phone sends its sealed tape, the room climbs both tapes again itself, and the
 * result is what the replays say, never what either phone claimed.
 *
 * `Match` is the whole of the rules with no Cloudflare in it, so it can be tested with two
 * fake seats; `MatchRoom` is the Durable Object that hangs sockets and an alarm on one.
 */
import { checkRaceTape, replayRace, MAX_TAPE_BYTES } from "./replay";

export interface Seat {
  id: string;
  name: string;
  /** the world generator's version on that phone; both must agree or the fridges differ */
  world: number;
  look?: { creature: string; pattern: string };
  send: (m: Message) => void;
  done: boolean;
  tape?: unknown;
  claimed?: number;
  /** asked for another go after the result */
  again?: boolean;
}

/** Someone watching: gets the start, every input from both seats, and the result. */
export interface Watcher { id: string; send: (m: Message) => void }

export type Message =
  | { k: "wait"; id: string }
  | { k: "full" }
  | { k: "update" }
  | { k: "start"; seed: number; world: number; you: string; them: { id: string; name: string; look?: { creature: string; pattern: string } }; countdownMs: number;
      /** for a watcher: both seats, in order, so two ghosts can be dressed and told apart */
      players?: { id: string; name: string; look?: { creature: string; pattern: string } }[] }
  | { k: "in"; e: unknown; from?: string }
  | { k: "again"; id: string }
  | { k: "watching"; id: string; players: { id: string; name: string }[] }
  | { k: "ended"; id: string; cm: number }
  | { k: "left"; id: string }
  | { k: "result"; rows: { id: string; name: string; cm: number; verified: boolean; reason?: string }[]; winner: string | null };

/** How long the room waits for the second tape once the first is in. */
export const SETTLE_GRACE_MS = 90_000;
/** How long a dropped socket has to come back before its seat counts as left. */
export const LEAVE_GRACE_MS = 20_000;

export type Replay = (tape: unknown, seed: number, world: number) => { ok: boolean; cm: number; reason?: string };

export class Match {
  seats: Seat[] = [];
  watchers: Watcher[] = [];
  seed = 0;
  world = 0;
  started = false;
  settled = false;
  /** how many races this room has dealt, folded into the seed so a rematch in the same millisecond is still a new fridge */
  private round = 0;
  constructor(private readonly replay: Replay, private readonly random: () => number = Math.random) {}
  private deal(): number { return (Math.floor(this.random() * 0x7fffffff) ^ (Date.now() & 0xffff) ^ (++this.round * 0x9e3779b1)) >>> 0 || 1; }

  /** A third phone: it sees everything and touches nothing. */
  watch(w: Watcher): void {
    this.watchers = this.watchers.filter((x) => x.id !== w.id);
    this.watchers.push(w);
    w.send({ k: "watching", id: w.id, players: this.seats.map((s) => ({ id: s.id, name: s.name })) });
    if (this.started && !this.settled) w.send(this.startForWatcher(w));
  }

  private startForWatcher(w: Watcher): Message {
    const players = this.seats.map((s) => ({ id: s.id, name: s.name, ...(s.look ? { look: s.look } : {}) }));
    return { k: "start", seed: this.seed, world: this.world, you: w.id, them: players[0] ?? { id: "", name: "" }, countdownMs: 3000, players };
  }

  /** Both players asked for another go: the same room, a fresh seed, straight back to the count. */
  again(id: string): void {
    const seat = this.seats.find((s) => s.id === id);
    if (!seat || !this.settled) return;
    seat.again = true;
    for (const s of this.seats) if (s !== seat) s.send({ k: "again", id });
    if (!this.seats.every((s) => s.again)) return;
    for (const s of this.seats) { s.done = false; s.tape = undefined; s.claimed = undefined; s.again = false; }
    this.settled = false;
    this.seed = this.deal();
    this.started = true;
    for (const s of this.seats) s.send(this.startFor(s));
    for (const w of this.watchers) w.send(this.startForWatcher(w));
  }

  /** A player takes a seat. The second one in starts the race; a third finds the room full. */
  join(seat: Omit<Seat, "done">): void {
    if (this.settled) { seat.send({ k: "full" }); return; }
    const again = this.seats.find((s) => s.id === seat.id);
    if (again) {
      // the same player back on a fresh socket keeps their seat and, mid-race, their start
      again.send = seat.send; again.name = seat.name; again.look = seat.look;
      if (this.started) again.send(this.startFor(again));
      else again.send({ k: "wait", id: again.id });
      return;
    }
    if (this.seats.length >= 2) { seat.send({ k: "full" }); return; }
    if (this.seats.length === 1 && this.seats[0].world !== seat.world) { seat.send({ k: "update" }); return; }
    this.seats.push({ ...seat, done: false });
    if (this.seats.length < 2) { seat.send({ k: "wait", id: seat.id }); return; }
    this.world = seat.world;
    this.seed = this.deal();
    this.started = true;
    for (const s of this.seats) s.send(this.startFor(s));
    for (const w of this.watchers) w.send(this.startForWatcher(w));
  }

  private startFor(s: Seat): Message {
    const them = this.seats.find((o) => o !== s)!;
    return { k: "start", seed: this.seed, world: this.world, you: s.id, them: { id: them.id, name: them.name, ...(them.look ? { look: them.look } : {}) }, countdownMs: 3000 };
  }

  /** One input from a player, straight on to the other. Nothing is kept: the tape is the record. */
  input(id: string, e: unknown): void {
    if (!this.started || this.settled) return;
    if (!this.seats.some((s) => s.id === id)) return; // a watcher's inputs go nowhere
    for (const s of this.seats) if (s.id !== id) s.send({ k: "in", e, from: id });
    for (const w of this.watchers) w.send({ k: "in", e, from: id });
  }

  /** A run has ended; its tape is what counts. Returns true when the room now waits on the other. */
  finish(id: string, tape: unknown, claimed: number): boolean {
    const seat = this.seats.find((s) => s.id === id);
    if (!seat || !this.started || seat.done || this.settled) return false;
    seat.done = true; seat.tape = tape; seat.claimed = claimed;
    for (const s of this.seats) if (s !== seat) s.send({ k: "ended", id, cm: claimed });
    for (const w of this.watchers) w.send({ k: "ended", id, cm: claimed });
    if (this.seats.every((s) => s.done)) { this.settle(); return false; }
    return true;
  }

  /** A player gone before the end has no tape: mid-race that is a forfeit, before it a free seat. */
  leave(id: string): void {
    this.watchers = this.watchers.filter((w) => w.id !== id);
    const seat = this.seats.find((s) => s.id === id);
    if (!seat) return;
    if (!this.started) { this.seats = this.seats.filter((s) => s !== seat); return; }
    for (const s of this.seats) if (s !== seat) s.send({ k: "left", id });
    if (!seat.done) { seat.done = true; if (this.seats.every((s) => s.done)) this.settle(); }
  }

  /** The grace ran out: whoever has not sent a tape climbs nothing. */
  timeout(): void {
    if (!this.started || this.settled) return;
    this.settle();
  }

  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    const rows = this.seats.map((s) => {
      if (s.tape == null) return { id: s.id, name: s.name, cm: 0, verified: false, reason: "no tape" };
      const v = this.replay(s.tape, this.seed, this.world);
      // a claim above the replay is the replay; a claim below it stood short of the climb and keeps
      const cm = v.ok ? Math.min(v.cm, s.claimed ?? v.cm) : 0;
      return { id: s.id, name: s.name, cm, verified: v.ok, ...(v.ok ? {} : { reason: v.reason ?? "unverified" }) };
    });
    const best = Math.max(...rows.map((r) => r.cm));
    const top = rows.filter((r) => r.cm === best);
    const winner = best > 0 && top.length === 1 ? top[0].id : null;
    for (const s of this.seats) s.send({ k: "result", rows, winner });
    for (const w of this.watchers) w.send({ k: "result", rows, winner });
  }
}

/** The replay a room uses: structural checks, then the sim, on the seed and world the room set. */
export const roomReplay: Replay = (tape, seed, world) => {
  const checked = checkRaceTape(tape, seed, world);
  if ("reason" in checked) return { ok: false, cm: 0, reason: checked.reason };
  const v = replayRace(checked.tape);
  return v.ok ? { ok: true, cm: v.cm } : { ok: false, cm: 0, reason: v.reason };
};

/** The wire: one JSON message per frame, small, from a phone that already proved little. */
type Inbound =
  | { k: "hello"; id: string; name: string; world: number; look?: { creature?: unknown; pattern?: unknown }; watch?: boolean }
  | { k: "in"; e: unknown }
  | { k: "done"; tape: unknown; cm: number }
  | { k: "again" };

const NAME_RE = /[^\p{L}\p{N} _.\-!?]/gu;

/**
 * One room per match id. Sockets are plain (not hibernating): a race is minutes long and two
 * players, so the object living for it costs nothing worth the extra plumbing.
 */
export class MatchRoom {
  private readonly match = new Match(roomReplay);
  private readonly who = new Map<WebSocket, string>();
  constructor(private readonly state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    server.addEventListener("message", (ev) => this.onMessage(server, ev.data));
    const gone = () => this.onClose(server);
    server.addEventListener("close", gone);
    server.addEventListener("error", gone);
    return new Response(null, { status: 101, webSocket: client });
  }

  private onMessage(ws: WebSocket, data: unknown): void {
    if (typeof data !== "string" || data.length > MAX_TAPE_BYTES + 256) return;
    let m: Inbound;
    try { m = JSON.parse(data) as Inbound; } catch { return; }
    const send = (out: Message) => { try { ws.send(JSON.stringify(out)); } catch { /* gone */ } };
    if (m.k === "hello") {
      const id = String(m.id ?? "").slice(0, 64);
      const name = String(m.name ?? "").replace(NAME_RE, "").trim().slice(0, 12) || "a friend";
      const world = Math.floor(Number(m.world));
      if (!id || !Number.isFinite(world)) { send({ k: "full" }); return; }
      this.who.set(ws, id);
      const pending = this.leaving.get(id); if (pending) { clearTimeout(pending); this.leaving.delete(id); }
      const look = m.look && typeof m.look.creature === "string" && typeof m.look.pattern === "string"
        ? { creature: m.look.creature.slice(0, 32), pattern: m.look.pattern.slice(0, 32) } : undefined;
      // a phone that asks to watch, or a third phone at a full room, gets the watcher's view
      const seated = this.match.seats.some((s) => s.id === id);
      if (m.watch || (!seated && this.match.seats.length >= 2)) { this.match.watch({ id, send }); return; }
      this.match.join({ id, name, world, look, send });
      return;
    }
    const id = this.who.get(ws);
    if (!id) return;
    if (m.k === "again") this.match.again(id);
    if (m.k === "in") this.match.input(id, m.e);
    if (m.k === "done") {
      const waiting = this.match.finish(id, m.tape, Math.floor(Number(m.cm)) || 0);
      // the other tape has this long to arrive; after that the race settles on what is here
      if (waiting) void this.state.storage.setAlarm(Date.now() + SETTLE_GRACE_MS);
    }
  }

  private onClose(ws: WebSocket): void {
    const id = this.who.get(ws);
    this.who.delete(ws);
    if (!id || [...this.who.values()].includes(id)) return;
    // a reconnect swaps the socket under the same id; a phone that drops gets a moment to come
    // back before the room counts it as gone, and coming back cancels the count
    const t = setTimeout(() => { if (![...this.who.values()].includes(id)) this.match.leave(id); }, LEAVE_GRACE_MS);
    this.leaving.set(id, t);
  }
  private readonly leaving = new Map<string, ReturnType<typeof setTimeout>>();

  async alarm(): Promise<void> { this.match.timeout(); }
}
