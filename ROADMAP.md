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
4. **Creature roster (#17).** Bodies on the four-magnet rig: gecko, frog,
   octopus, robot first; patterns (colours, effects) within each creature.
   Creatures unlock from moments (tutorial, height, crew chain, gadget
   challenge); patterns from the prize machine, streak and missions. Codex
   draws, Claude wires unlocks, shop and save.
5. **Prize machine.** Spend 100 coins, spin, win a random pattern; duplicates
   refund. The coin sink the economy is missing.
6. **Instant restart and "so close".** One tap from game over to a new run;
   best height and any challenge line drawn on the fridge so every run ends
   with a near miss.

## Next — social and progression
7. **Weekly league.** Buckets of ~30 players by lifetime metres, top 10
   promote, bottom 10 drop. Tier badge on the scoreboard.
8. **Input recorder:** log every fling/climb/reserve as `{tick, id, vector}`
   per run. Foundation for replay, ghosts and score validation.
9. **Ghost of your best run** drawn live on the fridge (uses the recorder).
10. **Async race:** race a friend's recorded run as a ghost from a share link.
11. **Live ghost race:** Durable Object per match relaying inputs over
    WebSocket; goal height; result settled by server replay.
12. **Themed fridges:** monthly skin of the fridge (stickers, plates, palette)
    with one limited climber skin. Gives each update something to post.
13. **Accounts:** Sign in with Google/Apple on top of the current link codes
    (needs OAuth client ids from the owner).

## Later — platform and money
14. Capacitor wrap for Android/iOS; AdMob rewarded revive (hook exists in
    `main.ts`); store IAP for gems.
15. Offline "stretch" income, prestige, season pass, roster gacha per DESIGN.md.
16. Colour abilities (green reach, yellow light, black strong magnet).
17. Feel pass from real-phone play: fling scale, gap sizes, wall ramp, link
    radius. Numbers live in `config.ts`. Ongoing.
