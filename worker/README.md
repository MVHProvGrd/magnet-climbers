# Leaderboard API on Cloudflare

Cloudflare Worker + D1 (SQLite). Free tier is plenty: 100k requests/day, 5 GB storage.

## One-time setup (about 5 minutes)

Run these from the `worker/` folder on your PC. PowerShell: one line at a time.

```powershell
cd worker
npm install
npx wrangler login
```
A browser tab opens; approve it.

```powershell
npx wrangler d1 create magnet-climbers
```
Copy the `database_id` it prints into `wrangler.toml` (replace `REPLACE_WITH_ID_FROM_wrangler_d1_create`). Then:

```powershell
npm run db:init
npm run deploy
```
`deploy` prints the API URL, like `https://magnet-climbers-api.<you>.workers.dev`. Test it:

```powershell
curl https://magnet-climbers-api.<you>.workers.dev/top?mode=crew
```
Expect `[]`.

## Connect the game

1. GitHub: https://github.com/MVHProvGrd/magnet-climbers/settings/variables/actions → **New repository variable**
   - Name: `LEADERBOARD_URL`
   - Value: the Worker URL from above (no trailing slash)
2. Re-run the Pages workflow (Actions → Build and deploy → Run workflow). The build bakes the URL in.

For local dev, put the same URL in a `.env.local` file in the project root:
```
VITE_LEADERBOARD_URL=https://magnet-climbers-api.<you>.workers.dev
```

## Optional: custom API domain

Cloudflare dashboard → Workers & Pages → magnet-climbers-api → Settings → Domains & Routes → Add → `api.magnetclimbers.com`. Then use that as `LEADERBOARD_URL`. The Worker already allows `*.magnetclimbers.com` origins.

## Endpoints

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/top?mode=crew&limit=25` | mode: crew, solo, lifetime | top scores |
| GET | `/rank?mode=crew&player=<id>` | | `{ rank, cm }` |
| POST | `/score` | `{ playerId, name, mode, cm }` | `{ ok, best }` |
| POST | `/run` | `{ playerId, mode, cm }` | adds to the global total |
| POST | `/rename` | `{ playerId, name }` | renames the player's board rows |
| POST | `/save` | `{ playerId, token, blob, rev }` | cloud save; 409 with the newer blob on conflict |
| GET | `/save?player=&token=` | | `{ blob, rev }` |
| POST | `/link` | `{ playerId, token }` | 6-char code, 10 minutes |
| POST | `/claim` | `{ code }` | `{ playerId, token, blob, rev }` |
| POST | `/merge` | `{ fromId, fromToken, toId, toToken }` | folds an old profile's board rows into the linked one |
| GET | `/stats` | | `{ total_cm, runs, players }` |

Schema changes: re-run `npm run db:init` (it is idempotent) then `npm run deploy`.

One row per player per mode; a submit only ever raises the stored best. Names are trimmed to 12 chars and stripped of markup.

## Anti-cheat note

Scores are honour-system with a 2 km cap. Runs are seeded and deterministic (120 Hz fixed step), so the next step is submitting the input log and having the Worker replay it. See DESIGN.md.

## Challenge share cards

`GET /c/<mode>.<cm>.<name>` serves Open Graph tags (Discord, iMessage, Slack, X) with a
generated 1200x630 score card at `/c/<code>.png`. The game appends `/<playerId>`; the Worker only
prints the height when that player's scoreboard best in the mode covers it, otherwise the card reads
"Unverified climb" so edited links give themselves away. It also and 302s real browsers to
`https://magnetclimbers.com/?c=<code>`. The Worker is also bound to the custom domain
`share.magnetclimbers.com` (see `wrangler.toml`); the game builds its share links against it
(`VITE_SHARE_URL` overrides, `off` falls back to plain `?c=` links). Cards are rendered from SVG
with `@resvg/resvg-wasm` and a subset of Liberation Sans in `assets/`.
