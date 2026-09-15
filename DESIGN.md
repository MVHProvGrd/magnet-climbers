# Magnet Climbers — design

## Fantasy

The magnet people on the fridge are alive and climbing. The fridge never ends.
Each "cm" of height is a real cm up the door. The kid's hand (danger line) is
always coming to grab whoever falls behind.

## Core loop (built)

1. Fling a climber. Aim by dragging back; the preview shows the arc.
2. Land on steel → stick. Land near a teammate after the apex → grab and hang.
3. Leap-frog: the default selection is the lowest free climber, so a good run is a rhythm of "bottom over top".
4. Gaps: short bands are flung over; tall bands, glass windows and plastic fields need a ladder of chained climbers, then the top of the chain flings on.
5. Power-ups on the surface: coins, gems, SUPER MAGNET (stick anywhere, any time, wider snap), SLOW-MO, LONG ARMS, +1 FRIEND.
6. Obstacles: sliding fridge magnets (bumpers) knock flyers and knock stuck climbers loose; red "N" panels repel; the door seam is never sticky.
7. Danger line rises with speed = 22 px/s + 14 px/s per 1000 px climbed, capped at 120. Lose everyone → game over → revive (token / rewarded ad / 5 gems) or bank the run.

## Meta (built, local only)

Soft currency: coins (pick-ups + height/4). Hard currency: gems (rare pick-ups, revives).
Upgrades: team size, magnet strength, arm reach, chain length, slingshot power, sticky floor, spare revive tokens. Exponential cost curves in `config.ts`.

## Next mechanics

- Segment types: fridge handle (long metal island in a glass field), ice dispenser (chute that drops cubes), the "photo wall" (only the steel between frames), moving door (segment that slides sideways).
- Team abilities by colour: e.g. green = extra reach, yellow = lighter (higher arc), black = strongest magnet. Ties into gacha/roster below.
- Combo meter: consecutive sticks without a grab or loss multiply coins.
- Daily seeded run (`makeRng` in `world.ts` is already seeded) with a leaderboard.

## Two run modes (built)

- Solo: one climber flings itself. Pure arcade, separate record.
- Crew: teammates fling each other. The team is the engine.

### Crew rules (built)

- Every climber is its own body and flings itself. The colour dots in the HUD are the active-climber selector; inactive climbers stay magnetised where they stuck.
- Camera always follows the active climber; there is no hand-panning. Off-screen teammates show edge markers you can tap to select, and the red-line distance is always on the dock.
- Fling is nerfed (max vertical jump ≈ 25 cm). Gap bands grow from 12 cm to 38 cm, so wide gaps need a ladder: land within arm reach of an anchored teammate after the apex to hang on. Chains hold only through a climber stuck to steel.
- A climber with someone hanging on it is a LADDER rung and cannot fling. You choose who is ladder and who is runner. Knock the anchor off (bumper) and the chain drops.
- CLIMB mode: crawl hand-over-hand up to 2.6x reach, onto steel or onto a teammate, for deliberate ladder building.
- Wall: stepped ramp, +15% per 50 cm, capped at 2.5x base. Catch-up: if the lowest climber is more than 90 cm above the wall it moves 2.2x faster, so you cannot farm safely at the top.
- Reserves: coins buy up to 5 spare climbers; a HUD button drops one onto the leader mid-run.
- Skins: coin-bought palettes (Glow, Candy, Stealth).

## Roadmap: competitive mode (later)

Race another player over the internet to a goal height (e.g. 20 m).

- Same seed for both players so the fridge is identical. World gen is already seeded and the sim runs at a fixed 120 Hz, so it is deterministic.
- Ghost race first: send only inputs (drag vector + tick) over a WebSocket; each client replays the other team as translucent ghosts. Tiny bandwidth, no netcode for physics.
- Async race as the cheap MVP: record a run's input log, a friend races the recording later. Reuses the anti-cheat replay.
- Then: matchmaking by best height, 1v1 ladder with seasons, wager gems on the match, spectator ghosts on leaderboard runs.
- Interference layer for v2: your power-ups drop a bumper or repel panel on the opponent's fridge.
- Backend: Supabase Realtime or a small Node/WebSocket relay; server replays both input logs to settle the result.

## Free-to-play plan (research summary)

Sources: Forge Master – Idle RPG (Lessmore, 2025), Archero / Archero 2, Survivor.io, Egg Inc, Idle Miner Tycoon, AdVenture Capitalist.

What the top grinders do:

- Forge Master: no ads at all, pure IAP. Loop is collect → forge → merge → auto-battle. Offline earnings capped at 4h, forcing 4–6 sessions/day. Long timers (18h) skipped with gems. Gem packs at roughly $2 / $9 / $32 / $128 tiers, daily-deal ladder, clans, leaderboards, no prestige.
- Archero: energy-gated runs (20 max, 5 per run, 1 per 12 min). Six rewarded-ad slots: shop coins, daily chest, energy refill ×4/day, daily supply, wheel spins, revive. Battle pass $4.99 (13 days, 30 tiers). First-purchase double gems.
- Survivor.io: 300 min of passive loot claimed via ad once/day; pass at $19.99 with a free track.
- Egg Inc: prestige keeps permanent research; hard currency mostly from rewarded videos; Pro Permit $9.99 = 2× offline earnings and more boost slots.
- Idle Miner Tycoon: 2× income for 4h per ad, stackable to ~31h. Strongest single ad placement in the genre.
- Accounts: all launch as guest with device ID; Game Center / Play Games / Facebook link for cloud save; a nickname is enough for leaderboards.

Plan for this game:

1. Two-speed economy. Coins from runs buy the upgrade tree. Gems buy time only: revives, timer skips, offline-cap extensions. Never raw stats.
2. Offline "stretch" income. The team keeps stretching while you're away and earns coins, capped at 4h. Permanent cap extension IAP ($4.99–9.99).
3. Revive ladder: first revive free via ad, second costs gems, tokens from the upgrade tree. Already wired in `ui.ts`.
4. Ad coin boost: 2× coins for 4h per rewarded video, stackable, shown in the shop rather than forced.
5. Prestige = "Re-mold": reset upgrades for Rubber Souls at +10% coins each; keep roster and cosmetics.
6. Gates: prefer daily keys/tickets reset at midnight UTC over energy, so a session never dies mid-flow.
7. Season pass: $4.99, 13 days, 30 tiers, ~130 pts/day from daily missions.
8. Roster gacha with pity (≈10 pulls to epic) and a wish list; duplicates merge to raise rank. Colours map to abilities.
9. Daily-deal ladder at $1.99 / $9.99 / $49.99, first-purchase double bonus, $10 monthly card.
10. Social: height leaderboards, clans with a weekly tower race, 2–4-day events with skins.

## Accounts

- Guest first: `playerId` in the save is a local id today.
- Link later: Sign in with Apple / Google (required by both stores if any social login is offered), plus email magic link.
- Backend: Supabase or Firebase. Tables: players, saves (versioned JSON blob + server timestamp for conflict resolution), runs (seed, height, ms, for leaderboards and anti-cheat replay), purchases (store receipts).
- Anti-cheat for leaderboards: runs are seeded and deterministic at fixed 120 Hz; upload the input log and validate server-side by replaying `Game.update`.
