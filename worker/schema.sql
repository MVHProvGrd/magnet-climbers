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

-- one-time backfill (idempotent: only when the counter is still empty): seed the
-- global total from the best runs recorded before the counter existed
UPDATE stats SET
  total_cm = (SELECT COALESCE(SUM(cm), 0) FROM scores WHERE player_id NOT LIKE 'smoke-%'),
  runs = (SELECT COUNT(*) FROM scores WHERE player_id NOT LIKE 'smoke-%')
WHERE id = 1 AND runs = 0;

-- lifetime distance per player, every run and every mode, chill included
CREATE TABLE IF NOT EXISTS lifetime (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cm INTEGER NOT NULL DEFAULT 0,
  runs INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lifetime_cm ON lifetime(cm DESC);
-- one-time seed from the bests already on the board (only for players not yet in lifetime)
INSERT OR IGNORE INTO lifetime (player_id, name, cm, runs, updated_at)
  SELECT player_id, MAX(name), SUM(cm), COUNT(*), MAX(created_at) FROM scores
  WHERE player_id NOT LIKE 'smoke-%' GROUP BY player_id;

-- cloud save per player. token is a per-player secret held in the save; writes must present it.
CREATE TABLE IF NOT EXISTS saves (
  player_id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  blob TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
-- short-lived link codes: type the code on another device to adopt this player
CREATE TABLE IF NOT EXISTS link_codes (
  code TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- global chat: one public room, newest 500 kept
CREATE TABLE IF NOT EXISTS chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_created ON chat(created_at DESC);
-- muted players: until = 0 means forever. Mute from the CLI:
--   npx wrangler d1 execute magnet-climbers --remote --command "INSERT OR REPLACE INTO chat_mutes VALUES ('p-xxxx', 0)"
CREATE TABLE IF NOT EXISTS chat_mutes (
  player_id TEXT PRIMARY KEY,
  until INTEGER NOT NULL DEFAULT 0
);
