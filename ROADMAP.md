# Roadmap

Ordered. Each item is a GitHub issue. Pick the top open one.

## Now — validate the shipped game

1. Real-device feel pass: test fling scale, gap sizes, wall ramp, link radius,
   swipe dodge timing, upright catch frequency, menu scrolling, audio balance,
   and frame rate on representative phones. Numbers live in `config.ts`.
2. PWA/offline verification: install the PWA, test portrait safe areas, cold
   reload, service-worker updates, offline reload, reduced motion, and audio
   unlock after the first gesture.
3. Tune the newest content: adjust the pacing of gadgets, polarity plates,
   tricks, and kid-hand attacks so the basic climbing loop remains readable.
4. First-run tutorial: three guided actions covering stick-to-steel, a one-tip
   hang, and building a teammate ladder.

## Next — make runs replayable and shareable

5. Input recorder: log every fling/climb/reserve as `{tick, id, vector}` per
   run. Use it for deterministic bug reports, replay, ghosts, and score
   validation.
6. Daily seeded challenge: reuse the deterministic world generator with a
   daily seed, separate leaderboard, and share-card result.
7. Async ghost race: race a friend's recorded run using the input recorder.
8. SYNC fling polish: keep the staggered crew fling reliable and make its
   affordance and tradeoffs clear in the crew UI.

## Later — online and native product layers

9. Accounts: sign in with Google/Apple, add a `players` table in D1, and cloud
   save the save blob.
10. Live ghost race: Durable Object per match relaying inputs over WebSocket;
    settle the result with server replay.
11. Capacitor wrap for Android/iOS; add AdMob rewarded revive and store IAP
    for gems only after the phone build proves stable.
12. Offline “stretch” income, prestige, season pass, and roster gacha per
    `DESIGN.md`.
13. Colour abilities: green reach, yellow light, black strong magnet.
