/**
 * A real in-memory SQLite database (Node's built-in node:sqlite) wearing the thin slice of
 * the D1 API the Worker actually calls: prepare().bind().first()/all()/run(), plus batch().
 * Real SQL semantics beat a hand-rolled mock here — upserts, ON CONFLICT, indexes and the
 * schema itself all behave exactly as they do against the deployed D1 database.
 */
import { DatabaseSync } from "node:sqlite";
// Vite inlines this as a string at build time, so the schema travels with the bundled test
// file instead of being read from a path that only exists relative to the source tree.
import schemaSql from "../worker/schema.sql?raw";

class FakeStatement {
  sql = "";
  params: unknown[] = [];
  constructor(private readonly raw: DatabaseSync) {}
  bind(...args: unknown[]): FakeStatement {
    const s = new FakeStatement(this.raw);
    s.sql = this.sql;
    s.params = args;
    return s;
  }
  async first<T>(): Promise<T | null> {
    const row = this.raw.prepare(this.sql).get(...(this.params as never[]));
    return (row as T) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    const rows = this.raw.prepare(this.sql).all(...(this.params as never[]));
    return { results: rows as T[] };
  }
  async run(): Promise<{ meta: { last_row_id: number; changes: number } }> {
    const info = this.raw.prepare(this.sql).run(...(this.params as never[]));
    return { meta: { last_row_id: Number(info.lastInsertRowid), changes: Number(info.changes) } };
  }
}

/** Fresh in-memory D1-shaped database, schema already applied. */
export function makeFakeDB(): { DB: unknown; raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  raw.exec(schemaSql);
  // The Worker creates these on first use and then remembers it has, in a module-level flag —
  // fine for one long-lived D1 database, but that flag survives across the several in-memory
  // databases a test run creates, so the second test's DB would never get them. Creating them
  // upfront here sidesteps that mismatch instead of reaching into the Worker's private state.
  raw.exec(`
    CREATE TABLE IF NOT EXISTS chat_censors (player_id TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS score_resets (player_id TEXT NOT NULL, mode TEXT NOT NULL, at INTEGER NOT NULL, cm INTEGER, PRIMARY KEY (player_id, mode));
    CREATE TABLE IF NOT EXISTS chat_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, target_id TEXT NOT NULL, target_name TEXT NOT NULL,
      reporter_id TEXT NOT NULL, message_id INTEGER, text TEXT, created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS chat_reports_once ON chat_reports(kind, reporter_id, target_id, IFNULL(message_id, 0));
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT NOT NULL, bucket INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (key, bucket));
    CREATE TABLE IF NOT EXISTS league (
      player_id TEXT NOT NULL, week TEXT NOT NULL, tier INTEGER NOT NULL, bucket INTEGER NOT NULL,
      name TEXT NOT NULL, cm INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY (player_id, week)
    );
    CREATE INDEX IF NOT EXISTS league_bucket ON league (week, tier, bucket, cm DESC);
    CREATE TABLE IF NOT EXISTS daily (
      player_id TEXT NOT NULL, day TEXT NOT NULL, name TEXT NOT NULL, cm INTEGER NOT NULL,
      seconds INTEGER, created_at INTEGER NOT NULL, PRIMARY KEY (player_id, day)
    );
    CREATE INDEX IF NOT EXISTS daily_board ON daily (day, cm DESC);
  `);

  const DB = {
    prepare(sql: string): FakeStatement {
      const s = new FakeStatement(raw);
      s.sql = sql;
      return s;
    },
    async batch(stmts: FakeStatement[]): Promise<unknown[]> {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  };
  return { DB, raw };
}
