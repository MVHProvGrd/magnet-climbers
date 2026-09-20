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
import { DDL } from "../worker/src/index";

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
  for (const stmt of Object.values(DDL)) raw.exec(stmt);

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
