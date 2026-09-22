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
  /** a socket is attached; false while the phone is away (backgrounded to send the link, say) */
  present?: boolean;
  done: boolean;
  tape?: unknown;
  claimed?: number;
  /** asked for another go after the result */
  again?: boolean;
  /** the height the phone last reported in a heartbeat */
  cm?: number;
  /** every input so far this race, for a phone that joins or comes back mid-race to rebuild the ghost from */
  inputs?: unknown[];
  /** when the room last told this seat the other run had ended, so a still-climbing phone is reminded, not spammed */
  toldAt?: number;
}

/** Someone watching: gets the start, every input from both seats, and the result. */
export interface Watcher { id: string; send: (m: Message) => void }

export type Message =
  | { k: "wait"; id: string;
      /** who else holds a seat, and whether their phone is here right now */
      others?: { id: string; name: string; present: boolean }[] }
  | { k: "full" }
  | { k: "update" }
  | { k: "start"; seed: number; world: number; you: string; them: { id: string; name: string; look?: { creature: string; pattern: string } }; countdownMs: number;
      /** which door you start on: seat 0 the left, seat 1 the right */
      side: 0 | 1;
      /** for a watcher: both seats, in order, so two ghosts can be dressed and told apart */
      players?: { id: string; name: string; look?: { creature: string; pattern: string } }[] }
  | { k: "in"; e: unknown; from?: string }
  | { k: "again"; id: string }
  | { k: "watching"; id: string; players: { id: string; name: string }[] }
  | { k: "ended"; id: string; cm: number }
  | { k: "left"; id: string; name?: string }
  /** a seat's inputs so far, for a ghost built from nothing mid-race */
  | { k: "catchup"; id: string; events: unknown[] }
  | { k: "result"; rows: { id: string; name: string; cm: number; verified: boolean; reason?: string }[]; winner: string | null };

/** How long the room waits for the second tape once the first is in. */
export const SETTLE_GRACE_MS = 90_000;
/** How long a dropped socket has to come back before its seat counts as left, mid-race. */
export const LEAVE_GRACE_MS = 20_000;
/**
 * Before the start a seat is held far longer: the host backgrounds the game to text the link,
 * which drops the socket, and the friend may take minutes to open it.
 */
export const LOBBY_HOLD_MS = 10 * 60_000;

export type Replay = (tape: unknown, seed: number, world: number, side: 0 | 1) => { ok: boolean; cm: number; reason?: string };

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
    if (this.started && !this.settled) {
      w.send(this.startForWatcher(w));
      // a late watcher sees the race so far, not two toys at the bottom
      for (const s of this.seats) w.send({ k: "catchup", id: s.id, events: s.inputs ?? [] });
    }
  }

  private startForWatcher(w: Watcher): Message {
    const players = this.seats.map((s) => ({ id: s.id, name: s.name, ...(s.look ? { look: s.look } : {}) }));
    return { k: "start", seed: this.seed, world: this.world, you: w.id, them: players[0] ?? { id: "", name: "" }, countdownMs: 3000, side: 0, players };
  }

  /** Both players asked for another go: the same room, a fresh seed, straight back to the count. */
  again(id: string): void {
    const seat = this.seats.find((s) => s.id === id);
    if (!seat || !this.settled) return;
    seat.again = true;
    for (const s of this.seats) if (s !== seat) s.send({ k: "again", id });
    if (!this.seats.every((s) => s.again)) return;
    for (const s of this.seats) { s.done = false; s.tape = undefined; s.claimed = undefined; s.again = false; s.inputs = []; s.cm = 0; s.toldAt = 0; }
    this.settled = false;
    this.seed = this.deal();
    this.started = true;
    for (const s of this.seats) s.send(this.startFor(s));
    for (const w of this.watchers) w.send(this.startForWatcher(w));
  }

  /**
   * A player takes a seat. The race starts once two seats are held and both phones are here;
   * a third finds the room full.
   */
  join(seat: Omit<Seat, "done">): void {
    const again = this.seats.find((s) => s.id === seat.id);
    if (again) {
      // the same player back on a fresh socket keeps their seat and, mid-race, their start;
      // after the result they keep it too, quietly, so RACE AGAIN races rather than watches
      again.send = seat.send; again.name = seat.name; again.look = seat.look; again.present = true;
      if (this.settled) return;
      if (this.started) {
        again.send(this.startFor(again));
        // anything said while the socket was down is said again: the friend's inputs so far,
        // so their ghost is rebuilt whole, and their finish if it came meanwhile
        for (const s of this.seats) if (s !== again) again.send({ k: "catchup", id: s.id, events: s.inputs ?? [] });
        for (const s of this.seats) if (s !== again && s.done) again.send({ k: "ended", id: s.id, cm: s.claimed ?? 0 });
        return;
      }
    } else {
      if (this.settled || this.seats.length >= 2) { seat.send({ k: "full" }); return; }
      if (this.seats.length === 1 && this.seats[0].world !== seat.world) { seat.send({ k: "update" }); return; }
      this.seats.push({ ...seat, present: true, done: false });
    }
    if (this.seats.length < 2 || !this.seats.every((s) => s.present)) { this.sendWait(); return; }
    this.world = seat.world;
    this.seed = this.deal();
    this.started = true;
    for (const s of this.seats) s.send(this.startFor(s));
    for (const w of this.watchers) w.send(this.startForWatcher(w));
  }

  /** Everyone seated hears who else is here, so a lobby can say what it is waiting on. */
  private sendWait(): void {
    for (const s of this.seats) s.send({ k: "wait", id: s.id, others: this.seats.filter((o) => o !== s).map((o) => ({ id: o.id, name: o.name, present: !!o.present })) });
  }

  /** A phone dropped before the start: its seat is kept, the other seat is told. */
  away(id: string): void {
    const seat = this.seats.find((s) => s.id === id);
    if (!seat || this.started) return;
    seat.present = false;
    this.sendWait();
  }

  /** The lobby, as something a room can keep across being put to sleep. */
  get lobby(): { id: string; name: string; world: number; look?: Seat["look"] }[] | null {
    if (this.started) return null;
    return this.seats.map((s) => ({ id: s.id, name: s.name, world: s.world, ...(s.look ? { look: s.look } : {}) }));
  }
  /** Seats put back from storage: held, absent, and mute until their phone reconnects. */
  restore(seats: { id: string; name: string; world: number; look?: Seat["look"] }[]): void {
    if (this.started || this.seats.length) return;
    this.seats = seats.map((s) => ({ ...s, send: () => {}, present: false, done: false }));
  }

  private startFor(s: Seat): Message {
    const them = this.seats.find((o) => o !== s)!;
    return { k: "start", seed: this.seed, world: this.world, you: s.id, them: { id: them.id, name: them.name, ...(them.look ? { look: them.look } : {}) }, countdownMs: 3000, side: this.seats.indexOf(s) ? 1 : 0 };
  }

  /**
   * A heartbeat's height. Once the other run has ended below it, this phone is told so, and
   * told again every second it climbs on: the first word can be lost to a dropped socket, and
   * a race that is already decided should not wait for the leader to fall.
   */
  progress(id: string, cm: number, now = Date.now()): void {
    const seat = this.seats.find((s) => s.id === id);
    if (!seat || !this.started || this.settled || seat.done) return;
    seat.cm = cm;
    const other = this.seats.find((s) => s !== seat && s.done);
    if (!other || cm <= (other.claimed ?? 0)) return;
    if (seat.toldAt && now - seat.toldAt < 1000) return;
    seat.toldAt = now;
    seat.send({ k: "ended", id: other.id, cm: other.claimed ?? 0 });
  }

  /** One input from a player, straight on to the other. Nothing is kept: the tape is the record. */
  input(id: string, e: unknown): void {
    if (!this.started || this.settled) return;
    const seat = this.seats.find((s) => s.id === id);
    if (!seat || seat.done) return; // a watcher's inputs go nowhere, and a finished run makes none
    // heartbeats are not kept; flings and moves are, up to a tape's worth
    if (!(e && typeof e === "object" && (e as { k?: unknown }).k === "tick")) { (seat.inputs ??= []).push(e); if (seat.inputs.length > 4000) seat.inputs.shift(); }
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
    if (!this.started) {
      // gone before the start: the others hear who closed the lobby, then what is left of it
      this.seats = this.seats.filter((s) => s !== seat);
      for (const s of this.seats) s.send({ k: "left", id, name: seat.name });
      this.sendWait();
      return;
    }
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
    const rows = this.seats.map((s, i) => {
      if (s.tape == null) return { id: s.id, name: s.name, cm: 0, verified: false, reason: "no tape" };
      const v = this.replay(s.tape, this.seed, this.world, i ? 1 : 0);
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
export const roomReplay: Replay = (tape, seed, world, side) => {
  const checked = checkRaceTape(tape, seed, world);
  if ("reason" in checked) return { ok: false, cm: 0, reason: checked.reason };
  const v = replayRace(checked.tape, side);
  return v.ok ? { ok: true, cm: v.cm } : { ok: false, cm: 0, reason: v.reason };
};

/** The wire: one JSON message per frame, small, from a phone that already proved little. */
type Inbound =
  | { k: "hello"; id: string; name: string; world: number; look?: { creature?: unknown; pattern?: unknown }; watch?: boolean }
  | { k: "in"; e: unknown }
  | { k: "done"; tape: unknown; cm: number }
  | { k: "again" }
  | { k: "bye" };

const NAME_RE = /[^\p{L}\p{N} _.\-!?]/gu;

/**
 * One room per match id. Sockets are plain (not hibernating): a race is minutes long and two
 * players, so the object living for it costs nothing worth the extra plumbing.
 */
export class MatchRoom {
  private readonly match = new Match(roomReplay);
  private readonly who = new Map<WebSocket, string>();
  constructor(private readonly state: DurableObjectState) {
    // a room with no socket open can be put to sleep; the lobby comes back from storage so a
    // host who went off to send the link still holds their seat when the friend opens it
    void state.blockConcurrencyWhile(async () => {
      const lobby = await state.storage.get<{ id: string; name: string; world: number }[]>("lobby");
      if (lobby?.length) this.match.restore(lobby);
    });
  }
  private keepLobby(): void {
    const lobby = this.match.lobby;
    if (lobby) void this.state.storage.put("lobby", lobby);
    else void this.state.storage.delete("lobby");
  }

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
      this.keepLobby();
      return;
    }
    const id = this.who.get(ws);
    if (!id) return;
    if (m.k === "again") this.match.again(id);
    // the lobby was closed on purpose: no hold, the seat goes now and the other phone is told
    if (m.k === "bye") { this.who.delete(ws); this.match.leave(id); this.keepLobby(); }
    if (m.k === "in") {
      const e = m.e as { k?: unknown; cm?: unknown } | null;
      if (e && e.k === "tick" && Number.isFinite(Number(e.cm))) this.match.progress(id, Number(e.cm));
      this.match.input(id, m.e);
    }
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
    // back before the room counts it as gone, and coming back cancels the count. Before the
    // start the seat is held much longer and the other seat is told the phone stepped away.
    const started = this.match.started;
    if (!started) this.match.away(id);
    const t = setTimeout(() => { if (![...this.who.values()].includes(id)) { this.match.leave(id); this.keepLobby(); } }, started ? LEAVE_GRACE_MS : LOBBY_HOLD_MS);
    this.leaving.set(id, t);
  }
  private readonly leaving = new Map<string, ReturnType<typeof setTimeout>>();

  async alarm(): Promise<void> { this.match.timeout(); }
}
