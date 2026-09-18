/**
 * The daily replay, off the request path.
 *
 * Replaying a tape costs about a second of CPU per ten minutes of climb, and a Worker request
 * has milliseconds. So /score records the claim at once and hands the tape to this Durable
 * Object, which has the CPU to climb it again and writes the verdict back: the tapes row gets
 * its verdict, and the daily row is cut to the replayed height if the claim stood above it,
 * or dropped when the replay fails and the board is in enforce mode. The board self-heals
 * within seconds of a post rather than making every post wait on the replay.
 */
import type { Env } from "./index";
import { verifyDaily, type Verdict } from "./replay";

export interface VerifyJob { playerId: string; day: string; cm: number; tape: unknown; world: number; enforce: boolean }

/** Run the verdict through to the tables. Shared by the object and the inline path the tests use. */
export async function settleVerdict(env: Env, job: VerifyJob, v: Verdict): Promise<void> {
  await env.DB.prepare("UPDATE tapes SET replayed = ?, verdict = ?, ms = ? WHERE player_id = ? AND day = ?")
    .bind(v.cm ?? null, v.ok ? "ok" : v.reason, v.ms ?? null, job.playerId, job.day).run().catch(() => {});
  if (v.ok) {
    // the row keeps the claim, never more than the climb the tape reaches
    if (v.cm < job.cm) await env.DB.prepare("UPDATE daily SET cm = ? WHERE player_id = ? AND day = ?").bind(v.cm, job.playerId, job.day).run().catch(() => {});
  } else if (job.enforce) {
    await env.DB.prepare("DELETE FROM daily WHERE player_id = ? AND day = ?").bind(job.playerId, job.day).run().catch(() => {});
  }
}

export class Verifier {
  constructor(_state: DurableObjectState, private readonly env: Env) {}
  async fetch(req: Request): Promise<Response> {
    let job: VerifyJob;
    try { job = (await req.json()) as VerifyJob; } catch { return new Response("bad job", { status: 400 }); }
    const v = verifyDaily(job.tape, job.cm, job.day, job.world);
    await settleVerdict(this.env, job, v);
    return Response.json({ ok: v.ok, cm: v.cm ?? null, reason: v.ok ? null : v.reason });
  }
}
