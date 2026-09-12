# Roadmap

Ordered. Each item is a GitHub issue. Pick the top open one.

## Now
1. Feel pass from real-phone play: fling scale, gap sizes, wall ramp, link radius. Numbers live in `config.ts`.
2. Input recorder: log every fling/climb/reserve as `{tick, id, vector}` per run. Foundation for replay, ghosts, score validation.
3. SYNC fling (optional crew tool): one drag flings every free climber with the same vector, staggered.
4. First-run tutorial: three guided flings (stick, hang, ladder).

## Next
5. Accounts: Sign in with Google/Apple, `players` table in D1, cloud save of the save blob.
6. Async race: race a friend's recorded run as a ghost (uses the recorder).
7. Live ghost race: Durable Object per match relaying inputs over WebSocket; goal height; result settled by server replay.
8. Daily seeded run with its own board.

## Later
9. Capacitor wrap for Android/iOS; AdMob rewarded revive; store IAP for gems.
10. Offline "stretch" income, prestige, season pass, roster gacha per DESIGN.md.
11. Colour abilities (green reach, yellow light, black strong magnet).
