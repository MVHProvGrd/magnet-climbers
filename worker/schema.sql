CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  cm INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
-- one best row per player per mode keeps the table small and the query cheap
CREATE UNIQUE INDEX IF NOT EXISTS scores_player_mode ON scores(player_id, mode);
CREATE INDEX IF NOT EXISTS scores_mode_cm ON scores(mode, cm DESC);

-- global totals, one row
CREATE TABLE IF NOT EXISTS stats (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total_cm INTEGER NOT NULL DEFAULT 0,
  runs INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO stats (id, total_cm, runs) VALUES (1, 0, 0);
