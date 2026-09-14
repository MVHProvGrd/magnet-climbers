# Roadmap

Ordered. Each item is a GitHub issue. Pick the top open one.

Done so far: crew SYNC fling, solo mode, tutorial, story, chill mode, HP and
moving bumpers, kid hand swipes, tricks, gadgets, field guide, cloud save with
device linking and merge, global and lifetime boards, challenge links with
verified share cards, PWA auto-update, generated music loops.

## Now — retention (the "why did I open this again" layer)
1. **Missions, three at a time.** Rotating goals written against things we
   already track (tricks, stickers stuck, coins in a run, height without a
   bumper hit, mode-specific). Complete one, it pays coins and a new one
   rotates in. Progress shown on the menu and at game over.
2. **Daily reward and streak.** Open the app, claim a coin drop. Seven days in
   a row pays a skin. Streak counter on the menu; miss a day, it resets.
3. **Daily seeded run.** Same fridge for everyone for 24 h (resets midnight
   Central), one board per day in D1, one attempt scored. Sim is already
   deterministic; needs a seed-of-the-day and a `daily` board.
4. **Prize machine.** Spend 100 coins, spin, win a random skin or toy variant;
   duplicates refund. The coin sink the economy is missing.
5. **Instant restart and "so close".** One tap from game over to a new run;
   best height and any challenge line drawn on the fridge so every run ends
   with a near miss.

## Next — social and progression
6. **Weekly league.** Buckets of ~30 players by lifetime metres, top 10
   promote, bottom 10 drop. Tier badge on the scoreboard.
7. **Input recorder:** log every fling/climb/reserve as `{tick, id, vector}`
   per run. Foundation for replay, ghosts and score validation.
8. **Ghost of your best run** drawn live on the fridge (uses the recorder).
9. **Async race:** race a friend's recorded run as a ghost from a share link.
10. **Live ghost race:** Durable Object per match relaying inputs over
    WebSocket; goal height; result settled by server replay.
11. **Themed fridges:** monthly skin of the fridge (stickers, plates, palette)
    with one limited climber skin. Gives each update something to post.
12. **Accounts:** Sign in with Google/Apple on top of the current link codes
    (needs OAuth client ids from the owner).

## Later — platform and money
13. Capacitor wrap for Android/iOS; AdMob rewarded revive (hook exists in
    `main.ts`); store IAP for gems.
14. Offline "stretch" income, prestige, season pass, roster gacha per DESIGN.md.
15. Colour abilities (green reach, yellow light, black strong magnet).
16. Feel pass from real-phone play: fling scale, gap sizes, wall ramp, link
    radius. Numbers live in `config.ts`. Ongoing.
